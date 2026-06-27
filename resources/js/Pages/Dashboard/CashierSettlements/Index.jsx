import React, { useEffect, useMemo, useState } from "react";
import { Head, Link, router, usePage } from "@inertiajs/react";
import toast from "react-hot-toast";
import DashboardLayout from "@/Layouts/DashboardLayout";
import KitchenLayout from "@/Layouts/KitchenLayout";
import Modal from "@/Components/Dashboard/Modal";
import Pagination from "@/Components/Dashboard/Pagination";
import {
    IconCashBanknote,
    IconCheck,
    IconChevronDown,
    IconChevronUp,
    IconClockHour4,
    IconFileExport,
    IconInfoCircle,
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

const paymentMethodLabel = (value) => {
    const labels = {
        cash: "Tunai",
        qris: "QRIS",
        transfer: "Transfer",
        card: "Kartu",
        midtrans: "Midtrans",
        xendit: "Xendit",
    };

    return labels[value] || value || "-";
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
    walletFilters = {},
    summary = {},
    requests = {},
    cashiers = [],
    shiftOptions = [],
    recipientOptions = [],
    defaultRecipientId = null,
    canApprove = false,
    canCreateRequest = false,
    wallet = null,
    walletTransactions = {},
}) {
    const page = usePage();
    const { auth, errors, flash } = page.props;
    const isKitchenWorkspace = auth?.user?.preferred_workspace === "kitchen";
    const isTenantRequestMode = Boolean(canCreateRequest);
    const [showHelpModal, setShowHelpModal] = useState(false);

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash]);
    const requestPanelTitle = isTenantRequestMode
        ? "Ajukan Penarikan Dana Tenant"
        : "Approval Penarikan Tenant";
    const requestPanelDescription = isTenantRequestMode
        ? "Pemilik tenant dapat melihat saldo hasil penjualan yang sudah selesai diantar, lalu mengajukan pencairan ke owner outlet."
        : "Admin outlet hanya meninjau, menyetujui, atau menolak pengajuan yang dibuat tenant. Admin tidak membuat pengajuan dari halaman ini.";
    const shiftFieldLabel = isTenantRequestMode
        ? "Shift Penjualan"
        : "Shift Kasir";
    const shiftPlaceholder = isTenantRequestMode
        ? "Pilih shift penjualan"
        : "Pilih shift";
    const recipientFieldLabel = isTenantRequestMode
        ? "Penerima Pencairan"
        : "Tujuan Admin / Penerima";
    const notesFieldLabel = isTenantRequestMode
        ? "Catatan Pengajuan"
        : "Catatan Pengajuan";
    const notesPlaceholder = isTenantRequestMode
        ? "Contoh: mohon pencairan sebagian ke rekening tenant, sisanya cash"
        : "Opsional";
    const submitRequestLabel = isTenantRequestMode
        ? "Ajukan Penarikan Dana"
        : "Ajukan Setoran";
    const activeTab = useMemo(() => {
        const querySource =
            page.url && page.url.includes("?")
                ? page.url.slice(page.url.indexOf("?"))
                : typeof window !== "undefined"
                  ? window.location.search
                  : "";

        if (!querySource) {
            return isTenantRequestMode ? "balance" : "requests";
        }

        const requestedTab = new URLSearchParams(querySource).get("tab");

        if (requestedTab && ["balance", "request", "transactions"].includes(requestedTab)) {
            return requestedTab;
        }

        return isTenantRequestMode ? "balance" : "requests";
    }, [isTenantRequestMode, page.url]);
    const [filterData, setFilterData] = useState({
        ...defaultFilters,
        q: walletFilters?.q ?? "",
        cashier_id: walletFilters?.cashier_id ?? "",
        date_from: walletFilters?.date_from ?? "",
        date_to: walletFilters?.date_to ?? "",
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
    const [walletDetailModal, setWalletDetailModal] = useState({
        open: false,
        transaction: null,
    });
    const [approvalForm, setApprovalForm] = useState(defaultApprovalForm);
    const [rejectionReason, setRejectionReason] = useState("");
    const [rejectionPassword, setRejectionPassword] = useState("");

    useEffect(() => {
        setFilterData({
            ...defaultFilters,
            q: walletFilters?.q ?? "",
            cashier_id: walletFilters?.cashier_id ?? "",
            date_from: walletFilters?.date_from ?? "",
            date_to: walletFilters?.date_to ?? "",
        });
    }, [walletFilters]);

    const rows = requests?.data ?? [];
    const links = requests?.links ?? [];
    const walletRows = walletTransactions?.data ?? [];
    const walletLinks = walletTransactions?.links ?? [];
    const isWalletReturnDetail =
        walletDetailModal.transaction?.entry_type === "sales_return";
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
        isTenantRequestMode &&
        createData.requested_amount !== "" &&
        kitchenRequestedAmount > kitchenAvailableBalance;

    const applyFilters = (event) => {
        event.preventDefault();
        router.get(route("cashier-settlements.index"), { ...filterData, tab: "transactions" }, {
            preserveScroll: true,
            preserveState: true,
        });
    };

    const resetFilters = () => {
        setFilterData(defaultFilters);
        router.get(route("cashier-settlements.index"), { tab: "transactions" }, {
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

    const openWalletDetailModal = (transaction) => {
        setWalletDetailModal({
            open: true,
            transaction,
        });
    };

    const closeWalletDetailModal = () => {
        setWalletDetailModal({
            open: false,
            transaction: null,
        });
    };

    return (
        <>
            <Head title={isTenantRequestMode ? "Penarikan Dana Tenant" : "Approval Penarikan Tenant"} />

            <div className="space-y-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            {isTenantRequestMode ? "Penarikan Dana Tenant" : "Approval Penarikan Tenant"}
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {isTenantRequestMode
                                ? "Ajukan pencairan dana tenant dari saldo yang tersedia."
                                : "Tinjau pengajuan tenant lalu setujui atau tolak."}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setShowHelpModal(true)}
                            className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200 dark:hover:bg-blue-950/40"
                        >
                            <IconInfoCircle size={16} />
                            Bantuan
                        </button>
                    </div>
                </div>

                {isTenantRequestMode ? (
                    <div className="rounded-3xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
                        <div className="grid gap-2 md:grid-cols-3">
                            {[
                                {
                                    key: "balance",
                                    label: "Saldo",
                                    description: "Ringkasan saldo, piutang, dan pencairan tenant.",
                                    icon: <IconCashBanknote size={16} />,
                                },
                                {
                                    key: "request",
                                    label: "Ajukan Penarikan Dana Tenant",
                                    description: "Form pengajuan dan riwayat request tenant.",
                                    icon: <IconFileExport size={16} />,
                                },
                                {
                                    key: "transactions",
                                    label: "Transaksi Masuk ke Saldo",
                                    description: "Daftar aktivitas saldo dengan filter detail dan pagination.",
                                    icon: <IconReceipt2 size={16} />,
                                },
                            ].map((tab) => {
                                const isActive = activeTab === tab.key;

                                const href = route("cashier-settlements.index", {
                                    ...(tab.key === "transactions"
                                        ? {
                                              q: walletFilters?.q ?? "",
                                              cashier_id: walletFilters?.cashier_id ?? "",
                                              date_from: walletFilters?.date_from ?? "",
                                              date_to: walletFilters?.date_to ?? "",
                                          }
                                        : {}),
                                    tab: tab.key,
                                });

                                return (
                                    <Link
                                        key={tab.key}
                                        href={href}
                                        preserveScroll
                                        preserveState
                                        className={`rounded-2xl border px-4 py-4 text-left transition ${
                                            isActive
                                                ? "border-primary-200 bg-primary-50 text-primary-900 dark:border-primary-900/40 dark:bg-primary-950/20 dark:text-primary-100"
                                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 text-sm font-semibold">
                                            {tab.icon}
                                            {tab.label}
                                        </div>
                                        <p className="mt-2 text-xs opacity-75">{tab.description}</p>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ) : null}

                {(!isTenantRequestMode || activeTab === "request") ? (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <SummaryCard title="Menunggu Approval" value={String(summary?.pending_count ?? 0)} description="Pengajuan yang belum divalidasi" icon={<IconClockHour4 size={20} />} tone="amber" />
                        <SummaryCard title="Disetujui" value={String(summary?.approved_count ?? 0)} description="Pengajuan yang sudah dibayar" icon={<IconCheck size={20} />} tone="emerald" />
                        <SummaryCard title="Total Pending" value={formatCurrency(summary?.requested_total ?? 0)} description="Nominal pengajuan yang menunggu approval" icon={<IconReceipt2 size={20} />} tone="blue" />
                        <SummaryCard title="Total Disetujui" value={formatCurrency(summary?.approved_total ?? 0)} description="Nominal sudah dibayar" icon={<IconCashBanknote size={20} />} tone="slate" />
                    </div>
                ) : null}

                {isTenantRequestMode && wallet && activeTab === "balance" ? (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <SummaryCard title="Saldo Masuk Tenant" value={formatCurrency(wallet.tenant_sales_total ?? 0)} description="Hak tenant yang menjadi dasar saldo dan pencairan" icon={<IconReceipt2 size={20} />} tone="emerald" />
                        <SummaryCard title="Piutang ke Owner" value={formatCurrency(wallet.receivable_total ?? 0)} description="Hak tenant yang belum dicairkan penuh" icon={<IconClockHour4 size={20} />} tone="amber" />
                        <SummaryCard title="Menunggu Approval" value={formatCurrency(wallet.pending_total ?? 0)} description="Pengajuan penarikan yang masih diproses" icon={<IconShieldCheck size={20} />} tone="blue" />
                        <SummaryCard title="Saldo Tersedia" value={formatCurrency(wallet.available_balance ?? 0)} description="Batas nominal yang bisa diajukan saat ini" icon={<IconCashBanknote size={20} />} tone="slate" />
                    </div>
                ) : null}

                {(!isTenantRequestMode || activeTab === "request") ? (
                <div className={`grid gap-6 ${canCreateRequest ? "xl:grid-cols-[0.95fr,1.05fr]" : "xl:grid-cols-[0.7fr,1.3fr]"}`}>
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
                            {isTenantRequestMode ? (
                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                            Hak Tenant
                                        </p>
                                        <p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
                                            {formatCurrency(wallet?.tenant_sales_total ?? 0)}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                            Ini adalah dasar saldo tenant sebelum bagian markup owner
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
                                            Promo tenant {formatCurrency(wallet?.pricing_discount_total ?? 0)}
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

                            {isTenantRequestMode ? (
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Nominal Penarikan
                                    </label>
                                    <div className="flex flex-col gap-3 sm:flex-row">
                                        <div className="w-full">
                                            <div
                                                className={`flex h-11 overflow-hidden rounded-xl border dark:bg-slate-800 ${
                                                    kitchenAmountExceedsBalance || errors.requested_amount
                                                        ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/20 dark:text-rose-300"
                                                        : "border-slate-200 bg-slate-50 dark:border-slate-700"
                                                }`}
                                            >
                                                <div className="flex items-center border-r border-inherit px-4 text-sm font-semibold">
                                                    Rp
                                                </div>
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
                                                    className="h-full w-full bg-transparent px-4 text-sm outline-none"
                                                    placeholder="Masukkan nominal yang ingin dicairkan"
                                                    required
                                                />
                                            </div>
                                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                                Nilai terbaca: {formatCurrency(kitchenRequestedAmount || 0)}
                                            </p>
                                        </div>
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

                            {!isTenantRequestMode ? (
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
                                    {isTenantRequestMode ? "Lampiran Pengajuan" : "Bukti Setoran"}
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

                            {!isTenantRequestMode && selectedShift ? (
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
                                    {!isTenantRequestMode ? (
                                        <div className="rounded-2xl bg-amber-50 p-4 dark:bg-amber-950/20">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-amber-500">
                                                Markup Owner
                                            </p>
                                            <p className="mt-2 text-lg font-bold text-amber-700 dark:text-amber-300">
                                                {formatCurrency(selectedShift.markup_total)}
                                            </p>
                                            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                                                Produk {formatCurrency(selectedShift.owner_product_markup_total || 0)} • Topping {formatCurrency(selectedShift.owner_topping_markup_total || 0)}
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
                                disabled={isTenantRequestMode ? kitchenRequestedAmount <= 0 || kitchenAmountExceedsBalance : !selectedShift}
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
                </div>
                ) : null}

                {(!isTenantRequestMode || activeTab === "request") ? (
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
                                                        Dasar {formatCurrency(row.pricing_basis_total ?? row.base_sales_total)} • markup owner {formatCurrency(row.pricing_adjustment_total ?? 0)}
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
                            {isTenantRequestMode
                                ? "Belum ada pengajuan penarikan dana tenant."
                                : "Belum ada pengajuan setoran kasir."}
                        </div>
                    )}
                </div>
                ) : null}

                {isTenantRequestMode && activeTab === "transactions" ? (
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-4">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                Transaksi Masuk ke Saldo
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Menampilkan {walletTransactions?.from || 0}-{walletTransactions?.to || 0} dari {walletTransactions?.total || 0} aktivitas saldo. Fokus utama tabel ini adalah hak tenant yang bertambah atau berkurang.
                            </p>
                        </div>

                        <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                            <div className="mb-4">
                                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                                    Filter Detail
                                </h3>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                    Advanced search untuk invoice, nomor allocation, customer, kasir, dan rentang tanggal aktivitas saldo.
                                </p>
                            </div>
                            <form onSubmit={applyFilters} className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                                <div className="xl:col-span-2">
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Cari Invoice / Allocation / Customer
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
                                            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 pr-10 text-sm dark:border-slate-700 dark:bg-slate-900"
                                            placeholder="Contoh: TRX-..., TA-..., nama customer, kasir"
                                        />
                                        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400">
                                            <IconSearch size={16} />
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Kasir
                                    </label>
                                    <select
                                        value={filterData.cashier_id}
                                        onChange={(event) =>
                                            setFilterData((prev) => ({
                                                ...prev,
                                                cashier_id: event.target.value,
                                            }))
                                        }
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm dark:border-slate-700 dark:bg-slate-900"
                                    >
                                        <option value="">Semua kasir</option>
                                        {cashiers.map((cashier) => (
                                            <option key={cashier.id} value={String(cashier.id)}>
                                                {cashier.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Dari Tanggal
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
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm dark:border-slate-700 dark:bg-slate-900"
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Sampai Tanggal
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
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm dark:border-slate-700 dark:bg-slate-900"
                                    />
                                </div>
                                <div className="xl:col-span-5 flex flex-wrap gap-2">
                                    <button type="submit" className="rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white">
                                        Terapkan Filter
                                    </button>
                                    <button type="button" onClick={resetFilters} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">
                                        Reset Filter
                                    </button>
                                </div>
                            </form>
                        </div>

                        {walletRows.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-100 dark:border-slate-800">
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Aktivitas</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Kasir</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Hak Tenant</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Promo</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Selesai</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {walletRows.map((row) => (
                                            <tr key={row.id}>
                                                <td className="px-4 py-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => openWalletDetailModal(row)}
                                                        className="font-semibold text-left text-primary-700 hover:underline dark:text-primary-300"
                                                    >
                                                        {row.invoice}
                                                    </button>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                                        {row.allocation_number} • {row.customer_name}
                                                    </div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                                        {paymentMethodLabel(row.payment_method)} • {row.entry_type === "sales_return" ? "retur" : (row.payment_status || "-")}
                                                    </div>
                                                    <div className="mt-1 inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                                        {row.entry_type === "sales_return" ? "Retur" : "Masuk Saldo"}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                                                    <div>{row.cashier_name}</div>
                                                    {row.tenant_outlet?.name ? (
                                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                                            {row.tenant_outlet.name}
                                                        </div>
                                                    ) : null}
                                                </td>
                                                <td className={`px-4 py-3 text-right font-semibold ${row.tenant_sales_total < 0 ? "text-danger-600 dark:text-danger-300" : "text-emerald-600 dark:text-emerald-300"}`}>
                                                    {formatCurrency(row.tenant_sales_total)}
                                                    {row.entry_type !== "sales_return" ? (
                                                        <div className="mt-1 text-[11px] font-normal text-slate-500 dark:text-slate-400">
                                                            Referensi customer {formatCurrency(row.gross_sales_total)}
                                                        </div>
                                                    ) : (
                                                        <div className="mt-1 text-[11px] font-normal text-slate-500 dark:text-slate-400">
                                                            Pengurang dari retur customer {formatCurrency(row.gross_sales_total)}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className={`px-4 py-3 text-right ${row.pricing_discount_total < 0 ? "text-danger-600 dark:text-danger-300" : "text-slate-700 dark:text-slate-300"}`}>
                                                    {formatCurrency(row.pricing_discount_total || 0)}
                                                </td>
                                                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                                                    <div>{formatDateTime(row.delivered_at)}</div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                                        {row.entry_type === "sales_return"
                                                            ? `Retur dibuat ${formatDateTime(row.created_at)}`
                                                            : `Dibuat ${formatDateTime(row.created_at)}`}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="mt-4 flex justify-end">
                                    {walletTransactions?.last_page > 1 ? <Pagination links={walletLinks} /> : null}
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                                Belum ada transaksi delivered yang masuk ke saldo tenant.
                            </div>
                        )}
                    </div>
                ) : null}

                {walletDetailModal.open ? (
                    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 p-4">
                        <div className="flex min-h-full items-center justify-center py-2">
                            <div className="flex w-full max-w-4xl max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
                                <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
                                    <div>
                                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                                            {isWalletReturnDetail
                                                ? "Detail Retur Tenant"
                                                : "Detail Transaksi Tenant"}
                                        </h2>
                                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                            {walletDetailModal.transaction?.invoice} • {walletDetailModal.transaction?.customer_name}
                                        </p>
                                        {isWalletReturnDetail ? (
                                            <div className="mt-2 inline-flex items-center rounded-full bg-danger-50 px-2 py-1 text-[11px] font-semibold text-danger-700 dark:bg-danger-950/30 dark:text-danger-300">
                                                Retur mengurangi saldo tenant
                                            </div>
                                        ) : null}
                                    </div>
                                    <button type="button" onClick={closeWalletDetailModal} className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
                                        Tutup
                                    </button>
                                </div>
                                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                                    <div className="grid gap-3 md:grid-cols-4">
                                        <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                                {isWalletReturnDetail ? "Omzet Dikurangi" : "Omzet Setelah Promo"}
                                            </p>
                                            <p className={`mt-2 text-lg font-bold ${isWalletReturnDetail ? "text-danger-700 dark:text-danger-300" : "text-slate-900 dark:text-white"}`}>
                                                {formatCurrency(walletDetailModal.transaction?.gross_sales_total ?? 0)}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-950/20">
                                            <p className={`text-xs font-semibold uppercase tracking-wide ${isWalletReturnDetail ? "text-danger-500" : "text-emerald-500"}`}>
                                                {isWalletReturnDetail ? "Hak Tenant Dikurangi" : "Hak Tenant"}
                                            </p>
                                            <p className={`mt-2 text-lg font-bold ${isWalletReturnDetail ? "text-danger-700 dark:text-danger-300" : "text-emerald-700 dark:text-emerald-300"}`}>
                                                {formatCurrency(walletDetailModal.transaction?.tenant_sales_total ?? 0)}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl bg-amber-50 p-4 dark:bg-amber-950/20">
                                            <p className={`text-xs font-semibold uppercase tracking-wide ${isWalletReturnDetail ? "text-danger-500" : "text-amber-500"}`}>
                                                {isWalletReturnDetail ? "Markup Owner Dikurangi" : "Markup Owner"}
                                            </p>
                                            <p className={`mt-2 text-lg font-bold ${isWalletReturnDetail ? "text-danger-700 dark:text-danger-300" : "text-amber-700 dark:text-amber-300"}`}>
                                                {formatCurrency(walletDetailModal.transaction?.owner_markup_total ?? 0)}
                                            </p>
                                            <p className={`mt-1 text-xs ${isWalletReturnDetail ? "text-danger-600 dark:text-danger-300" : "text-amber-700 dark:text-amber-300"}`}>
                                                Produk {formatCurrency(walletDetailModal.transaction?.owner_product_markup_total ?? 0)} • Topping {formatCurrency(walletDetailModal.transaction?.owner_topping_markup_total ?? 0)}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl bg-blue-50 p-4 dark:bg-blue-950/20">
                                            <p className={`text-xs font-semibold uppercase tracking-wide ${isWalletReturnDetail ? "text-danger-500" : "text-blue-500"}`}>
                                                {isWalletReturnDetail ? "Promo Dikurangi" : "Promo"}
                                            </p>
                                            <p className={`mt-2 text-lg font-bold ${isWalletReturnDetail ? "text-danger-700 dark:text-danger-300" : "text-blue-700 dark:text-blue-300"}`}>
                                                {formatCurrency(walletDetailModal.transaction?.pricing_discount_total ?? 0)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-5 overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-slate-100 dark:border-slate-800">
                                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Item</th>
                                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Qty</th>
                                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Harga Customer</th>
                                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Hak Tenant</th>
                                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Markup Owner</th>
                                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Diskon</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {(walletDetailModal.transaction?.details || []).map((detail) => (
                                                    <tr key={detail.id}>
                                                        <td className="px-4 py-3">
                                                            <div className="font-medium text-slate-900 dark:text-white">{detail.product_title}</div>
                                                            {detail.notes ? (
                                                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                                                    Catatan: {detail.notes}
                                                                </div>
                                                            ) : null}
                                                            {detail.modifiers?.length ? (
                                                                <div className="mt-2 space-y-1">
                                                                    {detail.modifiers.map((modifier) => (
                                                                        <div key={modifier.id} className="text-xs">
                                                                            <span className="text-slate-600 dark:text-slate-300 font-medium">
                                                                                {modifier.name} x{modifier.qty}
                                                                            </span>
                                                                            <span className="text-slate-500 dark:text-slate-400">
                                                                                {" "}• Total {formatCurrency(modifier.total_price)}
                                                                            </span>
                                                                            {(modifier.markup_price > 0 || modifier.base_price > 0) && (
                                                                                <span className="ml-1 text-xs">
                                                                                    <span className="text-emerald-600 dark:text-emerald-400">
                                                                                        (Tenant {formatCurrency(modifier.base_price * modifier.qty)}
                                                                                    </span>
                                                                                    {modifier.markup_price > 0 && (
                                                                                        <span className="text-amber-600 dark:text-amber-400">
                                                                                            {" "}+ Markup {formatCurrency(modifier.markup_price * modifier.qty)}
                                                                                        </span>
                                                                                    )}
                                                                                    <span className="text-emerald-600 dark:text-emerald-400">)</span>
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : null}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                                                            <span className={detail.qty < 0 ? "font-semibold text-danger-600 dark:text-danger-300" : ""}>
                                                                {detail.qty}
                                                            </span>
                                                        </td>
                                                        <td className={`px-4 py-3 text-right ${detail.line_total < 0 ? "font-semibold text-danger-600 dark:text-danger-300" : "text-slate-700 dark:text-slate-300"}`}>
                                                            <div>{formatCurrency(detail.line_total)}</div>
                                                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                                                Unit {formatCurrency(detail.customer_unit_price)}
                                                            </div>
                                                        </td>
                                                        <td className={`px-4 py-3 text-right font-semibold ${detail.tenant_net_total < 0 ? "text-danger-600 dark:text-danger-300" : "text-emerald-600 dark:text-emerald-300"}`}>
                                                            <div>{formatCurrency(detail.tenant_net_total)}</div>
                                                            <div className="text-xs font-normal text-slate-500 dark:text-slate-400">
                                                                Unit {formatCurrency(detail.tenant_base_unit_price)}
                                                            </div>
                                                        </td>
                                                        <td className={`px-4 py-3 text-right font-semibold ${detail.owner_net_total < 0 ? "text-danger-600 dark:text-danger-300" : "text-amber-600 dark:text-amber-300"}`}>
                                                            <div>{formatCurrency(detail.owner_net_total)}</div>
                                                            <div className="text-xs font-normal text-slate-500 dark:text-slate-400">
                                                                Unit {formatCurrency(detail.owner_markup_unit_price)}
                                                            </div>
                                                            <div className="text-xs font-normal text-slate-500 dark:text-slate-400">
                                                                Produk {formatCurrency(detail.owner_product_markup_total ?? 0)} • Topping {formatCurrency(detail.owner_topping_markup_total ?? 0)}
                                                            </div>
                                                        </td>
                                                        <td className={`px-4 py-3 text-right ${detail.discount_total < 0 ? "font-semibold text-danger-600 dark:text-danger-300" : "text-slate-700 dark:text-slate-300"}`}>
                                                            {formatCurrency(detail.discount_total || 0)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}

                {approvalModal.open ? (
                    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 p-4">
                        <div className="flex min-h-full items-center justify-center py-2">
                            <div className="flex w-full max-w-2xl max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
                            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
                                <div>
                                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                                        {approvalModal.mode === "approve"
                                            ? (isTenantRequestMode ? "Approve Pencairan Tenant" : "Approve Setoran Kasir")
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
                                            {isTenantRequestMode ? "Bukti Pembayaran / Approval" : "Bukti Approval"}
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

                <Modal
                    show={showHelpModal}
                    onClose={() => setShowHelpModal(false)}
                    title="Bantuan Penarikan Dana / Settlement"
                    maxWidth="2xl"
                >
                    <div className="space-y-5 text-sm text-slate-600 dark:text-slate-300">
                        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
                            <p className="font-semibold text-slate-900 dark:text-white">
                                Fungsi Halaman Settlement
                            </p>
                            <p className="mt-2">
                                Halaman ini digunakan untuk mengelola pengajuan pencairan dana tenant (foodcourt) atau setoran kasir. Tenant mengajukan penarikan, admin outlet menyetujui atau menolak.
                            </p>
                            <p className="mt-2">
                                Untuk tenant/dapur: halaman ini untuk mengajukan pencairan dana dari saldo penjualan yang sudah selesai diantar. Untuk admin: halaman ini untuk meninjau dan menyetujui pengajuan dari tenant.
                            </p>
                        </div>

                        <div>
                            <p className="font-semibold text-slate-900 dark:text-white">
                                Alur Kerja
                            </p>
                            <ol className="mt-2 list-decimal space-y-2 pl-5">
                                <li><strong>Tenant</strong> mengajukan penarikan dana dari saldo yang tersedia, bisa sebagian atau seluruhnya.</li>
                                <li><strong>Admin</strong> menerima notifikasi pengajuan, memeriksa nominal dan lampiran.</li>
                                <li>Admin bisa <strong>Approve</strong> (setujui) dengan mengisi rincian pembayaran: cash, transfer, atau metode lain.</li>
                                <li>Admin juga bisa <strong>Tolak</strong> pengajuan dengan alasan yang jelas.</li>
                                <li>Setelah approve, bukti pembayaran bisa dicetak dan diberikan ke tenant.</li>
                            </ol>
                        </div>

                        <div>
                            <p className="font-semibold text-slate-900 dark:text-white">
                                Kartu Ringkasan
                            </p>
                            <ul className="mt-2 list-disc space-y-1 pl-5">
                                <li><strong>Menunggu Approval</strong>: jumlah pengajuan yang belum diproses.</li>
                                <li><strong>Disetujui</strong>: pengajuan yang sudah dibayar.</li>
                                <li><strong>Total Pending</strong>: nominal total yang masih menunggu approval.</li>
                                <li><strong>Total Disetujui</strong>: nominal total yang sudah dibayarkan.</li>
                                <li>Untuk tenant: tambahan <strong>Saldo Masuk</strong>, <strong>Piutang</strong>, dan <strong>Saldo Tersedia</strong>.</li>
                            </ul>
                        </div>

                        <div>
                            <p className="font-semibold text-slate-900 dark:text-white">
                                Cara Menggunakan (Tenant)
                            </p>
                            <ol className="mt-2 list-decimal space-y-2 pl-5">
                                <li>Buka panel <strong>Ajukan Penarikan Dana Tenant</strong>.</li>
                                <li>Masukkan nominal yang ingin dicairkan (maksimal sesuai saldo tersedia).</li>
                                <li>Tambahkan catatan jika perlu (misal: rekening tujuan, metode pencairan).</li>
                                <li>Lampirkan bukti pendukung (opsional).</li>
                                <li>Klik <strong>Ajukan Penarikan Dana</strong>. Pengajuan akan masuk ke daftar riwayat.</li>
                                <li>Pantau status pengajuan di tabel riwayat sampai disetujui admin.</li>
                            </ol>
                        </div>

                        <div>
                            <p className="font-semibold text-slate-900 dark:text-white">
                                Cara Menggunakan (Admin)
                            </p>
                            <ol className="mt-2 list-decimal space-y-2 pl-5">
                                <li>Lihat daftar pengajuan di tabel <strong>Riwayat Pengajuan</strong>.</li>
                                <li>Untuk pengajuan <strong>Pending</strong>, klik <strong>Approve</strong>.</li>
                                <li>Isi rincian pembayaran: nominal approve, cash, transfer, lainnya, nama penerima, referensi, dan waktu bayar.</li>
                                <li>Total pembayaran (cash + transfer + lainnya) harus sama dengan nominal approve.</li>
                                <li>Masukkan password untuk konfirmasi, lalu klik <strong>Simpan Approval</strong>.</li>
                                <li>Setelah approve, klik <strong>Cetak</strong> untuk mencetak bukti pembayaran.</li>
                                <li>Untuk menolak, klik <strong>Tolak</strong>, isi alasan dan password.</li>
                            </ol>
                        </div>

                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                            <p className="font-semibold text-slate-900 dark:text-white">
                                Catatan Penting
                            </p>
                            <ul className="mt-2 list-disc space-y-1 pl-5">
                                <li>Tenant hanya bisa mengajukan penarikan maksimal sebesar <strong>saldo tersedia</strong>.</li>
                                <li>Admin tidak bisa membuat pengajuan - hanya tenant yang bisa mengajukan (mencegah fraud).</li>
                                <li>Approval memerlukan password admin untuk keamanan.</li>
                                <li>Setelah approve, status pengajuan tidak bisa diubah lagi.</li>
                                <li>Gunakan filter untuk mencari pengajuan berdasarkan status, pengaju, atau rentang tanggal.</li>
                                <li>Bukti pembayaran yang di-approve bisa dicetak langsung dari tabel riwayat.</li>
                            </ul>
                        </div>
                    </div>
                </Modal>
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
