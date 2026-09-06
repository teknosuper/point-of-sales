import React, { useEffect, useMemo, useState } from "react";
import { Head, Link, router, usePage } from "@inertiajs/react";
import toast from "react-hot-toast";
import DashboardLayout from "@/Layouts/DashboardLayout";
import KitchenLayout from "@/Layouts/KitchenLayout";
import Modal from "@/Components/Dashboard/Modal";
import Pagination from "@/Components/Dashboard/Pagination";
import {
    IconCalendar,
    IconCashBanknote,
    IconCheck,
    IconChevronDown,
    IconChevronUp,
    IconClockHour4,
    IconFileExport,
    IconInfoCircle,
    IconLayoutDashboard,
    IconPencilCheck,
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

const FieldError = ({ errors, name }) => {
    if (!errors) return null;
    let message = errors[name];
    if (!message && name) {
        const nestedKey = Object.keys(errors).find((key) => key.startsWith(`${name}.`));
        if (nestedKey) message = errors[nestedKey];
    }
    return message ? (
        <p className="mt-1 text-xs text-rose-600 dark:text-rose-300">{message}</p>
    ) : null;
};

const defaultFilters = {
    q: "",
    status: "",
    cashier_id: "",
    date_from: "",
    date_to: "",
    entry_type: "",
    payment_method: "",
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
    requestFilters = {},
    summary = {},
    requests = {},
    cashiers = [],
    outlets = [],
    shiftOptions = [],
    recipientOptions = [],
    defaultRecipientId = null,
    canApprove = false,
    canCreateRequest = false,
    wallet = null,
    walletTransactions = {},
    tenantAuditReport = null,
    auditDateFilters = {},
    ownerOverview = null,
    canViewMarkup = false,
}) {
    const page = usePage();
    const { auth, errors, flash, activeOutlet, availableOutlets = [] } = page.props;
    const isKitchenWorkspace = auth?.user?.preferred_workspace === "kitchen";
    const isTenantRequestMode = Boolean(canCreateRequest);
    const [showHelpModal, setShowHelpModal] = useState(false);
    const [showWalletFilterModal, setShowWalletFilterModal] = useState(false);
    const [auditDateFrom, setAuditDateFrom] = useState(auditDateFilters?.date_from ?? '');
    const [auditDateTo, setAuditDateTo] = useState(auditDateFilters?.date_to ?? '');

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
            return isTenantRequestMode ? "balance" : "request";
        }

        const requestedTab = new URLSearchParams(querySource).get("tab");

        if (requestedTab && ["balance", "request", "transactions", "overview", "audit"].includes(requestedTab)) {
            return requestedTab;
        }

        return isTenantRequestMode ? "balance" : "request";
    }, [isTenantRequestMode, page.url]);
    const [filterData, setFilterData] = useState({
        ...defaultFilters,
        q: walletFilters?.q ?? "",
        cashier_id: walletFilters?.cashier_id ?? "",
        date_from: walletFilters?.date_from ?? "",
        date_to: walletFilters?.date_to ?? "",
        entry_type: walletFilters?.entry_type ?? "",
        payment_method: walletFilters?.payment_method ?? "",
    });
    const [requestFilterData, setRequestFilterData] = useState({
        q: requestFilters?.q ?? "",
        status: requestFilters?.status ?? "",
        outlet_id: requestFilters?.outlet_id ?? "",
        date_from: requestFilters?.date_from ?? "",
        date_to: requestFilters?.date_to ?? "",
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
    const [tenantBreakdownModalOpen, setTenantBreakdownModalOpen] =
        useState(false);
    const [unallocatedModalOpen, setUnallocatedModalOpen] = useState(false);
    const [returnsModalOpen, setReturnsModalOpen] = useState(false);
    const [approvalForm, setApprovalForm] = useState(defaultApprovalForm);
    const [approving, setApproving] = useState(false);
    const [rejecting, setRejecting] = useState(false);
    const [rejectionReason, setRejectionReason] = useState("");
    const [rejectionPassword, setRejectionPassword] = useState("");
    const [repairingUnallocated, setRepairingUnallocated] = useState(false);
    const [unallocatedRows, setUnallocatedRows] = useState([]);
    const [unallocatedLoading, setUnallocatedLoading] = useState(false);
    const [unallocatedFilters, setUnallocatedFilters] = useState({
        q: "",
        date_from: "",
        date_to: "",
        payment_method: "",
        payment_status: "",
    });
    const [unallocatedPage, setUnallocatedPage] = useState(1);
    const [unallocatedLastPage, setUnallocatedLastPage] = useState(1);
    const [returnsRows, setReturnsRows] = useState([]);
    const [returnsLoading, setReturnsLoading] = useState(false);
    const [returnsFilters, setReturnsFilters] = useState({
        q: "",
        date_from: "",
        date_to: "",
    });
    const [returnsPage, setReturnsPage] = useState(1);
    const [returnsLastPage, setReturnsLastPage] = useState(1);

    useEffect(() => {
        setFilterData({
            ...defaultFilters,
            q: walletFilters?.q ?? "",
            cashier_id: walletFilters?.cashier_id ?? "",
            date_from: walletFilters?.date_from ?? "",
            date_to: walletFilters?.date_to ?? "",
            entry_type: walletFilters?.entry_type ?? "",
            payment_method: walletFilters?.payment_method ?? "",
        });
    }, [walletFilters]);

    useEffect(() => {
        setRequestFilterData({
            q: requestFilters?.q ?? "",
            status: requestFilters?.status ?? "",
            outlet_id: requestFilters?.outlet_id ?? "",
            date_from: requestFilters?.date_from ?? "",
            date_to: requestFilters?.date_to ?? "",
        });
    }, [requestFilters]);

    const rows = requests?.data ?? [];
    const links = requests?.links ?? [];
    const walletMonthRows = walletTransactions?.months?.data ?? [];
    const walletMonthLinks = walletTransactions?.months?.links ?? [];
    const walletMonthCurrentPage = walletTransactions?.months?.current_page ?? 1;
    const walletMonthPerPage = walletTransactions?.months?.per_page
        ? Number(walletTransactions?.months?.per_page)
        : walletMonthRows.length || 1;
    const walletSelectedMonth = walletTransactions?.selected_month ?? "";
    const walletSelectedMonthLabel = walletTransactions?.selected_month_label ?? null;
    const walletDayRows = walletTransactions?.days?.data ?? [];
    const walletDayLinks = walletTransactions?.days?.links ?? [];
    const walletDayCurrentPage = walletTransactions?.days?.current_page ?? 1;
    const walletDayPerPage = walletTransactions?.days?.per_page
        ? Number(walletTransactions?.days?.per_page)
        : walletDayRows.length || 1;
    const walletSelectedDay = walletTransactions?.selected_day ?? "";
    const walletSelectedDayLabel = walletTransactions?.selected_day_label ?? null;
    const walletRows = walletTransactions?.details?.data ?? [];
    const walletLinks = walletTransactions?.details?.links ?? [];
    const isWalletReturnDetail =
        walletDetailModal.transaction?.entry_type === "sales_return";
    const visibleTenantCount = useMemo(
        () =>
            availableOutlets.filter(
                (outlet) => (outlet?.outlet_type ?? "main") === "tenant"
            ).length,
        [availableOutlets]
    );
    const safeOwnerOverview = {
        completed_transactions_count:
            ownerOverview?.completed_transactions_count ?? 0,
        pending_kitchen_transactions_count:
            ownerOverview?.pending_kitchen_transactions_count ?? 0,
        unallocated_transactions_count:
            ownerOverview?.unallocated_transactions_count ?? 0,
        total_transactions_count: ownerOverview?.total_transactions_count ?? 0,
        completed_gross_sales_total:
            ownerOverview?.completed_gross_sales_total ?? 0,
        pending_kitchen_gross_sales_total:
            ownerOverview?.pending_kitchen_gross_sales_total ?? 0,
        total_gross_sales_total:
            ownerOverview?.total_gross_sales_total ?? 0,
        gross_sales_total: ownerOverview?.gross_sales_total ?? 0,
        tenant_rights_total: ownerOverview?.tenant_rights_total ?? 0,
        owner_markup_total: ownerOverview?.owner_markup_total ?? 0,
        should_withdraw_total: ownerOverview?.should_withdraw_total ?? 0,
        withdrawn_total: ownerOverview?.withdrawn_total ?? 0,
        pending_withdraw_total: ownerOverview?.pending_withdraw_total ?? 0,
        unwithdrawn_total: ownerOverview?.unwithdrawn_total ?? 0,
        returns_count: ownerOverview?.returns_count ?? 0,
        tenant_breakdown: Array.isArray(ownerOverview?.tenant_breakdown)
            ? ownerOverview.tenant_breakdown
            : [],
    };
    const ownerScopeLabel = isTenantRequestMode
        ? `Tenant ${activeOutlet?.name || "-"}`
        : `Semua tenant ${activeOutlet?.name || "outlet aktif"}`;
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
        router.get(route("cashier-settlements.index"), {
            ...filterData,
            tab: "transactions",
            wallet_month_page: 1,
            wallet_day_page: 1,
            wallet_detail_page: 1,
            wallet_month: "",
            wallet_day: "",
        }, {
            preserveScroll: true,
            preserveState: true,
        });
        setShowWalletFilterModal(false);
    };

    const resetFilters = () => {
        setFilterData(defaultFilters);
        router.get(route("cashier-settlements.index"), { tab: "transactions" }, {
            preserveScroll: true,
            preserveState: false,
            replace: true,
        });
        setShowWalletFilterModal(false);
    };

    const applyRequestFilters = (event) => {
        event.preventDefault();
        router.get(route("cashier-settlements.index"), {
            tab: "request",
            req_q: requestFilterData.q,
            req_status: requestFilterData.status,
            req_outlet_id: requestFilterData.outlet_id,
            req_date_from: requestFilterData.date_from,
            req_date_to: requestFilterData.date_to,
            requests_page: 1,
        }, {
            preserveScroll: true,
            preserveState: false,
        });
    };

    const resetRequestFilters = () => {
        setRequestFilterData({
            q: "",
            status: "",
            outlet_id: "",
            date_from: "",
            date_to: "",
        });
        router.get(route("cashier-settlements.index"), { tab: "request" }, {
            preserveScroll: true,
            preserveState: false,
            replace: true,
        });
    };

    const selectWalletMonth = (monthKey) => {
        router.get(route("cashier-settlements.index"), {
            ...filterData,
            tab: "transactions",
            wallet_month: monthKey,
            wallet_day: "",
            wallet_month_page: walletMonthCurrentPage,
            wallet_day_page: 1,
            wallet_detail_page: 1,
        }, {
            preserveScroll: true,
            preserveState: true,
            replace: true,
        });
    };

    const selectWalletDay = (dateKey) => {
        router.get(route("cashier-settlements.index"), {
            ...filterData,
            tab: "transactions",
            wallet_month: walletSelectedMonth,
            wallet_day: dateKey,
            wallet_month_page: walletMonthCurrentPage,
            wallet_day_page: walletDayCurrentPage,
            wallet_detail_page: 1,
        }, {
            preserveScroll: true,
            preserveState: true,
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
        if (!approvalModal.request || approving) return;

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

        setApproving(true);
        router.post(
            route("cashier-settlements.approve", approvalModal.request.id),
            formData,
            {
                preserveScroll: true,
                forceFormData: true,
                onSuccess: () => closeModal(),
                onError: (errors) => {
                    setApprovalForm((prev) => ({ ...prev, password: "" }));
                    const firstMessage = Object.values(errors || {}).find((value) => Array.isArray(value) ? value[0] : value);
                    if (firstMessage) toast.error(Array.isArray(firstMessage) ? firstMessage[0] : firstMessage);
                },
                onFinish: () => setApproving(false),
            }
        );
    };

    const submitReject = (event) => {
        event.preventDefault();
        if (!approvalModal.request || rejecting) return;
        setRejecting(true);
        router.patch(
            route("cashier-settlements.reject", approvalModal.request.id),
            { rejection_reason: rejectionReason, password: rejectionPassword },
            {
                preserveScroll: true,
                onSuccess: () => closeModal(),
                onError: (errors) => {
                    setRejectionPassword("");
                    const firstMessage = Object.values(errors || {}).find((value) => Array.isArray(value) ? value[0] : value);
                    if (firstMessage) toast.error(Array.isArray(firstMessage) ? firstMessage[0] : firstMessage);
                },
                onFinish: () => setRejecting(false),
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

    const repairUnallocated = () => {
        if (repairingUnallocated) return;

        setRepairingUnallocated(true);
        router.post(
            route("cashier-settlements.repair-unallocated"),
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success("Pembenaran alokasi tenant selesai.");
                    setUnallocatedModalOpen(false);
                },
                onError: () => toast.error("Gagal memperbaiki alokasi tenant."),
                onFinish: () => setRepairingUnallocated(false),
            }
        );
    };

    const openUnallocatedModal = () => {
        setUnallocatedModalOpen(true);
        setUnallocatedPage(1);
        loadUnallocatedTransactions({ ...unallocatedFilters, page: 1 });
    };

    const loadUnallocatedTransactions = async (params = {}) => {
        if (unallocatedLoading) return;
        setUnallocatedLoading(true);
        const searchParams = new URLSearchParams();
        searchParams.set("page", String(params.page ?? unallocatedPage));
        if (params.q !== undefined) searchParams.set("q", params.q);
        if (params.date_from) searchParams.set("date_from", params.date_from);
        if (params.date_to) searchParams.set("date_to", params.date_to);
        if (params.payment_method) searchParams.set("payment_method", params.payment_method);
        if (params.payment_status) searchParams.set("payment_status", params.payment_status);

        try {
            const response = await fetch(route("cashier-settlements.unallocated-transactions") + "?" + searchParams.toString(), {
                headers: { "X-Requested-With": "XMLHttpRequest" },
            });
            const json = await response.json();
            const data = Array.isArray(json?.data) ? json.data : [];
            setUnallocatedRows(data);
            setUnallocatedPage(json?.current_page ?? 1);
            setUnallocatedLastPage(json?.last_page ?? 1);
        } catch {
            toast.error("Gagal memuat data tanpa alokasi.");
        } finally {
            setUnallocatedLoading(false);
        }
    };

    const applyUnallocatedFilters = (event) => {
        event.preventDefault();
        setUnallocatedPage(1);
        loadUnallocatedTransactions({ ...unallocatedFilters, page: 1 });
    };

    const resetUnallocatedFilters = () => {
        const defaults = { q: "", date_from: "", date_to: "", payment_method: "", payment_status: "" };
        setUnallocatedFilters(defaults);
        setUnallocatedPage(1);
        loadUnallocatedTransactions({ ...defaults, page: 1 });
    };

    const openReturnsModal = () => {
        setReturnsModalOpen(true);
        setReturnsPage(1);
        loadReturnTransactions({ ...returnsFilters, page: 1 });
    };

    const loadReturnTransactions = async (params = {}) => {
        if (returnsLoading) return;
        setReturnsLoading(true);
        const searchParams = new URLSearchParams();
        searchParams.set("page", String(params.page ?? returnsPage));
        if (params.q !== undefined) searchParams.set("q", params.q);
        if (params.date_from) searchParams.set("date_from", params.date_from);
        if (params.date_to) searchParams.set("date_to", params.date_to);

        try {
            const response = await fetch(route("cashier-settlements.return-transactions") + "?" + searchParams.toString(), {
                headers: { "X-Requested-With": "XMLHttpRequest" },
            });
            const json = await response.json();
            const data = Array.isArray(json?.data) ? json.data : [];
            setReturnsRows(data);
            setReturnsPage(json?.current_page ?? 1);
            setReturnsLastPage(json?.last_page ?? 1);
        } catch {
            toast.error("Gagal memuat data retur.");
        } finally {
            setReturnsLoading(false);
        }
    };

    const applyReturnsFilters = (event) => {
        event.preventDefault();
        setReturnsPage(1);
        loadReturnTransactions({ ...returnsFilters, page: 1 });
    };

    const resetReturnsFilters = () => {
        const defaults = { q: "", date_from: "", date_to: "" };
        setReturnsFilters(defaults);
        setReturnsPage(1);
        loadReturnTransactions({ ...defaults, page: 1 });
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

                <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-100">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                                Melihat Sebagai
                            </p>
                            <p className="mt-1 font-semibold">
                                {auth?.user?.name || "-"}
                            </p>
                            <p className="mt-1 text-xs text-blue-700/80 dark:text-blue-200/80">
                                {isTenantRequestMode ? "Tenant / dapur" : "Owner / approver"}
                            </p>
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                                Outlet Aktif
                            </p>
                            <p className="mt-1 font-semibold">
                                {activeOutlet?.name || "-"}
                            </p>
                            <p className="mt-1 text-xs text-blue-700/80 dark:text-blue-200/80">
                                {activeOutlet?.code || activeOutlet?.outlet_type || "-"}
                            </p>
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                                Scope Data
                            </p>
                            <p className="mt-1 font-semibold">
                                {isTenantRequestMode
                                    ? "Data tenant aktif saja"
                                    : "Semua tenant yang terlihat owner"}
                            </p>
                            <p className="mt-1 text-xs text-blue-700/80 dark:text-blue-200/80">
                                {isTenantRequestMode
                                    ? "Saldo, request, dan mutasi hanya untuk tenant yang sedang aktif"
                                    : `Summary menggabungkan seluruh tenant yang termasuk akses owner. Tenant terdeteksi: ${visibleTenantCount}`}
                            </p>
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                                Cara Baca
                            </p>
                            <p className="mt-1 font-semibold">
                                {isTenantRequestMode ? "Saldo tenant" : "Approval owner"}
                            </p>
                            <p className="mt-1 text-xs text-blue-700/80 dark:text-blue-200/80">
                                {isTenantRequestMode
                                    ? "Angka saldo di sini adalah hak tenant yang bisa diajukan"
                                    : "Tab Ringkasan berisi angka penjualan & hak tenant; tab Riwayat Pengajuan berisi daftar request untuk divalidasi"}
                            </p>
                        </div>
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
                                {
                                    key: "audit",
                                    label: "Laporan Saldo",
                                    description: "Rekap saldo masuk, penarikan, retur, dan pengecekan selisih.",
                                    icon: <IconFileExport size={16} />,
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
                ) : (
                    <div className="rounded-3xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
                        <div className="grid gap-2 md:grid-cols-2">
                            {[
                                {
                                    key: "overview",
                                    label: "Ringkasan",
                                    description: "Ringkasan penjualan, hak tenant, dan aliran pencairan.",
                                    icon: <IconLayoutDashboard size={16} />,
                                },
                                {
                                    key: "request",
                                    label: "Riwayat Pengajuan",
                                    description: "Daftar pengajuan pencairan dengan filter dan pagination.",
                                    icon: <IconFileExport size={16} />,
                                },
                            ].map((tab) => {
                                const isActive = activeTab === tab.key;

                                const href = route("cashier-settlements.index", {
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
                )}

                {activeTab === "request" ? (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <SummaryCard title="Menunggu Approval" value={String(summary?.pending_count ?? 0)} description="Pengajuan yang belum divalidasi" icon={<IconClockHour4 size={20} />} tone="amber" />
                        <SummaryCard title="Disetujui" value={String(summary?.approved_count ?? 0)} description="Pengajuan yang sudah dibayar" icon={<IconCheck size={20} />} tone="emerald" />
                        <SummaryCard title="Total Pending" value={formatCurrency(summary?.requested_total ?? 0)} description="Nominal pengajuan yang menunggu approval" icon={<IconReceipt2 size={20} />} tone="blue" />
                        <SummaryCard title="Total Disetujui" value={formatCurrency(summary?.approved_total ?? 0)} description="Nominal sudah dibayar" icon={<IconCashBanknote size={20} />} tone="slate" />
                    </div>
                ) : null}

                {!isTenantRequestMode && activeTab === "overview" && ownerOverview ? (
                    <div className="space-y-6">
                        <div>
                            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Penjualan & Hak Tenant
                            </h3>
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                <SummaryCard title="Total Omzet" value={formatCurrency((safeOwnerOverview.completed_gross_sales_total || 0) + (safeOwnerOverview.pending_kitchen_gross_sales_total || 0))} description={`Selesai ${formatCurrency(safeOwnerOverview.completed_gross_sales_total)} • Belum selesai ${formatCurrency(safeOwnerOverview.pending_kitchen_gross_sales_total)}`} icon={<IconCashBanknote size={20} />} tone="slate" />
                                <SummaryCard title="Total Transaksi" value={String(safeOwnerOverview.total_transactions_count)} description={`Selesai ${safeOwnerOverview.completed_transactions_count} • Belum selesai ${safeOwnerOverview.pending_kitchen_transactions_count}`} icon={<IconReceipt2 size={20} />} tone="blue" />
                                {canViewMarkup && (
                                    <SummaryCard title="Markup Owner" value={formatCurrency(safeOwnerOverview.owner_markup_total)} description="Hak owner dari markup produk dan topping tenant" icon={<IconUserDollar size={20} />} tone="emerald" />
                                )}
                                <button
                                    type="button"
                                    onClick={() => setTenantBreakdownModalOpen(true)}
                                    className="text-left"
                                >
                                    <SummaryCard title="Hak Tenant Siap Withdraw" value={formatCurrency(safeOwnerOverview.tenant_rights_total)} description="Hak bersih tenant dari transaksi selesai (setelah markup owner & retur). Klik untuk rincian per tenant." icon={<IconShieldCheck size={20} />} tone="blue" />
                                </button>
                            </div>
                        </div>

                        <div>
                            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Aliran Pencairan Tenant
                            </h3>
                            <div className="grid gap-4 md:grid-cols-3">
                                <SummaryCard title="Seharusnya Di-Withdraw" value={formatCurrency(safeOwnerOverview.should_withdraw_total)} description="Akumulasi hak tenant yang layak dicairkan" icon={<IconChevronUp size={20} />} tone="slate" />
                                <SummaryCard title="Sudah Di-Withdraw" value={formatCurrency(safeOwnerOverview.withdrawn_total)} description="Pengajuan yang sudah disetujui dan dibayar ke tenant" icon={<IconCheck size={20} />} tone="emerald" />
                                <SummaryCard title="Belum Di-Withdraw" value={formatCurrency(safeOwnerOverview.unwithdrawn_total)} description={`Sisa hak tenant yang belum dibayar • Pending approval ${formatCurrency(safeOwnerOverview.pending_withdraw_total)}`} icon={<IconX size={20} />} tone="rose" />
                            </div>
                        </div>

                        <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Kualitas Data Alokasi
                            </h3>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Periksa transaksi yang belum tercatat alokasi atau mengurangi hak tenant.
                            </p>
                            <div className="mt-4 grid gap-3 md:grid-cols-3">
                                <button
                                    type="button"
                                    onClick={openReturnsModal}
                                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                                >
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">Retur</p>
                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Transaksi retur yang mengurangi penghasilan tenant</p>
                                    </div>
                                    <span className="rounded-full bg-rose-50 px-3 py-1 text-sm font-bold text-rose-600 dark:bg-rose-950/30 dark:text-rose-300">{safeOwnerOverview.returns_count}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={openUnallocatedModal}
                                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                                >
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">Tanpa Alokasi</p>
                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Transaksi yang belum punya alokasi tenant</p>
                                    </div>
                                    <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-bold text-amber-600 dark:bg-amber-950/30 dark:text-amber-300">{safeOwnerOverview.unallocated_transactions_count}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={repairUnallocated}
                                    disabled={repairingUnallocated}
                                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                                >
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">Perbaiki Alokasi</p>
                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{repairingUnallocated ? "Memperbaiki alokasi tenant..." : "Scan & perbaiki transaksi tanpa alokasi"}</p>
                                    </div>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                                        <IconPencilCheck size={14} />
                                        {repairingUnallocated ? "Memproses" : "Perbaiki"}
                                    </span>
                                </button>
                            </div>
                        </div>
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

                {activeTab === "request" ? (
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
                                    {!isTenantRequestMode && canViewMarkup ? (
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

                {activeTab === "request" ? (
                <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                Riwayat Pengajuan
                            </h2>
                            <div className="mt-2 inline-flex rounded-full bg-primary-100 px-3 py-1 text-[11px] font-semibold text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                                Scope: {ownerScopeLabel}
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Menampilkan {requests?.from || 0}-{requests?.to || 0} dari {requests?.total || 0} pengajuan.
                            </p>
                        </div>
                        {requests?.last_page > 1 ? <Pagination links={links} /> : null}
                    </div>

                    <form
                        onSubmit={applyRequestFilters}
                        className="mb-5 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50 sm:grid-cols-2 lg:grid-cols-5"
                    >
                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Cari</label>
                            <input
                                type="text"
                                value={requestFilterData.q}
                                onChange={(event) =>
                                    setRequestFilterData((prev) => ({ ...prev, q: event.target.value }))
                                }
                                placeholder="No. pengajuan / pengaju / catatan"
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Status</label>
                            <select
                                value={requestFilterData.status}
                                onChange={(event) =>
                                    setRequestFilterData((prev) => ({ ...prev, status: event.target.value }))
                                }
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                            >
                                <option value="">Semua status</option>
                                <option value="pending">Menunggu Approval</option>
                                <option value="approved">Disetujui</option>
                                <option value="rejected">Ditolak</option>
                                <option value="cancelled">Dibatalkan</option>
                            </select>
                        </div>
                        {!isTenantRequestMode ? (
                            <div>
                                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Outlet</label>
                                <select
                                    value={requestFilterData.outlet_id}
                                    onChange={(event) =>
                                        setRequestFilterData((prev) => ({ ...prev, outlet_id: event.target.value }))
                                    }
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                >
                                    <option value="">Semua outlet</option>
                                    {outlets.map((outlet) => (
                                        <option key={outlet.id} value={String(outlet.id)}>
                                            {outlet.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : null}
                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Dari Tanggal</label>
                            <input
                                type="date"
                                value={requestFilterData.date_from}
                                onChange={(event) =>
                                    setRequestFilterData((prev) => ({ ...prev, date_from: event.target.value }))
                                }
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Sampai Tanggal</label>
                            <input
                                type="date"
                                value={requestFilterData.date_to}
                                onChange={(event) =>
                                    setRequestFilterData((prev) => ({ ...prev, date_to: event.target.value }))
                                }
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                            />
                        </div>
                        <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-5">
                            <button
                                type="submit"
                                className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700"
                            >
                                <IconSearch size={15} />
                                Terapkan Filter
                            </button>
                            <button
                                type="button"
                                onClick={resetRequestFilters}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                <IconX size={15} />
                                Reset
                            </button>
                        </div>
                    </form>

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
                                                Dasar {formatCurrency(row.pricing_basis_total ?? row.base_sales_total)}{canViewMarkup ? ` • markup owner ${formatCurrency(row.pricing_adjustment_total ?? 0)}` : ""}
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
                            <div className="mt-2 inline-flex rounded-full bg-primary-100 px-3 py-1 text-[11px] font-semibold text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                                Scope: {ownerScopeLabel}
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Breakdown dibuat per bulan, per hari, lalu detail transaksi agar mutasi saldo tenant lebih mudah dibaca dan diaudit.
                            </p>
                        </div>

                        <div className="mb-5 flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setShowWalletFilterModal(true)}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                <IconSearch size={16} />
                                Buka Filter Transaksi
                            </button>
                        </div>

                        {showWalletFilterModal ? (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
                            <div className="w-full max-w-5xl rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
                                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
                                    <div>
                                        <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                                            Filter Detail Transaksi Saldo
                                        </h3>
                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                            Advanced search untuk invoice, allocation, customer, kasir, tanggal, jenis aktivitas, dan metode bayar.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowWalletFilterModal(false)}
                                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                    >
                                        <IconX size={18} />
                                    </button>
                                </div>
                                <div className="max-h-[80vh] overflow-y-auto px-6 py-5">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                            <div className="mb-4">
                                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                                    Filter Detail
                                </h3>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                    Advanced search untuk invoice, nomor allocation, customer, kasir, dan rentang tanggal aktivitas saldo.
                                </p>
                            </div>
                            <form onSubmit={applyFilters} className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
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
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Jenis Aktivitas
                                    </label>
                                    <select
                                        value={filterData.entry_type}
                                        onChange={(event) =>
                                            setFilterData((prev) => ({
                                                ...prev,
                                                entry_type: event.target.value,
                                            }))
                                        }
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm dark:border-slate-700 dark:bg-slate-900"
                                    >
                                        <option value="">Semua aktivitas</option>
                                        <option value="allocation">Masuk saldo</option>
                                        <option value="sales_return">Retur</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Metode Bayar
                                    </label>
                                    <select
                                        value={filterData.payment_method}
                                        onChange={(event) =>
                                            setFilterData((prev) => ({
                                                ...prev,
                                                payment_method: event.target.value,
                                            }))
                                        }
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm dark:border-slate-700 dark:bg-slate-900"
                                    >
                                        <option value="">Semua metode</option>
                                        <option value="cash">Tunai</option>
                                        <option value="qris">QRIS</option>
                                        <option value="transfer">Transfer</option>
                                        <option value="card">Kartu</option>
                                        <option value="midtrans">Midtrans</option>
                                        <option value="xendit">Xendit</option>
                                    </select>
                                </div>
                                <div className="xl:col-span-7 flex flex-wrap gap-2">
                                    <button type="submit" className="rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white">
                                        Terapkan Filter
                                    </button>
                                    <button type="button" onClick={resetFilters} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">
                                        Reset Filter
                                    </button>
                                </div>
                            </form>
                        </div>
                                </div>
                            </div>
                        </div>
                        ) : null}

                        {walletMonthRows.length > 0 ? (
                            <>
                            <div className="grid gap-3 md:grid-cols-4">
                                <SummaryCard title="Bulan Ditampilkan" value={String(walletMonthRows.length)} description={`Halaman ${walletMonthCurrentPage} breakdown bulanan`} icon={<IconCalendar size={18} className="text-slate-700 dark:text-slate-200" />} tone="blue" />
                                <SummaryCard title="Bulan Aktif" value={walletSelectedMonthLabel || "-"} description="Dipakai untuk breakdown harian" icon={<IconClockHour4 size={18} className="text-slate-700 dark:text-slate-200" />} tone="slate" />
                                <SummaryCard title="Hari Ditampilkan" value={String(walletDayRows.length)} description={`Halaman ${walletDayCurrentPage} breakdown harian`} icon={<IconReceipt2 size={18} className="text-slate-700 dark:text-slate-200" />} tone="slate" />
                                <SummaryCard title="Hari Aktif" value={walletSelectedDayLabel || "-"} description={`${walletRows.length} detail transaksi di halaman ini`} icon={<IconInfoCircle size={18} className="text-slate-700 dark:text-slate-200" />} tone="slate" />
                            </div>

                            <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 dark:bg-slate-950/40">
                                        <tr className="border-b border-slate-100 dark:border-slate-800">
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">No</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Bulan</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Hak Tenant</th>
                                            {canViewMarkup && <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Markup Owner</th>}
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Mutasi</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {walletMonthRows.map((row, index) => {
                                            const isSelected = row.month_key === walletSelectedMonth;
                                            return (
                                                <tr key={row.month_key} className={isSelected ? "bg-primary-50/50 dark:bg-primary-950/10" : ""}>
                                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{index + 1 + (walletMonthCurrentPage - 1) * walletMonthPerPage}</td>
                                                    <td className="px-4 py-3"><div className="font-semibold text-slate-900 dark:text-white">{row.month_label}</div><div className="text-xs text-slate-500 dark:text-slate-400">{row.sales_count} masuk saldo • {row.returns_count} retur</div></td>
                                                    <td className={`px-4 py-3 text-right font-semibold ${row.tenant_sales_total < 0 ? "text-danger-600 dark:text-danger-300" : "text-emerald-600 dark:text-emerald-300"}`}>{formatCurrency(row.tenant_sales_total)}</td>
                                                    {canViewMarkup && <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{formatCurrency(row.owner_markup_total)}</td>}
                                                    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{row.entries_count}</td>
                                                    <td className="px-4 py-3"><button type="button" onClick={() => selectWalletMonth(row.month_key)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${isSelected ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}>{isSelected ? "Bulan aktif" : "Lihat hari"}</button></td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mt-4 flex justify-end">
                                {walletTransactions?.months?.last_page > 1 ? <Pagination links={walletMonthLinks} /> : null}
                            </div>

                            <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 dark:bg-slate-950/40">
                                        <tr className="border-b border-slate-100 dark:border-slate-800">
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">No</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Hari</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Hak Tenant</th>
                                            {canViewMarkup && <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Markup Owner</th>}
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Mutasi</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {walletDayRows.map((row, index) => {
                                            const isSelected = row.date_key === walletSelectedDay;
                                            return (
                                                <tr key={row.date_key} className={isSelected ? "bg-primary-50/50 dark:bg-primary-950/10" : ""}>
                                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{index + 1 + (walletDayCurrentPage - 1) * walletDayPerPage}</td>
                                                    <td className="px-4 py-3"><div className="font-semibold text-slate-900 dark:text-white">{row.date_label}</div><div className="text-xs text-slate-500 dark:text-slate-400">{row.sales_count} masuk saldo • {row.returns_count} retur</div></td>
                                                    <td className={`px-4 py-3 text-right font-semibold ${row.tenant_sales_total < 0 ? "text-danger-600 dark:text-danger-300" : "text-emerald-600 dark:text-emerald-300"}`}>{formatCurrency(row.tenant_sales_total)}</td>
                                                    {canViewMarkup && <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{formatCurrency(row.owner_markup_total)}</td>}
                                                    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{row.entries_count}</td>
                                                    <td className="px-4 py-3"><button type="button" onClick={() => selectWalletDay(row.date_key)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${isSelected ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}>{isSelected ? "Hari aktif" : "Lihat detail"}</button></td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mt-4 flex justify-end">
                                {walletTransactions?.days?.last_page > 1 ? <Pagination links={walletDayLinks} /> : null}
                            </div>

                            <div className="mt-6 overflow-x-auto">
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
                                    {walletTransactions?.details?.last_page > 1 ? <Pagination links={walletLinks} /> : null}
                                </div>
                            </div>
                            </>
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
                                        {canViewMarkup && (
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
                                        )}
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
                                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Item</th>
                                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Qty</th>
                                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Harga Customer</th>
                                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Hak Tenant</th>
                                                    {canViewMarkup && <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Markup Owner</th>}
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
                                                        {canViewMarkup && (
                                                            <td className={`px-4 py-3 text-right font-semibold ${detail.owner_net_total < 0 ? "text-danger-600 dark:text-danger-300" : "text-amber-600 dark:text-amber-300"}`}>
                                                                <div>{formatCurrency(detail.owner_net_total)}</div>
                                                                <div className="text-xs font-normal text-slate-500 dark:text-slate-400">
                                                                    Unit {formatCurrency(detail.owner_markup_unit_price)}
                                                                </div>
                                                                <div className="text-xs font-normal text-slate-500 dark:text-slate-400">
                                                                    Produk {formatCurrency(detail.owner_product_markup_total ?? 0)} • Topping {formatCurrency(detail.owner_topping_markup_total ?? 0)}
                                                                </div>
                                                            </td>
                                                        )}
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

                {tenantBreakdownModalOpen ? (
                    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 p-4">
                        <div className="flex min-h-full items-center justify-center py-2">
                            <div className="flex w-full max-w-6xl max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
                                <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
                                    <div>
                                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                                            Breakdown Hak Tenant
                                        </h2>
                                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                            Per tenant: selesai dapur, belum selesai dapur, sudah withdraw, pending, dan sisa hak.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setTenantBreakdownModalOpen(false)}
                                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
                                    >
                                        Tutup
                                    </button>
                                </div>
                                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                                    <div className="grid gap-3 md:grid-cols-4">
                                        <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                Penghasilan Selesai Dapur
                                            </p>
                                            <p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
                                                {formatCurrency(safeOwnerOverview.completed_gross_sales_total)}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                {Number(safeOwnerOverview.completed_transactions_count ?? 0).toLocaleString("id-ID")} transaksi delivered
                                            </p>
                                        </div>
                                        <div className="rounded-2xl bg-amber-50 p-4 dark:bg-amber-950/20">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-amber-500">
                                                Penghasilan Belum Selesai
                                            </p>
                                            <p className="mt-2 text-lg font-bold text-amber-700 dark:text-amber-300">
                                                {formatCurrency(safeOwnerOverview.pending_kitchen_gross_sales_total)}
                                            </p>
                                            <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-300/80">
                                                {Number(safeOwnerOverview.pending_kitchen_transactions_count ?? 0).toLocaleString("id-ID")} transaksi belum delivered
                                            </p>
                                        </div>
                                        <div className="rounded-2xl bg-blue-50 p-4 dark:bg-blue-950/20">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">
                                                Total Penghasilan Transaksi
                                            </p>
                                            <p className="mt-2 text-lg font-bold text-blue-700 dark:text-blue-300">
                                                {formatCurrency(safeOwnerOverview.total_gross_sales_total)}
                                            </p>
                                            <p className="mt-1 text-xs text-blue-700/80 dark:text-blue-300/80">
                                                Penghasilan selesai + belum selesai
                                            </p>
                                        </div>
                                        <div className="rounded-2xl bg-blue-50 p-4 dark:bg-blue-950/20">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">
                                                Hak Tenant Siap Withdraw
                                            </p>
                                            <p className="mt-2 text-lg font-bold text-blue-700 dark:text-blue-300">
                                                {formatCurrency(safeOwnerOverview.tenant_rights_total)}
                                            </p>
                                            <p className="mt-1 text-xs text-blue-700/80 dark:text-blue-300/80">
                                                Hanya dari transaksi delivered
                                            </p>
                                        </div>
                                        <div className="rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-950/20">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500">
                                                Sudah Di-Withdraw
                                            </p>
                                            <p className="mt-2 text-lg font-bold text-emerald-700 dark:text-emerald-300">
                                                {formatCurrency(safeOwnerOverview.withdrawn_total)}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl bg-blue-50 p-4 dark:bg-blue-950/20">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-amber-500">
                                                Pending Approval
                                            </p>
                                            <p className="mt-2 text-lg font-bold text-amber-700 dark:text-amber-300">
                                                {formatCurrency(safeOwnerOverview.pending_withdraw_total)}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl bg-rose-50 p-4 dark:bg-rose-950/20">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-rose-500">
                                                Belum Di-Withdraw
                                            </p>
                                            <p className="mt-2 text-lg font-bold text-rose-700 dark:text-rose-300">
                                                {formatCurrency(safeOwnerOverview.unwithdrawn_total)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
                                        <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                            Cara Baca Angka
                                        </div>
                                        <div className="grid gap-3 md:grid-cols-2">
                                            <div className="rounded-xl bg-white/80 p-3 dark:bg-slate-900/60">
                                                <div className="font-semibold text-slate-700 dark:text-slate-200">
                                                    Penghasilan Selesai
                                                </div>
                                                <div className="mt-1 text-slate-600 dark:text-slate-300">
                                                    Total transaksi tenant yang sudah berstatus `delivered`.
                                                </div>
                                            </div>
                                            <div className="rounded-xl bg-white/80 p-3 dark:bg-slate-900/60">
                                                <div className="font-semibold text-slate-700 dark:text-slate-200">
                                                    Penghasilan Belum Selesai
                                                </div>
                                                <div className="mt-1 text-slate-600 dark:text-slate-300">
                                                    Total transaksi tenant yang belum `delivered`.
                                                </div>
                                            </div>
                                            <div className="rounded-xl bg-white/80 p-3 dark:bg-slate-900/60">
                                                <div className="font-semibold text-slate-700 dark:text-slate-200">
                                                    Total Penghasilan
                                                </div>
                                                <div className="mt-1 text-slate-600 dark:text-slate-300">
                                                    Penjumlahan `Penghasilan Selesai` dan `Penghasilan Belum Selesai`.
                                                </div>
                                            </div>
                                            <div className="rounded-xl bg-white/80 p-3 dark:bg-slate-900/60">
                                                <div className="font-semibold text-slate-700 dark:text-slate-200">
                                                    Hak Tenant Siap Withdraw
                                                </div>
                                                <div className="mt-1 text-slate-600 dark:text-slate-300">
                                                    Hak bersih tenant dari transaksi `delivered`, setelah split tenant dan koreksi retur.
                                                </div>
                                            </div>
                                            <div className="rounded-xl bg-white/80 p-3 dark:bg-slate-900/60">
                                                <div className="font-semibold text-slate-700 dark:text-slate-200">
                                                    Sudah Withdraw
                                                </div>
                                                <div className="mt-1 text-slate-600 dark:text-slate-300">
                                                    Pengajuan tenant yang sudah `approved`.
                                                </div>
                                            </div>
                                            <div className="rounded-xl bg-white/80 p-3 dark:bg-slate-900/60">
                                                <div className="font-semibold text-slate-700 dark:text-slate-200">
                                                    Pending dan Belum Withdraw
                                                </div>
                                                <div className="mt-1 text-slate-600 dark:text-slate-300">
                                                    `Pending` adalah pengajuan yang belum di-approve. `Belum Withdraw` adalah sisa: `Hak Tenant Siap Withdraw - Sudah Withdraw - Pending`.
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-5 overflow-x-auto">
                                        <table className="w-full min-w-[1100px] text-sm">
                                            <thead>
                                                <tr className="border-b border-slate-100 dark:border-slate-800">
                                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Tenant</th>
                                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Selesai Dapur</th>
                                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Penghasilan Selesai</th>
                                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Belum Selesai</th>
                                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Penghasilan Belum Selesai</th>
                                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Total Penghasilan</th>
                                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Hak Tenant Siap Withdraw</th>
                                                    {canViewMarkup && <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Markup Owner</th>}
                                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Sudah Withdraw</th>
                                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Pending</th>
                                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Belum Withdraw</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {safeOwnerOverview.tenant_breakdown.map((row) => (
                                                    <tr key={row.tenant_outlet_id}>
                                                        <td className="px-4 py-3">
                                                            <div className="font-medium text-slate-900 dark:text-white">
                                                                {row.tenant_name}
                                                            </div>
                                                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                                                {row.tenant_code || "-"}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                                                            {Number(row.completed_transactions_count ?? 0).toLocaleString("id-ID")}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                                                            {formatCurrency(row.completed_gross_sales_total ?? 0)}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                                                            {Number(row.pending_kitchen_transactions_count ?? 0).toLocaleString("id-ID")}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-amber-700 dark:text-amber-300">
                                                            {formatCurrency(row.pending_kitchen_gross_sales_total ?? 0)}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                                                            {formatCurrency(row.total_gross_sales_total ?? 0)}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-semibold text-blue-700 dark:text-blue-300">
                                                            {formatCurrency(row.tenant_rights_total ?? 0)}
                                                        </td>
                                                        {canViewMarkup && (
                                                        <td className="px-4 py-3 text-right font-semibold text-emerald-700 dark:text-emerald-300">
                                                            {formatCurrency(row.owner_markup_total ?? 0)}
                                                        </td>
                                                        )}
                                                        <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                                                            {formatCurrency(row.withdrawn_total ?? 0)}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-amber-700 dark:text-amber-300">
                                                            {formatCurrency(row.pending_withdraw_total ?? 0)}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-semibold text-rose-700 dark:text-rose-300">
                                                            {formatCurrency(row.unwithdrawn_total ?? 0)}
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

                {unallocatedModalOpen ? (
                    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 p-4">
                        <div className="flex min-h-full items-center justify-center py-2">
                            <div className="flex w-full max-w-6xl max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
                                <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
                                    <div>
                                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                                            Transaksi Tanpa Alokasi
                                        </h2>
                                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                            Transaksi yang belum memiliki alokasi tenant.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setUnallocatedModalOpen(false)}
                                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
                                    >
                                        Tutup
                                    </button>
                                    <button
                                        type="button"
                                        onClick={repairUnallocated}
                                        disabled={repairingUnallocated}
                                        className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-600"
                                    >
                                        {repairingUnallocated ? "Memperbaiki..." : "Perbaiki Alokasi"}
                                    </button>
                                </div>
                                    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                                        {unallocatedLoading && unallocatedRows.length === 0 ? (
                                            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                                                Memuat data tanpa alokasi...
                                            </div>
                                        ) : (
                                            <>
                                                <form onSubmit={applyUnallocatedFilters} className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                                                    <input
                                                        type="text"
                                                        value={unallocatedFilters.q}
                                                        onChange={(event) => setUnallocatedFilters((prev) => ({ ...prev, q: event.target.value }))}
                                                        placeholder="Cari invoice / pelanggan"
                                                        className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs dark:border-slate-700 dark:bg-slate-800"
                                                    />
                                                    <input
                                                        type="date"
                                                        value={unallocatedFilters.date_from}
                                                        onChange={(event) => setUnallocatedFilters((prev) => ({ ...prev, date_from: event.target.value }))}
                                                        className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs dark:border-slate-700 dark:bg-slate-800"
                                                    />
                                                    <input
                                                        type="date"
                                                        value={unallocatedFilters.date_to}
                                                        onChange={(event) => setUnallocatedFilters((prev) => ({ ...prev, date_to: event.target.value }))}
                                                        className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs dark:border-slate-700 dark:bg-slate-800"
                                                    />
                                                    <select
                                                        value={unallocatedFilters.payment_method}
                                                        onChange={(event) => setUnallocatedFilters((prev) => ({ ...prev, payment_method: event.target.value }))}
                                                        className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs dark:border-slate-700 dark:bg-slate-800"
                                                    >
                                                        <option value="">Semua metode</option>
                                                        <option value="cash">Tunai</option>
                                                        <option value="qris">QRIS</option>
                                                        <option value="transfer">Transfer</option>
                                                        <option value="card">Kartu</option>
                                                        <option value="midtrans">Midtrans</option>
                                                        <option value="xendit">Xendit</option>
                                                    </select>
                                                    <select
                                                        value={unallocatedFilters.payment_status}
                                                        onChange={(event) => setUnallocatedFilters((prev) => ({ ...prev, payment_status: event.target.value }))}
                                                        className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs dark:border-slate-700 dark:bg-slate-800"
                                                    >
                                                        <option value="">Semua status</option>
                                                        <option value="pending">Pending</option>
                                                        <option value="paid">Paid</option>
                                                    </select>
                                                    <div className="flex gap-2">
                                                        <button type="submit" className="h-10 rounded-xl bg-primary-600 px-3 text-xs font-semibold text-white">Terapkan</button>
                                                        <button type="button" onClick={resetUnallocatedFilters} className="h-10 rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">Reset</button>
                                                    </div>
                                                </form>

                                                <div className="mb-4 grid gap-3 md:grid-cols-4">
                                                    <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                            Total Transaksi Tanpa Alokasi
                                                        </p>
                                                        <p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
                                                            {Number(safeOwnerOverview.unallocated_transactions_count ?? 0).toLocaleString("id-ID")}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="overflow-x-auto">
                                                <table className="w-full min-w-[900px] text-sm">
                                                    <thead>
                                                        <tr className="border-b border-slate-100 dark:border-slate-800">
                                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Invoice</th>
                                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Pelanggan</th>
                                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Total</th>
                                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Pembayaran</th>
                                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Metode</th>
                                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Dibuat</th>
                                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Alasan</th>
                                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Tenant Detail</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                        {unallocatedRows.map((row) => (
                                                            <tr key={row.transaction_id}>
                                                                <td className="px-4 py-3 text-left text-slate-700 dark:text-slate-300">{row.invoice || "-"}</td>
                                                                <td className="px-4 py-3 text-left text-slate-700 dark:text-slate-300">{row.customer_name || "-"}</td>
                                                                <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{formatCurrency(row.grand_total || 0)}</td>
                                                                <td className="px-4 py-3 text-left text-slate-700 dark:text-slate-300">{row.payment_status || "-"}</td>
                                                                <td className="px-4 py-3 text-left text-slate-700 dark:text-slate-300">{row.payment_method || "-"}</td>
                                                                <td className="px-4 py-3 text-left text-slate-700 dark:text-slate-300">{row.created_at || "-"}</td>
                                                                         <td className="px-4 py-3 text-left text-slate-700 dark:text-slate-300">{row.reason || "-"}</td>
                                                                         {row.detail_tenant_ids && row.detail_tenant_ids.length > 0 ? (
                                                                             <td className="px-4 py-3 text-left text-slate-700 dark:text-slate-300">{row.detail_tenant_ids.join(', ')}</td>
                                                                         ) : (
                                                                             <td className="px-4 py-3 text-left text-slate-500">-</td>
                                                                         )}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                                <div className="mt-4 space-y-2">
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Daftar Produk</p>
                                                    {unallocatedRows.map((row) => (
                                                        <div key={row.transaction_id} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                                                            <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                                                {row.invoice || '-'}
                                                            </div>
                                                            <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                                                                {(row.products || []).length === 0 ? (
                                                                    <span className="text-slate-400">Tidak ada detail produk</span>
                                                                ) : (
                                                                    <ul className="space-y-1">
                                                                        {(row.products || []).map((product, idx) => (
                                                                            <li key={idx} className="flex flex-wrap items-center gap-2">
                                                                                <span className="font-medium text-slate-700 dark:text-slate-200">{product.product_name}</span>
                                                                                <span className="text-slate-500">x{product.qty}</span>
                                                                                <span className="text-slate-500">{formatCurrency(product.unit_price || 0)}</span>
                                                                                {product.tenant_outlet_id ? (
                                                                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">tenant {product.tenant_outlet_id}</span>
                                                                                ) : (
                                                                                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-600 dark:bg-rose-900/40 dark:text-rose-300">tanpa tenant</span>
                                                                                )}
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                 ) : null}

                 {returnsModalOpen ? (
                     <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 p-4">
                         <div className="flex min-h-full items-center justify-center py-2">
                             <div className="flex w-full max-w-6xl max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
                                 <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
                                     <div>
                                         <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                                             Detail Retur
                                         </h2>
                                         <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                             Retur yang mengurangi penghasilan tenant.
                                         </p>
                                     </div>
                                     <button
                                         type="button"
                                         onClick={() => setReturnsModalOpen(false)}
                                         className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
                                     >
                                         Tutup
                                     </button>
                                 </div>
                                 <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                                     {returnsLoading && returnsRows.length === 0 ? (
                                         <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                                             Memuat data retur...
                                         </div>
                                     ) : (
                                         <>
                                             <form onSubmit={applyReturnsFilters} className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                                                 <input
                                                     type="text"
                                                     value={returnsFilters.q}
                                                     onChange={(event) => setReturnsFilters((prev) => ({ ...prev, q: event.target.value }))}
                                                     placeholder="Cari kode / invoice / pelanggan"
                                                     className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs dark:border-slate-700 dark:bg-slate-800"
                                                 />
                                                 <input
                                                     type="date"
                                                     value={returnsFilters.date_from}
                                                     onChange={(event) => setReturnsFilters((prev) => ({ ...prev, date_from: event.target.value }))}
                                                     className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs dark:border-slate-700 dark:bg-slate-800"
                                                 />
                                                 <input
                                                     type="date"
                                                     value={returnsFilters.date_to}
                                                     onChange={(event) => setReturnsFilters((prev) => ({ ...prev, date_to: event.target.value }))}
                                                     className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs dark:border-slate-700 dark:bg-slate-800"
                                                 />
                                                 <div className="xl:col-span-3 flex gap-2">
                                                     <button type="submit" className="h-10 rounded-xl bg-primary-600 px-3 text-xs font-semibold text-white">Terapkan</button>
                                                     <button type="button" onClick={resetReturnsFilters} className="h-10 rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">Reset</button>
                                                 </div>
                                             </form>

                                             {returnsRows.length === 0 ? (
                                                 <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                                                     Tidak ada data retur untuk filter ini.
                                                 </div>
                                             ) : (
                                                 <div className="space-y-4">
                                                     <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                                                         <table className="w-full min-w-[900px] text-sm">
                                                             <thead className="bg-slate-50 dark:bg-slate-950/40">
                                                                 <tr className="border-b border-slate-100 dark:border-slate-800">
                                                                     <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Kode Retur</th>
                                                                     <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Invoice</th>
                                                                     <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Pelanggan</th>
                                                                     <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Tgl Retur</th>
                                                                     <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Qty</th>
                                                                     <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Total Nilai</th>
                                                                     <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Tenant</th>
                                                                 </tr>
                                                             </thead>
                                                             <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                                 {returnsRows.map((row) => (
                                                                     <tr key={`${row.sales_return_id}-${row.transaction_id}-${row.product_name}`}>
                                                                         <td className="px-4 py-3 text-left text-slate-700 dark:text-slate-300">{row.code || '-'}</td>
                                                                         <td className="px-4 py-3 text-left text-slate-700 dark:text-slate-300">{row.invoice || '-'}</td>
                                                                         <td className="px-4 py-3 text-left text-slate-700 dark:text-slate-300">{row.customer_name || '-'}</td>
                                                                         <td className="px-4 py-3 text-left text-slate-700 dark:text-slate-300">{row.completed_at || '-'}</td>
                                                                         <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{row.qty_return || 0}</td>
                                                                         <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{formatCurrency((row.customer_unit_price || 0) * (row.qty_return || 0))}</td>
                                                                         <td className="px-4 py-3 text-left text-slate-700 dark:text-slate-300">{row.tenant_name || '-'}</td>
                                                                     </tr>
                                                                 ))}
                                                             </tbody>
                                                         </table>
                                                     </div>

                                                     <div className="flex items-center justify-between">
                                                         <div className="text-xs text-slate-500 dark:text-slate-400">
                                                             Halaman {returnsPage} dari {returnsLastPage}
                                                         </div>
                                                         <div className="flex gap-2">
                                                             <button
                                                                 type="button"
                                                                 disabled={returnsPage <= 1}
                                                                 onClick={() => loadReturnTransactions({ ...returnsFilters, page: returnsPage - 1 })}
                                                                 className="h-9 rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
                                                             >
                                                                 Sebelumnya
                                                             </button>
                                                             <button
                                                                 type="button"
                                                                 disabled={returnsPage >= returnsLastPage}
                                                                 onClick={() => loadReturnTransactions({ ...returnsFilters, page: returnsPage + 1 })}
                                                                 className="h-9 rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
                                                             >
                                                                 Selanjutnya
                                                             </button>
                                                         </div>
                                                     </div>
                                                 </div>
                                             )}
                                         </>
                                     )}
                                 </div>
                             </div>
                         </div>
                     </div>
                 ) : null}

                 {isTenantRequestMode && activeTab === "audit" && tenantAuditReport ? (
                     <div className="space-y-6">
                          {/* Summary Cards */}
                          {(auditDateFrom || auditDateTo) && (
                              <div className="rounded-2xl border border-primary-200 bg-primary-50 px-4 py-2.5 text-sm text-primary-700 dark:border-primary-900/40 dark:bg-primary-950/20 dark:text-primary-300">
                                  Filter aktif: {auditDateFrom ? `dari ${auditDateFrom}` : 'dari awal'} — {auditDateTo ? `sampai ${auditDateTo}` : 'sampai sekarang'}
                              </div>
                          )}
                          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                              <SummaryCard title="Total Saldo Masuk" value={formatCurrency(tenantAuditReport.summary?.claimable_total ?? 0)} description="Hak tenant dari transaksi yang sudah delivered" icon={<IconReceipt2 size={20} />} tone="emerald" />
                              <SummaryCard title="Sudah Di-Withdraw" value={formatCurrency(tenantAuditReport.summary?.approved_total ?? 0)} description="Penarikan yang sudah disetujui dan dibayar" icon={<IconCheck size={20} />} tone="blue" />
                              <SummaryCard title="Pending Approval" value={formatCurrency(tenantAuditReport.summary?.pending_total ?? 0)} description="Penarikan yang masih menunggu proses" icon={<IconClockHour4 size={20} />} tone="amber" />
                              <SummaryCard title="Saldo Tersedia" value={formatCurrency(tenantAuditReport.summary?.available_balance ?? 0)} description="Sisa saldo yang bisa diajukan" icon={<IconCashBanknote size={20} />} tone="slate" />
                          </div>

                          {/* Date Filter */}
                          <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                              <div>
                                  <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Dari Tanggal</label>
                                  <input
                                      type="date"
                                      value={auditDateFrom}
                                      onChange={(e) => setAuditDateFrom(e.target.value)}
                                      className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                                  />
                              </div>
                              <div>
                                  <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Sampai Tanggal</label>
                                  <input
                                      type="date"
                                      value={auditDateTo}
                                      onChange={(e) => setAuditDateTo(e.target.value)}
                                      className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                                  />
                              </div>
                              <button
                                  type="button"
                                  onClick={() => {
                                      router.get(route('cashier-settlements.index', {
                                          tab: 'audit',
                                          audit_date_from: auditDateFrom,
                                          audit_date_to: auditDateTo,
                                      }), { preserveScroll: true, preserveState: true });
                                  }}
                                  className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-700"
                              >
                                  <IconSearch size={16} />
                                  Terapkan Filter
                              </button>
                              {(auditDateFrom || auditDateTo) && (
                                  <button
                                      type="button"
                                      onClick={() => {
                                          setAuditDateFrom('');
                                          setAuditDateTo('');
                                          router.get(route('cashier-settlements.index', { tab: 'audit' }), { preserveScroll: true, preserveState: true });
                                      }}
                                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                  >
                                      <IconX size={16} />
                                      Reset
                                  </button>
                              )}
                          </div>

                         {/* Reconciliation Status */}
                         {tenantAuditReport.reconciliation ? (
                             <div className={`rounded-2xl border p-4 ${tenantAuditReport.reconciliation.is_balanced ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20' : 'border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/20'}`}>
                                 <div className="flex items-center gap-3">
                                     <div className={`rounded-xl p-3 ${tenantAuditReport.reconciliation.is_balanced ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-rose-100 dark:bg-rose-900/30'}`}>
                                         {tenantAuditReport.reconciliation.is_balanced ? <IconCheck size={20} className="text-emerald-600" /> : <IconInfoCircle size={20} className="text-rose-600" />}
                                     </div>
                                     <div>
                                         <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                             {tenantAuditReport.reconciliation.is_balanced ? 'Saldo Seimbang' : 'Selisih Terdeteksi'}
                                         </p>
                                         <p className="text-xs text-slate-600 dark:text-slate-400">
                                             {tenantAuditReport.reconciliation.is_balanced
                                                 ? 'Tidak ada selisih antara kalkulasi dan data penarikan.'
                                                 : `Selisih: ${formatCurrency(Math.abs((tenantAuditReport.reconciliation.expected_remaining ?? 0) - (tenantAuditReport.summary?.available_balance ?? 0)))}`}
                                         </p>
                                     </div>
                                 </div>
                                 <div className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
                                     <div className="rounded-xl bg-white/70 p-3 dark:bg-slate-900/30">
                                         <p className="text-slate-500">Hak Masuk (kotor)</p>
                                         <p className="mt-1 font-bold text-slate-900 dark:text-white">{formatCurrency(tenantAuditReport.reconciliation.claimable_total ?? 0)}</p>
                                     </div>
                                     <div className="rounded-xl bg-white/70 p-3 dark:bg-slate-900/30">
                                         <p className="text-slate-500">Potongan Retur</p>
                                         <p className="mt-1 font-bold text-rose-600">{formatCurrency(tenantAuditReport.reconciliation.return_total ?? 0)}</p>
                                     </div>
                                     <div className="rounded-xl bg-white/70 p-3 dark:bg-slate-900/30">
                                         <p className="text-slate-500">Total Sudah Dicairkan</p>
                                         <p className="mt-1 font-bold text-blue-600">{formatCurrency(tenantAuditReport.reconciliation.actual_withdrawn ?? 0)}</p>
                                     </div>
                                 </div>
                              </div>
                          ) : null}

                          {/* Income vs Saldo Flow */}
                          <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                              <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Alur Penghasilan vs Saldo</h3>
                              <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Perbandingan total penghasilan kotor, hak tenant (saldo masuk), dan sisa saldo tersedia.</p>
                              {(() => {
                                  const grossSales = (tenantAuditReport.months ?? []).reduce((s, m) => s + (m.subtotal_total ?? 0), 0);
                                  const tenantNet = tenantAuditReport.summary?.claimable_total ?? 0;
                                  const withdrawn = tenantAuditReport.summary?.approved_total ?? 0;
                                  const pending = tenantAuditReport.summary?.pending_total ?? 0;
                                  const returns = tenantAuditReport.summary?.return_total ?? 0;
                                  const available = tenantAuditReport.summary?.available_balance ?? 0;
                                  const ownerMarkup = Math.max(0, grossSales - tenantNet - returns);

                                  return (
                                      <div className="space-y-4">
                                          {/* Visual Flow */}
                                          <div className="flex flex-col items-stretch gap-0 sm:flex-row sm:items-center">
                                              <div className="flex-1 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 text-center dark:border-slate-700 dark:from-slate-800 dark:to-slate-900">
                                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Penghasilan Kotor</p>
                                                  <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{formatCurrency(grossSales)}</p>
                                                  <p className="mt-1 text-[11px] text-slate-500">Total transaksi dari pelanggan</p>
                                              </div>
                                              <div className="flex items-center justify-center py-2 sm:py-0 sm:px-2">
                                                  <div className="text-xs font-bold text-slate-400">→</div>
                                              </div>
                                              <div className="flex-1 rounded-2xl border border-slate-200 bg-gradient-to-br from-emerald-50 to-white p-4 text-center dark:border-emerald-900/40 dark:from-emerald-950/20 dark:to-slate-900">
                                                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500">Hak Tenant (Saldo Masuk)</p>
                                                  <p className="mt-1 text-xl font-bold text-emerald-600">{formatCurrency(tenantNet)}</p>
                                                  <p className="mt-1 text-[11px] text-slate-500">Setelah dikurangi markup owner</p>
                                              </div>
                                              <div className="flex items-center justify-center py-2 sm:py-0 sm:px-2">
                                                  <div className="text-xs font-bold text-slate-400">→</div>
                                              </div>
                                              <div className="flex-1 rounded-2xl border border-slate-200 bg-gradient-to-br from-blue-50 to-white p-4 text-center dark:border-blue-900/40 dark:from-blue-950/20 dark:to-slate-900">
                                                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">Sudah Di-Withdraw</p>
                                                  <p className="mt-1 text-xl font-bold text-blue-600">{formatCurrency(withdrawn + pending)}</p>
                                                  <p className="mt-1 text-[11px] text-slate-500">{formatCurrency(withdrawn)} cair + {formatCurrency(pending)} pending</p>
                                              </div>
                                              <div className="flex items-center justify-center py-2 sm:py-0 sm:px-2">
                                                  <div className="text-xs font-bold text-slate-400">=</div>
                                              </div>
                                              <div className="flex-1 rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50 to-white p-4 text-center dark:border-primary-900/40 dark:from-primary-950/20 dark:to-slate-900">
                                                  <p className="text-xs font-semibold uppercase tracking-wide text-primary-500">Saldo Tersedia</p>
                                                  <p className="mt-1 text-xl font-bold text-primary-600">{formatCurrency(available)}</p>
                                                  <p className="mt-1 text-[11px] text-slate-500">Siap diajukan</p>
                                              </div>
                                          </div>

                                          {/* Breakdown Table */}
                                          <div className="overflow-x-auto">
                                              <table className="w-full text-sm">
                                                  <thead>
                                                      <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700">
                                                          <th className="px-3 py-3">Komponen</th>
                                                          <th className="px-3 py-3 text-right">Nominal</th>
                                                          <th className="px-3 py-3 text-right">% dari Kotor</th>
                                                      </tr>
                                                  </thead>
                                                  <tbody>
                                                      <tr className="border-b border-slate-100 dark:border-slate-800">
                                                          <td className="px-3 py-3 font-medium text-slate-900 dark:text-white">Penghasilan Kotor (Gross Sales)</td>
                                                          <td className="px-3 py-3 text-right font-semibold text-slate-900 dark:text-white">{formatCurrency(grossSales)}</td>
                                                          <td className="px-3 py-3 text-right text-slate-500">100%</td>
                                                      </tr>
                                                      <tr className="border-b border-slate-100 dark:border-slate-800">
                                                          <td className="px-3 py-3 text-slate-600 dark:text-slate-400">- Markup Owner</td>
                                                          <td className="px-3 py-3 text-right text-slate-600 dark:text-slate-400">{formatCurrency(ownerMarkup)}</td>
                                                          <td className="px-3 py-3 text-right text-slate-500">{grossSales > 0 ? ((ownerMarkup / grossSales) * 100).toFixed(1) : 0}%</td>
                                                      </tr>
                                                      <tr className="border-b border-slate-100 dark:border-slate-800">
                                                          <td className="px-3 py-3 text-slate-600 dark:text-slate-400">- Retur</td>
                                                          <td className="px-3 py-3 text-right text-rose-600">{formatCurrency(returns)}</td>
                                                          <td className="px-3 py-3 text-right text-slate-500">{grossSales > 0 ? ((returns / grossSales) * 100).toFixed(1) : 0}%</td>
                                                      </tr>
                                                      <tr className="border-b border-emerald-50 bg-emerald-50/50 dark:border-emerald-900/20 dark:bg-emerald-950/10">
                                                          <td className="px-3 py-3 font-semibold text-emerald-700 dark:text-emerald-300">= Hak Tenant (Saldo Masuk)</td>
                                                          <td className="px-3 py-3 text-right font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(tenantNet)}</td>
                                                          <td className="px-3 py-3 text-right font-semibold text-emerald-600">{grossSales > 0 ? ((tenantNet / grossSales) * 100).toFixed(1) : 0}%</td>
                                                      </tr>
                                                      <tr className="border-b border-slate-100 dark:border-slate-800">
                                                          <td className="px-3 py-3 text-slate-600 dark:text-slate-400">- Sudah Di-Withdraw</td>
                                                          <td className="px-3 py-3 text-right text-blue-600">{formatCurrency(withdrawn)}</td>
                                                          <td className="px-3 py-3 text-right text-slate-500">{grossSales > 0 ? ((withdrawn / grossSales) * 100).toFixed(1) : 0}%</td>
                                                      </tr>
                                                      <tr className="border-b border-slate-100 dark:border-slate-800">
                                                          <td className="px-3 py-3 text-slate-600 dark:text-slate-400">- Pending Withdraw</td>
                                                          <td className="px-3 py-3 text-right text-amber-600">{formatCurrency(pending)}</td>
                                                          <td className="px-3 py-3 text-right text-slate-500">{grossSales > 0 ? ((pending / grossSales) * 100).toFixed(1) : 0}%</td>
                                                      </tr>
                                                      <tr className="bg-primary-50/50 dark:bg-primary-950/10">
                                                          <td className="px-3 py-3 font-bold text-primary-700 dark:text-primary-300">= Saldo Tersedia</td>
                                                          <td className="px-3 py-3 text-right font-bold text-primary-700 dark:text-primary-300">{formatCurrency(available)}</td>
                                                          <td className="px-3 py-3 text-right font-bold text-primary-600">{grossSales > 0 ? ((available / grossSales) * 100).toFixed(1) : 0}%</td>
                                                      </tr>
                                                  </tbody>
                                              </table>
                                          </div>
                                      </div>
                                  );
                              })()}
                          </div>

                          {/* Daily Breakdown */}
                          {(tenantAuditReport.daily?.data ?? tenantAuditReport.daily ?? []).length > 0 ? (
                              <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                                  <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">Audit Harian: Withdraw vs Saldo</h3>
                                  <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
                                      Monitoring apakah withdraw melebihi hak tenant. Baris merah = hari ada withdraw yang melebihi saldo kumulatif (kemungkinan markup owner ikut terhitung).
                                  </p>

                                  {/* Alert banner jika ada excess */}
                                  {(tenantAuditReport.summary?.total_excess_withdrawal ?? 0) > 0 && (
                                      <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/40 dark:bg-rose-950/20">
                                          <div className="flex items-start gap-3">
                                              <IconInfoCircle size={20} className="mt-0.5 shrink-0 text-rose-600" />
                                              <div>
                                                  <p className="text-sm font-semibold text-rose-800 dark:text-rose-200">Selisih Withdraw Terdeteksi</p>
                                                  <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                                                      Total withdraw melebihi saldo seharusnya sebesar <strong>{formatCurrency(tenantAuditReport.summary.total_excess_withdrawal)}</strong>. 
                                                      Kemungkinan ada kesalahan perhitungan di mana markup owner ikut terhitung dalam hak tenant. Periksa baris yang ditandai di bawah.
                                                  </p>
                                              </div>
                                          </div>
                                      </div>
                                  )}

                                  <div className="overflow-x-auto">
                                      <table className="w-full text-sm">
                                          <thead>
                                              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700">
                                                  <th className="px-3 py-3">Tanggal</th>
                                                  <th className="px-3 py-3 text-right">Hak Tenant</th>
                                                  <th className="px-3 py-3 text-right">Withdraw</th>
                                                  <th className="px-3 py-3 text-right">Retur</th>
                                                  <th className="px-3 py-3 text-right">Saldo Kumulatif</th>
                                                  <th className="px-3 py-3 text-right">Withdraw Kumulatif</th>
                                                  <th className="px-3 py-3 text-right">Saldo Sebelum Withdraw</th>
                                                  <th className="px-3 py-3 text-right">Selisih</th>
                                                  <th className="px-3 py-3">Keterangan</th>
                                              </tr>
                                          </thead>
                                          <tbody>
                                              {(tenantAuditReport.daily?.data ?? tenantAuditReport.daily ?? []).map((day) => {
                                                  const isDanger = day.audit_severity === 'danger';
                                                  const isWarning = day.audit_severity === 'warning';
                                                  const rowBg = isDanger
                                                      ? 'bg-rose-50 dark:bg-rose-950/20'
                                                      : isWarning
                                                        ? 'bg-amber-50 dark:bg-amber-950/20'
                                                        : '';

                                                  return (
                                                      <tr key={day.day_key} className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${rowBg}`}>
                                                          <td className="px-3 py-3">
                                                              <div className="font-medium text-slate-900 dark:text-white">{day.day_label}</div>
                                                              {day.transactions_count > 0 && (
                                                                  <div className="text-[11px] text-slate-400">{day.transactions_count} transaksi</div>
                                                              )}
                                                          </td>
                                                          <td className="px-3 py-3 text-right text-emerald-600">{formatCurrency(day.tenant_net)}</td>
                                                          <td className={`px-3 py-3 text-right font-medium ${isDanger ? 'text-rose-700 font-bold' : 'text-blue-600'}`}>
                                                              {day.withdrawn > 0 ? formatCurrency(day.withdrawn) : '-'}
                                                          </td>
                                                          <td className="px-3 py-3 text-right text-rose-600">{day.return_amount > 0 ? formatCurrency(day.return_amount) : '-'}</td>
                                                          <td className="px-3 py-3 text-right text-slate-600 dark:text-slate-400">{formatCurrency(day.cum_earnings - day.cum_returns)}</td>
                                                          <td className={`px-3 py-3 text-right ${isDanger ? 'font-bold text-rose-700' : 'text-blue-600'}`}>{formatCurrency(day.cum_withdrawals)}</td>
                                                          <td className="px-3 py-3 text-right font-semibold text-slate-900 dark:text-white">{formatCurrency(day.balance_before_withdraw)}</td>
                                                          <td className={`px-3 py-3 text-right font-bold ${day.selisih > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                              {day.selisih > 0 ? `+${formatCurrency(day.selisih)}` : formatCurrency(0)}
                                                          </td>
                                                          <td className="px-3 py-3">
                                                              {day.audit_note ? (
                                                                  <div className={`flex items-start gap-1.5 text-[11px] leading-tight ${isDanger ? 'text-rose-700 dark:text-rose-300' : 'text-amber-700 dark:text-amber-300'}`}>
                                                                      {isDanger ? <IconInfoCircle size={12} className="mt-0.5 shrink-0" /> : null}
                                                                      <span>{day.audit_note}</span>
                                                                  </div>
                                                              ) : (
                                                                  <span className="text-[11px] text-slate-400">-</span>
                                                              )}
                                                          </td>
                                                      </tr>
                                                  );
                                              })}
                                          </tbody>
                                          <tfoot>
                                              <tr className="border-t-2 border-slate-300 font-bold dark:border-slate-600">
                                                  <td className="px-3 py-3 text-slate-900 dark:text-white">Total Halaman Ini</td>
                                                  <td className="px-3 py-3 text-right text-emerald-600">{formatCurrency((tenantAuditReport.daily?.data ?? tenantAuditReport.daily ?? []).reduce((s, d) => s + d.tenant_net, 0))}</td>
                                                  <td className="px-3 py-3 text-right text-blue-600">{formatCurrency((tenantAuditReport.daily?.data ?? tenantAuditReport.daily ?? []).reduce((s, d) => s + d.withdrawn, 0))}</td>
                                                  <td className="px-3 py-3 text-right text-rose-600">{formatCurrency((tenantAuditReport.daily?.data ?? tenantAuditReport.daily ?? []).reduce((s, d) => s + d.return_amount, 0))}</td>
                                                  <td className="px-3 py-3 text-right" colSpan={2}></td>
                                                  <td className="px-3 py-3 text-right text-slate-900 dark:text-white">-</td>
                                                  <td className="px-3 py-3 text-right font-bold text-rose-600">
                                                      {(tenantAuditReport.summary?.total_excess_withdrawal ?? 0) > 0 ? formatCurrency(tenantAuditReport.summary.total_excess_withdrawal) : '-'}
                                                  </td>
                                                  <td></td>
                                              </tr>
                                          </tfoot>
                                      </table>
                                  </div>
                                  {tenantAuditReport.daily?.links && (
                                      <div className="mt-4">
                                          <Pagination links={tenantAuditReport.daily.links} />
                                      </div>
                                  )}
                              </div>
                          ) : null}

                          {/* Monthly Breakdown Table */}
                         <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                             <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Rekap Per Bulan</h3>
                             {tenantAuditReport.months?.length > 0 ? (
                                 <div className="overflow-x-auto">
                                     <table className="w-full text-sm">
                                         <thead>
                                             <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700">
                                                 <th className="px-3 py-3">Periode</th>
                                                 <th className="px-3 py-3 text-right">Transaksi</th>
                                                 <th className="px-3 py-3 text-right">Hak Tenant</th>
                                                 <th className="px-3 py-3 text-right">Disetujui</th>
                                                 <th className="px-3 py-3 text-right">Pending</th>
                                                 <th className="px-3 py-3 text-right">Ditolak</th>
                                                 <th className="px-3 py-3 text-right">Sisa Saldo</th>
                                             </tr>
                                         </thead>
                                         <tbody>
                                             {tenantAuditReport.months.map((month) => (
                                                 <tr key={month.month_key} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                                                     <td className="px-3 py-3 font-medium text-slate-900 dark:text-white">{month.month_label}</td>
                                                     <td className="px-3 py-3 text-right text-slate-600 dark:text-slate-400">{month.transactions_count}</td>
                                                     <td className="px-3 py-3 text-right font-semibold text-emerald-600">{formatCurrency(month.tenant_net_total)}</td>
                                                     <td className="px-3 py-3 text-right text-blue-600">{formatCurrency(month.approved_amount)}</td>
                                                     <td className="px-3 py-3 text-right text-amber-600">{formatCurrency(month.pending_amount)}</td>
                                                     <td className="px-3 py-3 text-right text-rose-600">{formatCurrency(month.rejected_amount)}</td>
                                                     <td className="px-3 py-3 text-right font-semibold text-slate-900 dark:text-white">{formatCurrency(month.remaining_balance)}</td>
                                                 </tr>
                                             ))}
                                         </tbody>
                                         <tfoot>
                                             <tr className="border-t border-slate-200 font-semibold dark:border-slate-700">
                                                 <td className="px-3 py-3 text-slate-900 dark:text-white">Total</td>
                                                 <td className="px-3 py-3 text-right text-slate-600 dark:text-slate-400">{tenantAuditReport.months.reduce((s, m) => s + m.transactions_count, 0)}</td>
                                                 <td className="px-3 py-3 text-right text-emerald-600">{formatCurrency(tenantAuditReport.months.reduce((s, m) => s + m.tenant_net_total, 0))}</td>
                                                 <td className="px-3 py-3 text-right text-blue-600">{formatCurrency(tenantAuditReport.months.reduce((s, m) => s + m.approved_amount, 0))}</td>
                                                 <td className="px-3 py-3 text-right text-amber-600">{formatCurrency(tenantAuditReport.months.reduce((s, m) => s + m.pending_amount, 0))}</td>
                                                 <td className="px-3 py-3 text-right text-rose-600">{formatCurrency(tenantAuditReport.months.reduce((s, m) => s + m.rejected_amount, 0))}</td>
                                                 <td className="px-3 py-3 text-right text-slate-900 dark:text-white">{formatCurrency(tenantAuditReport.summary?.available_balance ?? 0)}</td>
                                             </tr>
                                         </tfoot>
                                     </table>
                                 </div>
                             ) : (
                                 <p className="text-sm text-slate-500 dark:text-slate-400">Belum ada data transaksi.</p>
                             )}
                         </div>

                         {/* Recent Settlement Requests */}
                         <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                             <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Riwayat Penarikan</h3>
                             {(tenantAuditReport.recent_settlements?.data ?? tenantAuditReport.recent_settlements ?? []).length > 0 ? (
                                 <div className="overflow-x-auto">
                                     <table className="w-full text-sm">
                                         <thead>
                                             <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700">
                                                 <th className="px-3 py-3">Nomor</th>
                                                 <th className="px-3 py-3">Tanggal</th>
                                                 <th className="px-3 py-3 text-right">Diajukan</th>
                                                 <th className="px-3 py-3 text-right">Disetujui</th>
                                                 <th className="px-3 py-3">Status</th>
                                                 <th className="px-3 py-3">Waktu Proses</th>
                                             </tr>
                                         </thead>
                                         <tbody>
                                             {(tenantAuditReport.recent_settlements?.data ?? tenantAuditReport.recent_settlements ?? []).map((s) => (
                                                 <tr key={s.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                                                     <td className="px-3 py-3 font-medium text-slate-900 dark:text-white">{s.request_number}</td>
                                                     <td className="px-3 py-3 text-slate-600 dark:text-slate-400">{s.business_date ?? '-'}</td>
                                                     <td className="px-3 py-3 text-right text-slate-900 dark:text-white">{formatCurrency(s.requested_amount)}</td>
                                                     <td className="px-3 py-3 text-right text-emerald-600">{s.status === 'approved' ? formatCurrency(s.approved_amount) : '-'}</td>
                                                     <td className="px-3 py-3">
                                                         <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone[s.status] || ''}`}>
                                                             {statusLabel[s.status] ?? s.status}
                                                         </span>
                                                     </td>
                                                     <td className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">
                                                         {s.status === 'approved' ? `Approve: ${s.approved_at ?? '-'}` : s.status === 'rejected' ? `Tolak: ${s.approved_at ?? '-'}` : '-'}
                                                     </td>
                                                 </tr>
                                             ))}
                                         </tbody>
                                     </table>
                                 </div>
                             ) : (
                                 <p className="text-sm text-slate-500 dark:text-slate-400">Belum ada riwayat penarikan.</p>
                             )}
                             {tenantAuditReport.recent_settlements?.links && (
                                 <div className="mt-4">
                                     <Pagination links={tenantAuditReport.recent_settlements.links} />
                                 </div>
                             )}
                         </div>

                         {/* Recent Returns */}
                         {(tenantAuditReport.recent_returns?.data ?? tenantAuditReport.recent_returns ?? []).length > 0 ? (
                             <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                                 <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Retur yang Mempengaruhi Saldo</h3>
                                 <div className="overflow-x-auto">
                                     <table className="w-full text-sm">
                                         <thead>
                                             <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700">
                                                 <th className="px-3 py-3">Kode</th>
                                                 <th className="px-3 py-3">Invoice</th>
                                                 <th className="px-3 py-3 text-right">Nilai Retur</th>
                                                 <th className="px-3 py-3">Waktu</th>
                                             </tr>
                                         </thead>
                                         <tbody>
                                             {(tenantAuditReport.recent_returns?.data ?? tenantAuditReport.recent_returns ?? []).map((r) => (
                                                 <tr key={r.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                                                     <td className="px-3 py-3 font-medium text-slate-900 dark:text-white">{r.code}</td>
                                                     <td className="px-3 py-3 text-slate-600 dark:text-slate-400">{r.invoice ?? '-'}</td>
                                                     <td className="px-3 py-3 text-right font-semibold text-rose-600">-{formatCurrency(r.total_amount)}</td>
                                                     <td className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">{r.completed_at ?? '-'}</td>
                                                 </tr>
                                             ))}
                                         </tbody>
                                     </table>
                                 </div>
                                 {tenantAuditReport.recent_returns?.links && (
                                     <div className="mt-4">
                                         <Pagination links={tenantAuditReport.recent_returns.links} />
                                     </div>
                                 )}
                             </div>
                         ) : null}
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
                                    {errors?.approval ? (
                                        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
                                            {errors.approval}
                                        </div>
                                    ) : null}
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div>
                                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Nominal Approve</label>
                                            <input type="number" min="0" value={approvalForm.approved_amount} onChange={(e) => setApprovalForm((prev) => ({ ...prev, approved_amount: e.target.value }))} className={`h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm dark:bg-slate-800 ${errors?.approved_amount ? "border-rose-300 dark:border-rose-800" : "border-slate-200 dark:border-slate-700"}`} />
                                            <FieldError errors={errors} name="approved_amount" />
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Nama Penerima</label>
                                            <input value={approvalForm.recipient_name} onChange={(e) => setApprovalForm((prev) => ({ ...prev, recipient_name: e.target.value }))} className={`h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm dark:bg-slate-800 ${errors?.recipient_name ? "border-rose-300 dark:border-rose-800" : "border-slate-200 dark:border-slate-700"}`} required />
                                            <FieldError errors={errors} name="recipient_name" />
                                        </div>
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-3">
                                        <div>
                                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Cash</label>
                                            <input type="number" min="0" value={approvalForm.approved_cash_amount} onChange={(e) => setApprovalForm((prev) => ({ ...prev, approved_cash_amount: e.target.value }))} className={`h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm dark:bg-slate-800 ${errors?.approved_cash_amount ? "border-rose-300 dark:border-rose-800" : "border-slate-200 dark:border-slate-700"}`} />
                                            <FieldError errors={errors} name="approved_cash_amount" />
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Transfer</label>
                                            <input type="number" min="0" value={approvalForm.approved_transfer_amount} onChange={(e) => setApprovalForm((prev) => ({ ...prev, approved_transfer_amount: e.target.value }))} className={`h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm dark:bg-slate-800 ${errors?.approved_transfer_amount ? "border-rose-300 dark:border-rose-800" : "border-slate-200 dark:border-slate-700"}`} />
                                            <FieldError errors={errors} name="approved_transfer_amount" />
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Lainnya</label>
                                            <input type="number" min="0" value={approvalForm.approved_other_amount} onChange={(e) => setApprovalForm((prev) => ({ ...prev, approved_other_amount: e.target.value }))} className={`h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm dark:bg-slate-800 ${errors?.approved_other_amount ? "border-rose-300 dark:border-rose-800" : "border-slate-200 dark:border-slate-700"}`} />
                                            <FieldError errors={errors} name="approved_other_amount" />
                                        </div>
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-3">
                                        <div>
                                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Label Lainnya</label>
                                            <input value={approvalForm.approved_other_label} onChange={(e) => setApprovalForm((prev) => ({ ...prev, approved_other_label: e.target.value }))} className={`h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm dark:bg-slate-800 ${errors?.approved_other_label ? "border-rose-300 dark:border-rose-800" : "border-slate-200 dark:border-slate-700"}`} />
                                            <FieldError errors={errors} name="approved_other_label" />
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Referensi</label>
                                            <input value={approvalForm.approval_reference} onChange={(e) => setApprovalForm((prev) => ({ ...prev, approval_reference: e.target.value }))} className={`h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm dark:bg-slate-800 ${errors?.approval_reference ? "border-rose-300 dark:border-rose-800" : "border-slate-200 dark:border-slate-700"}`} />
                                            <FieldError errors={errors} name="approval_reference" />
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Waktu Bayar</label>
                                            <input type="datetime-local" value={approvalForm.paid_at} onChange={(e) => setApprovalForm((prev) => ({ ...prev, paid_at: e.target.value }))} className={`h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm dark:bg-slate-800 ${errors?.paid_at ? "border-rose-300 dark:border-rose-800" : "border-slate-200 dark:border-slate-700"}`} />
                                            <FieldError errors={errors} name="paid_at" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Catatan Approval</label>
                                        <textarea value={approvalForm.approval_notes} onChange={(e) => setApprovalForm((prev) => ({ ...prev, approval_notes: e.target.value }))} rows={3} className={`w-full rounded-xl border bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800 ${errors?.approval_notes ? "border-rose-300 dark:border-rose-800" : "border-slate-200 dark:border-slate-700"}`} />
                                        <FieldError errors={errors} name="approval_notes" />
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
                                        <FieldError errors={errors} name="approval_proof_photos" />
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
                                    {errors?.amount ? (
                                        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
                                            {errors.amount}
                                        </div>
                                    ) : null}

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
                                        <button type="submit" disabled={approvalBreakdownTotal !== approvalTarget || approving} className="rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
                                            {approving ? "Menyimpan…" : "Simpan Approval"}
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <form onSubmit={submitReject} className="flex min-h-0 flex-1 flex-col">
                                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
                                    {errors?.approval ? (
                                        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
                                            {errors.approval}
                                        </div>
                                    ) : null}
                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Alasan Penolakan</label>
                                        <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={4} className={`w-full rounded-xl border bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800 ${errors?.rejection_reason ? "border-rose-300 dark:border-rose-800" : "border-slate-200 dark:border-slate-700"}`} required />
                                        <FieldError errors={errors} name="rejection_reason" />
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
                                        <button type="submit" disabled={rejecting} className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
                                            {rejecting ? "Menyimpan…" : "Tolak Pengajuan"}
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

                        <div>
                            <p className="font-semibold text-slate-900 dark:text-white">
                                Laporan Saldo (Audit)
                            </p>
                            <ol className="mt-2 list-decimal space-y-2 pl-5">
                                <li>Tab <strong>Laporan Saldo</strong> menampilkan rekap lengkap saldo masuk, penarikan, dan retur per bulan.</li>
                                <li>Gunakan bagian <strong>Reconciliation</strong> untuk mengecek apakah ada selisih antara kalkulasi saldo dan data penarikan.</li>
                                <li>Jika ada selisih, hubungi admin untuk pengecekan lebih lanjut.</li>
                                <li>Tabel <strong>Rekap Per Bulan</strong> memperlihatkan detail transaksi, hak tenant, approved, pending, ditolak, dan sisa saldo per bulan.</li>
                                <li>Bagian <strong>Riwayat Penarikan</strong> menampilkan 10 penarikan terakhir beserta status prosesnya.</li>
                            </ol>
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
