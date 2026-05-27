import React, { useEffect, useMemo, useState } from "react";
import { Head, router, usePage } from "@inertiajs/react";
import toast from "react-hot-toast";
import DashboardLayout from "@/Layouts/DashboardLayout";
import KitchenLayout from "@/Layouts/KitchenLayout";
import Pagination from "@/Components/Dashboard/Pagination";
import {
    IconCashBanknote,
    IconCheck,
    IconChevronDown,
    IconChevronUp,
    IconClockHour4,
    IconFileExport,
    IconPrinter,
    IconReceipt2,
    IconSearch,
    IconShieldCheck,
    IconUserDollar,
    IconX,
} from "@/Utils/icons";

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

const defaultFilters = {
    q: "",
    status: "",
    cashier_id: "",
    date_from: "",
    date_to: "",
};

const defaultApprovalForm = {
    password: "",
    approved_amount: "",
    approved_cash_amount: "",
    approved_transfer_amount: "",
    approved_other_amount: "",
    approved_other_label: "",
    recipient_name: "",
    approval_reference: "",
    approval_notes: "",
    paid_at: "",
    approval_proof_photos: [],
};

const statusTone = {
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    rejected: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
    cancelled: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const statusLabel = {
    pending: "Menunggu Approval",
    approved: "Disetujui",
    rejected: "Ditolak",
    cancelled: "Dibatalkan",
};

function SummaryCard({ title, value, description, icon, tone = "slate" }) {
    const tones = {
        slate: "border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white",
        amber: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100",
        emerald: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100",
        rose: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-100",
        blue: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-100",
    };

    return (
        <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
            <div className="flex items-center gap-3">
                <div className="rounded-xl bg-white/70 p-3 dark:bg-slate-900/30">{icon}</div>
                <div>
                    <p className="text-sm font-medium opacity-80">{title}</p>
                    <p className="mt-1 text-xl font-bold">{value}</p>
                    <p className="mt-1 text-xs opacity-70">{description}</p>
                </div>
            </div>
        </div>
    );
}

export default function Index({
    filters = {},
    summary = {},
    requests = {},
    cashiers = [],
    shiftOptions = [],
    recipientOptions = [],
    defaultRecipientId = null,
    canApprove = false,
    canCreateRequest = false,
    wallet = null,
}) {
    const { auth, errors, flash } = usePage().props;
    const isKitchenWorkspace = auth?.user?.preferred_workspace === "kitchen";
    const [showRequestPanel, setShowRequestPanel] = useState(
        () => isKitchenWorkspace
    );
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash]);
    const requestPanelTitle = isKitchenWorkspace
        ? "Ajukan Penarikan Dana Tenant"
        : "Approval Penarikan Tenant";
    const requestPanelDescription = isKitchenWorkspace
        ? "Pemilik tenant dapat melihat saldo hasil penjualan yang sudah selesai diantar, lalu mengajukan pencairan ke owner outlet."
        : "Admin outlet hanya meninjau, menyetujui, atau menolak pengajuan yang dibuat tenant. Admin tidak membuat pengajuan dari halaman ini.";
    const shiftFieldLabel = isKitchenWorkspace
        ? "Shift Penjualan"
        : "Shift Kasir";
    const shiftPlaceholder = isKitchenWorkspace
        ? "Pilih shift penjualan"
        : "Pilih shift";
    const recipientFieldLabel = isKitchenWorkspace
        ? "Penerima Pencairan"
        : "Tujuan Admin / Penerima";
    const notesFieldLabel = isKitchenWorkspace
        ? "Catatan Pengajuan"
        : "Catatan Pengajuan";
    const notesPlaceholder = isKitchenWorkspace
        ? "Contoh: mohon pencairan sebagian ke rekening tenant, sisanya cash"
        : "Opsional";
    const submitRequestLabel = isKitchenWorkspace
        ? "Ajukan Penarikan Dana"
        : "Ajukan Setoran";
    const [filterData, setFilterData] = useState({
        ...defaultFilters,
        q: filters?.q ?? "",
        status: filters?.status ?? "",
        cashier_id: filters?.cashier_id ?? "",
        date_from: filters?.date_from ?? "",
        date_to: filters?.date_to ?? "",
    });
    const [createData, setCreateData] = useState({
        cashier_shift_id: "",
        requested_amount: "",
        recipient_user_id: defaultRecipientId ? String(defaultRecipientId) : "",
        requested_notes: "",
        request_proof_photos: [],
    });
    const [approvalModal, setApprovalModal] = useState({
        open: false,
        request: null,
        mode: "approve",
    });
    const [approvalForm, setApprovalForm] = useState(defaultApprovalForm);
    const [rejectionReason, setRejectionReason] = useState("");
    const [rejectionPassword, setRejectionPassword] = useState("");

    useEffect(() => {
        setFilterData({
            ...defaultFilters,
            q: filters?.q ?? "",
            status: filters?.status ?? "",
            cashier_id: filters?.cashier_id ?? "",
            date_from: filters?.date_from ?? "",
            date_to: filters?.date_to ?? "",
        });
    }, [filters]);

    const rows = requests?.data ?? [];
    const links = requests?.links ?? [];
    const selectedShift = useMemo(
        () =>
            shiftOptions.find(
                (shift) => String(shift.id) === String(createData.cashier_shift_id)
            ) || null,
        [createData.cashier_shift_id, shiftOptions]
    );
    const kitchenRequestedAmount = Number(createData.requested_amount || 0);
    const kitchenAvailableBalance = Number(wallet?.available_balance ?? 0);
    const kitchenAmountExceedsBalance =
        isKitchenWorkspace &&
        createData.requested_amount !== "" &&
        kitchenRequestedAmount > kitchenAvailableBalance;

    const applyFilters = (event) => {
        event.preventDefault();
        router.get(route("cashier-settlements.index"), filterData, {
            preserveScroll: true,
            preserveState: true,
        });
    };

    const resetFilters = () => {
        setFilterData(defaultFilters);
        router.get(route("cashier-settlements.index"), {}, {
            preserveScroll: true,
            preserveState: false,
            replace: true,
        });
    };

    const submitRequest = (event) => {
        event.preventDefault();
        router.post(route("cashier-settlements.store"), createData, {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () =>
                setCreateData({
                    cashier_shift_id: "",
                    requested_amount: "",
                    recipient_user_id: defaultRecipientId
                        ? String(defaultRecipientId)
                        : "",
                    requested_notes: "",
                    request_proof_photos: [],
                }),
        });
    };

    const openApproveModal = (request) => {
        setApprovalModal({
            open: true,
            request,
            mode: "approve",
        });
        const requestedAmount = Number(request.requested_amount) || 0;
        const now = new Date();
        const localIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        setApprovalForm({
            password: "",
            approved_amount: String(requestedAmount),
            approved_cash_amount: String(requestedAmount),
            approved_transfer_amount: "0",
            approved_other_amount: "0",
            approved_other_label: "",
            recipient_name: request.recipient_name || request.recipient_user?.name || "",
            approval_reference: "",
            approval_notes: "",
            paid_at: localIso,
            approval_proof_photos: [],
        });
        setRejectionReason("");
    };

    const openRejectModal = (request) => {
        setApprovalModal({
            open: true,
            request,
            mode: "reject",
        });
        setApprovalForm(defaultApprovalForm);
        setRejectionReason("");
        setRejectionPassword("");
    };

    const closeModal = () => {
        setApprovalModal({
            open: false,
            request: null,
            mode: "approve",
        });
        setApprovalForm(defaultApprovalForm);
        setRejectionReason("");
        setRejectionPassword("");
    };

    const approvalBreakdownTotal =
        Number(approvalForm.approved_cash_amount) +
        Number(approvalForm.approved_transfer_amount) +
        Number(approvalForm.approved_other_amount);
    const approvalTarget = Number(approvalForm.approved_amount);

    const submitApprove = (event) => {
        event.preventDefault();
        if (!approvalModal.request) return;

        const formData = new FormData();
        formData.append('_method', 'PATCH');
        formData.append('password', approvalForm.password);
        formData.append('approved_amount', approvalForm.approved_amount);
        formData.append('approved_cash_amount', approvalForm.approved_cash_amount);
        formData.append('approved_transfer_amount', approvalForm.approved_transfer_amount);
        formData.append('approved_other_amount', approvalForm.approved_other_amount);
        formData.append('approved_other_label', approvalForm.approved_other_label || '');
        formData.append('recipient_name', approvalForm.recipient_name);
        formData.append('approval_reference', approvalForm.approval_reference || '');
        formData.append('approval_notes', approvalForm.approval_notes || '');
        formData.append('paid_at', approvalForm.paid_at || '');
        if (approvalForm.approval_proof_photos?.length) {
            approvalForm.approval_proof_photos.forEach((file, index) => {
                formData.append(`approval_proof_photos[${index}]`, file);
            });
        }

        router.post(
            route("cashier-settlements.approve", approvalModal.request.id),
            formData,
            {
                preserveScroll: true,
                forceFormData: true,
                onSuccess: () => closeModal(),
                onError: () => setApprovalForm((prev) => ({ ...prev, password: "" })),
            }
        );
    };

    const submitReject = (event) => {
        event.preventDefault();
        if (!approvalModal.request) return;
        router.patch(
            route("cashier-settlements.reject", approvalModal.request.id),
            { rejection_reason: rejectionReason, password: rejectionPassword },
            {
                preserveScroll: true,
                onSuccess: () => closeModal(),
                onError: () => setRejectionPassword(""),
            }
        );
    };

    const printReceipt = (request) => {
        window.open(
            route("cashier-settlements.receipt", {
                cashierSettlement: request.id,
                autoprint: 1,
            }),
            "_blank",
            "noopener,noreferrer"
        );
    };

    return (
        <>
            <Head title={isKitchenWorkspace ? "Penarikan Dana Tenant" : "Approval Penarikan Tenant"} />

            <div className="space-y-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            {isKitchenWorkspace ? "Penarikan Dana Tenant" : "Approval Penarikan Tenant"}
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {isKitchenWorkspace
                                ? "Ajukan pencairan dana tenant dari saldo yang tersedia."
                                : "Tinjau pengajuan tenant lalu setujui atau tolak."}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setShowRequestPanel((value) => !value)}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                            {showRequestPanel ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
                            {showRequestPanel ? "Sembunyikan panel" : "Buka panel"}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowFilters((value) => !value)}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                            {showFilters ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
                            {showFilters ? "Sembunyikan filter" : "Buka filter"}
                        </button>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <SummaryCard title="Menunggu Approval" value={String(summary?.pending_count ?? 0)} description="Pengajuan yang belum divalidasi" icon={<IconClockHour4 size={20} />} tone="amber" />
                    <SummaryCard title="Disetujui" value={String(summary?.approved_count ?? 0)} description="Pengajuan yang sudah dibayar" icon={<IconCheck size={20} />} tone="emerald" />
                    <SummaryCard title="Total Pending" value={formatCurrency(summary?.requested_total ?? 0)} description="Nominal pengajuan yang menunggu approval" icon={<IconReceipt2 size={20} />} tone="blue" />
                    <SummaryCard title="Total Disetujui" value={formatCurrency(summary?.approved_total ?? 0)} description="Nominal sudah dibayar" icon={<IconCashBanknote size={20} />} tone="slate" />
                </div>

                {isKitchenWorkspace && wallet ? (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <SummaryCard title="Saldo Masuk Tenant" value={formatCurrency(wallet.tenant_sales_total ?? 0)} description="Penjualan tenant setelah promo pricing rules" icon={<IconReceipt2 size={20} />} tone="emerald" />
                        <SummaryCard title="Piutang ke Owner" value={formatCurrency(wallet.receivable_total ?? 0)} description="Hak tenant yang belum dicairkan penuh" icon={<IconClockHour4 size={20} />} tone="amber" />
                        <SummaryCard title="Menunggu Approval" value={formatCurrency(wallet.pending_total ?? 0)} description="Pengajuan penarikan yang masih diproses" icon={<IconShieldCheck size={20} />} tone="blue" />
                        <SummaryCard title="Saldo Tersedia" value={formatCurrency(wallet.available_balance ?? 0)} description="Batas nominal yang bisa diajukan saat ini" icon={<IconCashBanknote size={20} />} tone="slate" />
                    </div>
                ) : null}

                <div className={`grid gap-6 ${canCreateRequest ? "xl:grid-cols-[0.95fr,1.05fr]" : "xl:grid-cols-[0.7fr,1.3fr]"}`}>
                    {showRequestPanel ? (
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-4">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                {requestPanelTitle}
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {requestPanelDescription}
                            </p>
                        </div>
                        {canCreateRequest ? (
                        <form onSubmit={submitRequest} className="space-y-4">
                            {isKitchenWorkspace ? (
                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                            Penjualan Setelah Promo
                                        </p>
                                        <p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
                                            {formatCurrency(wallet?.tenant_sales_total ?? 0)}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                            Dasar sebelum promo {formatCurrency(wallet?.base_total ?? 0)}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-950/20">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500">
                                            Saldo Tersedia
                                        </p>
                                        <p className="mt-2 text-lg font-bold text-emerald-700 dark:text-emerald-300">
                                            {formatCurrency(wallet?.available_balance ?? 0)}
                                        </p>
                                        <p className="mt-1 text-xs text-emerald-600/80 dark:text-emerald-300/70">
                                            Diskon pricing rules {formatCurrency(wallet?.pricing_discount_total ?? 0)}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        {shiftFieldLabel}
                                    </label>
                                    <select
                                        value={createData.cashier_shift_id}
                                        onChange={(event) =>
                                            setCreateData((prev) => ({
                                                ...prev,
                                                cashier_shift_id: event.target.value,
                                            }))
                                        }
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                                        required
                                    >
                                        <option value="">{shiftPlaceholder}</option>
                                        {shiftOptions.map((shift) => (
                                            <option key={shift.id} value={String(shift.id)}>
                                                {shift.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {isKitchenWorkspace ? (
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Nominal Penarikan
                                    </label>
                                    <div className="flex flex-col gap-3 sm:flex-row">
                                        <input
                                            type="number"
                                            min="1"
                                            max={kitchenAvailableBalance}
                                            value={createData.requested_amount}
                                            onChange={(event) =>
                                                setCreateData((prev) => ({
                                                    ...prev,
                                                    requested_amount: event.target.value,
                                                }))
                                            }
                                            className={`h-11 w-full rounded-xl border px-4 text-sm dark:bg-slate-800 ${
                                                kitchenAmountExceedsBalance || errors.requested_amount
                                                    ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/20 dark:text-rose-300"
                                                    : "border-slate-200 bg-slate-50 dark:border-slate-700"
                                            }`}
                                            placeholder="Masukkan nominal yang ingin dicairkan"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setCreateData((prev) => ({
                                                    ...prev,
                                                    requested_amount: String(kitchenAvailableBalance || 0),
                                                }))
                                            }
                                            disabled={kitchenAvailableBalance <= 0}
                                            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                        >
                                            Tarik Semua
                                        </button>
                                    </div>
                                    {kitchenAmountExceedsBalance ? (
                                        <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">
                                            Nominal penarikan tidak boleh melebihi saldo tersedia {formatCurrency(kitchenAvailableBalance)}.
                                        </p>
                                    ) : null}
                                    {errors.requested_amount ? (
                                        <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">
                                            {errors.requested_amount}
                                        </p>
                                    ) : null}
                                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                        Maksimal pengajuan saat ini {formatCurrency(kitchenAvailableBalance)}.
                                    </p>
                                </div>
                            ) : null}

                            {!isKitchenWorkspace ? (
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        {recipientFieldLabel}
                                    </label>
                                    <select
                                        value={createData.recipient_user_id}
                                        onChange={(event) =>
                                            setCreateData((prev) => ({
                                                ...prev,
                                                recipient_user_id: event.target.value,
                                            }))
                                        }
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                                    >
                                        <option value="">Belum diatur</option>
                                        {recipientOptions.map((recipient) => (
                                            <option key={recipient.id} value={String(recipient.id)}>
                                                {recipient.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                    Penerima pencairan mengikuti setting owner / admin outlet. Tenant tidak perlu memilih manual.
                                </div>
                            )}

                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    {notesFieldLabel}
                                </label>
                                <textarea
                                    value={createData.requested_notes}
                                    onChange={(event) =>
                                        setCreateData((prev) => ({
                                            ...prev,
                                            requested_notes: event.target.value,
                                        }))
                                    }
                                    rows={3}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                                    placeholder={notesPlaceholder}
                                />
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    {isKitchenWorkspace ? "Lampiran Pengajuan" : "Bukti Setoran"}
                                </label>
                                <input
                                    type="file"
                                    accept="image/png,image/jpeg,image/jpg,image/webp"
                                    multiple
                                    onChange={(event) =>
                                        setCreateData((prev) => ({
                                            ...prev,
                                            request_proof_photos: Array.from(event.target.files || []),
                                        }))
                                    }
                                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                                />
                                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                    Opsional. Bisa dikosongkan bila tidak ada lampiran pendukung.
                                </p>
                                {createData.request_proof_photos?.length ? (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {createData.request_proof_photos.map((file, index) => (
                                            <span key={`${file.name}-${index}`} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                {file.name}
                                            </span>
                                        ))}
                                    </div>
                                ) : null}
                            </div>

                            {!isKitchenWorkspace && selectedShift ? (
                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                            Penjualan Bruto
                                        </p>
                                        <p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
                                            {formatCurrency(selectedShift.gross_sales_total)}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                            Harga Dasar Lunas
                                        </p>
                                        <p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
                                            {formatCurrency(selectedShift.base_sales_total)}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl bg-blue-50 p-4 dark:bg-blue-950/20">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">
                                            Diskon Promo
                                        </p>
                                        <p className="mt-2 text-lg font-bold text-blue-700 dark:text-blue-300">
                                            {formatCurrency(selectedShift.pricing_discount_total || 0)}
                                        </p>
                                    </div>
                                    {!isKitchenWorkspace ? (
                                        <div className="rounded-2xl bg-amber-50 p-4 dark:bg-amber-950/20">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-amber-500">
                                                Markup Owner
                                            </p>
                                            <p className="mt-2 text-lg font-bold text-amber-700 dark:text-amber-300">
                                                {formatCurrency(selectedShift.markup_total)}
                                            </p>
                                        </div>
                                    ) : null}
                                    <div className="rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-950/20">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500">
                                            Nominal Pengajuan
                                        </p>
                                        <p className="mt-2 text-lg font-bold text-emerald-700 dark:text-emerald-300">
                                            {formatCurrency(selectedShift.requested_amount)}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl bg-blue-50 p-4 dark:bg-blue-950/20">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">
                                            Transaksi Lunas
                                        </p>
                                        <p className="mt-2 text-lg font-bold text-blue-700 dark:text-blue-300">
                                            {selectedShift.paid_transactions_count}
                                        </p>
                                    </div>
                                </div>
                            ) : null}

                            <button
                                type="submit"
                                disabled={isKitchenWorkspace ? kitchenRequestedAmount <= 0 || kitchenAmountExceedsBalance : !selectedShift}
                                className="inline-flex items-center gap-2 rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <IconFileExport size={18} />
                                {submitRequestLabel}
                            </button>
                        </form>
                        ) : (
                        <div className="space-y-4">
                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100">
                                <p className="font-semibold">Pengajuan hanya dibuat oleh tenant</p>
                                <p className="mt-1 text-emerald-800 dark:text-emerald-200">
                                    Untuk menghindari fraud, admin tidak bisa membuat request penarikan dari halaman ini. Admin hanya memvalidasi pengajuan yang masuk dari akun tenant / dapur.
                                </p>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        Alur Aman
                                    </p>
                                    <p className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
                                        Tenant ajukan, admin approve
                                    </p>
                                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                        Admin cukup memeriksa nominal, lampiran, dan metode pembayaran sebelum menyetujui pencairan.
                                    </p>
                                </div>
                                <div className="rounded-2xl bg-blue-50 p-4 dark:bg-blue-950/20">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">
                                        Fokus Admin
                                    </p>
                                    <p className="mt-2 text-sm font-medium text-blue-900 dark:text-blue-100">
                                        Review, approve, cetak bukti
                                    </p>
                                    <p className="mt-2 text-xs text-blue-700 dark:text-blue-200">
                                        Gunakan tabel riwayat di kanan untuk meninjau request, menolak jika perlu, dan menyimpan bukti pembayaran.
                                    </p>
                                </div>
                            </div>
                        </div>
                        )}
                    </div>
                    ) : null}

                    <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        {showFilters ? (
                        <form onSubmit={applyFilters} className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                            <div className="xl:col-span-2">
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Cari
                                </label>
                                <div className="relative">
                                    <input
                                        value={filterData.q}
                                        onChange={(event) =>
                                            setFilterData((prev) => ({
                                                ...prev,
                                                q: event.target.value,
                                            }))
                                        }
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pr-10 text-sm dark:border-slate-700 dark:bg-slate-800"
                                        placeholder={canCreateRequest ? "Nomor request, penerima..." : "Nomor request, pengaju, penerima..."}
                                    />
                                    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400">
                                        <IconSearch size={16} />
                                    </span>
                                </div>
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
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                                >
                                    <option value="">Semua</option>
                                    <option value="pending">Pending</option>
                                    <option value="approved">Approved</option>
                                    <option value="rejected">Rejected</option>
                                </select>
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    {canCreateRequest ? "Akun" : "Pengaju"}
                                </label>
                                <select
                                    value={filterData.cashier_id}
                                    onChange={(event) =>
                                        setFilterData((prev) => ({
                                            ...prev,
                                            cashier_id: event.target.value,
                                        }))
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                                >
                                    <option value="">Semua</option>
                                    {cashiers.map((cashier) => (
                                        <option key={cashier.id} value={String(cashier.id)}>
                                            {cashier.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-end gap-2">
                                <button type="submit" className="rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white">
                                    Terapkan
                                </button>
                                <button type="button" onClick={resetFilters} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">
                                    Reset
                                </button>
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Dari
                                </label>
                                <input
                                    type="date"
                                    value={filterData.date_from}
                                    onChange={(event) =>
                                        setFilterData((prev) => ({
                                            ...prev,
                                            date_from: event.target.value,
                                        }))
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Sampai
                                </label>
                                <input
                                    type="date"
                                    value={filterData.date_to}
                                    onChange={(event) =>
                                        setFilterData((prev) => ({
                                            ...prev,
                                            date_to: event.target.value,
                                        }))
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                                />
                            </div>
                        </form>
                        ) : (
                            <div className="mb-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                                Gunakan filter hanya saat perlu mencari pengajuan tertentu.
                            </div>
                        )}
                    </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                Riwayat Pengajuan
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Menampilkan {requests?.from || 0}-{requests?.to || 0} dari {requests?.total || 0} pengajuan.
                            </p>
                        </div>
                        {requests?.last_page > 1 ? <Pagination links={links} /> : null}
                    </div>

                    {rows.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-slate-800">
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Request</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Pengaju</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                                            {canCreateRequest ? "Saldo Referensi" : "Dasar Setoran"}
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Diajukan</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Disetujui</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Status</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {rows.map((row) => (
                                        <tr key={row.id}>
                                            <td className="px-4 py-3">
                                                <div className="font-semibold text-slate-900 dark:text-white">{row.request_number}</div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                                    {row.business_date || "-"} • {formatDateTime(row.created_at)}
                                                </div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                                    {row.cashier_shift?.id ? `Shift #${row.cashier_shift.id}` : "Pengajuan tenant"}
                                                </div>
                                                {row.requested_notes ? (
                                                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                        Catatan: {row.requested_notes}
                                                    </div>
                                                ) : null}
                                            </td>
                                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                                                <div>{row.cashier?.name || "-"}</div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                                    Penerima: {row.recipient_name || row.recipient_user?.name || "-"}
                                                </div>
                                                {row.approved_by ? (
                                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                                        Validasi: {row.approved_by.name}
                                                    </div>
                                                ) : null}
                                                {row.rejected_by ? (
                                                    <div className="text-xs text-rose-500 dark:text-rose-300">
                                                        Ditolak: {row.rejected_by.name}
                                                    </div>
                                                ) : null}
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">
                                                {formatCurrency(row.settlement_reference_total ?? row.base_sales_total)}
                                                {row.is_tenant_request ? (
                                                    <div className="mt-1 text-[11px] font-normal text-slate-500 dark:text-slate-400">
                                                        Dasar {formatCurrency(row.pricing_basis_total ?? row.base_sales_total)} • promo {formatCurrency(row.pricing_adjustment_total ?? 0)}
                                                    </div>
                                                ) : null}
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold text-blue-600 dark:text-blue-300">{formatCurrency(row.requested_amount)}</td>
                                            <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-300">{formatCurrency(row.approved_amount || 0)}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusTone[row.status] || statusTone.cancelled}`}>
                                                    {statusLabel[row.status] || row.status}
                                                </span>
                                                {row.status === "approved" ? (
                                                    <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                                        {formatDateTime(row.paid_at || row.approved_at)}
                                                    </div>
                                                ) : null}
                                                {row.status === "rejected" ? (
                                                    <div className="mt-1 text-[11px] text-rose-500 dark:text-rose-300">
                                                        {formatDateTime(row.rejected_at)}
                                                    </div>
                                                ) : null}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap justify-center gap-2">
                                                    {canApprove && row.status === "pending" ? (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => openApproveModal(row)}
                                                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                                                            >
                                                                <IconShieldCheck size={12} />
                                                                Approve
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => openRejectModal(row)}
                                                                className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300"
                                                            >
                                                                <IconX size={12} />
                                                                Tolak
                                                            </button>
                                                        </>
                                                    ) : null}
                                                    {row.status === "approved" ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => printReceipt(row)}
                                                            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                                        >
                                                            <IconPrinter size={12} />
                                                            Cetak
                                                        </button>
                                                    ) : null}
                                                </div>
                                                {row.status === "approved" ? (
                                                    <div className="mt-2 text-center text-[11px] text-slate-500 dark:text-slate-400">
                                                        Cash {formatCurrency(row.approved_cash_amount || 0)} • Transfer {formatCurrency(row.approved_transfer_amount || 0)}
                                                    </div>
                                                ) : null}
                                                {row.status === "rejected" && row.rejection_reason ? (
                                                    <div className="mt-2 text-center text-[11px] text-rose-500 dark:text-rose-300">
                                                        {row.rejection_reason}
                                                    </div>
                                                ) : null}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                            {isKitchenWorkspace
                                ? "Belum ada pengajuan penarikan dana tenant."
                                : "Belum ada pengajuan setoran kasir."}
                        </div>
                    )}
                </div>

                {approvalModal.open ? (
                    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 p-4">
                        <div className="flex min-h-full items-center justify-center py-2">
                            <div className="flex w-full max-w-2xl max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
                            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
                                <div>
                                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                                        {approvalModal.mode === "approve"
                                            ? (isKitchenWorkspace ? "Approve Pencairan Tenant" : "Approve Setoran Kasir")
                                            : "Tolak Pengajuan"}
                                    </h2>
                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        {approvalModal.request?.request_number} • {approvalModal.request?.cashier?.name}
                                    </p>
                                </div>
                                <button type="button" onClick={closeModal} className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
                                    Tutup
                                </button>
                            </div>

                            {approvalModal.mode === "approve" ? (
                                <form onSubmit={submitApprove} className="flex min-h-0 flex-1 flex-col">
                                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div>
                                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Nominal Approve</label>
                                            <input type="number" min="0" value={approvalForm.approved_amount} onChange={(e) => setApprovalForm((prev) => ({ ...prev, approved_amount: e.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800" />
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Nama Penerima</label>
                                            <input value={approvalForm.recipient_name} onChange={(e) => setApprovalForm((prev) => ({ ...prev, recipient_name: e.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800" required />
                                        </div>
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-3">
                                        <div>
                                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Cash</label>
                                            <input type="number" min="0" value={approvalForm.approved_cash_amount} onChange={(e) => setApprovalForm((prev) => ({ ...prev, approved_cash_amount: e.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800" />
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Transfer</label>
                                            <input type="number" min="0" value={approvalForm.approved_transfer_amount} onChange={(e) => setApprovalForm((prev) => ({ ...prev, approved_transfer_amount: e.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800" />
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Lainnya</label>
                                            <input type="number" min="0" value={approvalForm.approved_other_amount} onChange={(e) => setApprovalForm((prev) => ({ ...prev, approved_other_amount: e.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800" />
                                        </div>
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-3">
                                        <div>
                                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Label Lainnya</label>
                                            <input value={approvalForm.approved_other_label} onChange={(e) => setApprovalForm((prev) => ({ ...prev, approved_other_label: e.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800" />
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Referensi</label>
                                            <input value={approvalForm.approval_reference} onChange={(e) => setApprovalForm((prev) => ({ ...prev, approval_reference: e.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800" />
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Waktu Bayar</label>
                                            <input type="datetime-local" value={approvalForm.paid_at} onChange={(e) => setApprovalForm((prev) => ({ ...prev, paid_at: e.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Catatan Approval</label>
                                        <textarea value={approvalForm.approval_notes} onChange={(e) => setApprovalForm((prev) => ({ ...prev, approval_notes: e.target.value }))} rows={3} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800" />
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            {isKitchenWorkspace ? "Bukti Pembayaran / Approval" : "Bukti Approval"}
                                        </label>
                                        <input
                                            type="file"
                                            accept="image/png,image/jpeg,image/jpg,image/webp"
                                            multiple
                                            onChange={(event) =>
                                                setApprovalForm((prev) => ({
                                                    ...prev,
                                                    approval_proof_photos: Array.from(event.target.files || []),
                                                }))
                                            }
                                            className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                                        />
                                        {approvalForm.approval_proof_photos?.length ? (
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {approvalForm.approval_proof_photos.map((file, index) => (
                                                    <span key={`${file.name}-${index}`} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                        {file.name}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className={`rounded-2xl border px-4 py-3 text-sm ${approvalBreakdownTotal === approvalTarget ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300" : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300"}`}>
                                        Total pembayaran: <span className="font-semibold">{formatCurrency(approvalBreakdownTotal)}</span> • Target approval: <span className="font-semibold">{formatCurrency(approvalTarget)}</span>
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Konfirmasi Password</label>
                                        <input type="password" autoComplete="new-password" value={approvalForm.password} onChange={(e) => setApprovalForm((prev) => ({ ...prev, password: e.target.value }))} className={`h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm dark:bg-slate-800 ${errors?.password ? "border-rose-300 dark:border-rose-800" : "border-slate-200 dark:border-slate-700"}`} placeholder="Masukkan password Anda" required />
                                        {errors?.password ? (
                                            <p className="mt-1 text-xs text-rose-600 dark:text-rose-300">{errors.password}</p>
                                        ) : (
                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Masukkan password akun Anda untuk mengkonfirmasi approval.</p>
                                        )}
                                    </div>
                                    </div>

                                    <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
                                        <button type="button" onClick={closeModal} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">
                                            Batal
                                        </button>
                                        <button type="submit" disabled={approvalBreakdownTotal !== approvalTarget} className="rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
                                            Simpan Approval
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <form onSubmit={submitReject} className="flex min-h-0 flex-1 flex-col">
                                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Alasan Penolakan</label>
                                        <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={4} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800" required />
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Konfirmasi Password</label>
                                        <input type="password" autoComplete="new-password" value={rejectionPassword} onChange={(e) => setRejectionPassword(e.target.value)} className={`h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm dark:bg-slate-800 ${errors?.password ? "border-rose-300 dark:border-rose-800" : "border-slate-200 dark:border-slate-700"}`} placeholder="Masukkan password Anda" required />
                                        {errors?.password ? (
                                            <p className="mt-1 text-xs text-rose-600 dark:text-rose-300">{errors.password}</p>
                                        ) : (
                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Masukkan password akun Anda untuk mengkonfirmasi penolakan.</p>
                                        )}
                                    </div>
                                    </div>
                                    <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
                                        <button type="button" onClick={closeModal} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">
                                            Batal
                                        </button>
                                        <button type="submit" className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white">
                                            Tolak Pengajuan
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </>
    );
}

Index.layout = (page) =>
    page.props?.auth?.user?.preferred_workspace === "kitchen" ? (
        <KitchenLayout children={page} />
    ) : (
        <DashboardLayout children={page} />
    );
