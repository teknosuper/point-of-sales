import React, { useState, useRef, useEffect, useMemo } from "react";
import { Link, usePage } from "@inertiajs/react";
import axios from "axios";
import {
    IconChevronLeft,
    IconChevronRight,
    IconQrcode,
    IconSearch,
    IconX,
} from "@/Utils/icons";

const PAGE_SIZE = 8;

const paymentMethodLabel = (order) => {
    const method = String(
        order?.transaction?.payment_method || order?.payment_method || "cash"
    ).toLowerCase();

    return (
        {
            cash: "Tunai Kasir",
            qris: "QRIS Kasir",
            xendit: "Xendit Online",
            midtrans: "Midtrans Online",
            bank_transfer: "Transfer Bank",
        }[method] || method
    );
};

const isOnlinePayment = (order) =>
    ["xendit", "midtrans"].includes(
        String(order?.transaction?.payment_method || order?.payment_method || "").toLowerCase()
    );

const paymentStateLabel = (order) => {
    if (isOnlinePayment(order)) {
        return String(order?.transaction?.payment_status || "").toLowerCase() === "paid"
            ? "Sudah Dibayar Online"
            : "Menunggu Bayar Online";
    }

    return "Menunggu Bayar Kasir";
};

const paymentStateTone = (order) => {
    if (isOnlinePayment(order)) {
        return String(order?.transaction?.payment_status || "").toLowerCase() === "paid"
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
            : "bg-sky-100 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300";
    }

    return "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300";
};

export default function QRNotification() {
    const { pendingTableOrders = [], notificationAccess = {} } = usePage().props;
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [livePendingOrders, setLivePendingOrders] = useState(
        pendingTableOrders
    );
    const dropdownRef = useRef(null);
    const lastSyncedSignatureRef = useRef("");

    const pendingOrders = livePendingOrders.length;
    const canSeeQrNotifications = notificationAccess?.qrOrders === true;
    const normalizedSearchQuery = searchQuery.trim().toLowerCase();
    const buildOrdersSignature = (orders = []) =>
        JSON.stringify(
            orders.map((order) => ({
                id: order.id,
                updated_at: order.updated_at || null,
                status: order.status || null,
                grand_total: Number(order.grand_total || 0),
            }))
        );
    const pendingTableOrdersSignature = useMemo(
        () => buildOrdersSignature(pendingTableOrders || []),
        [pendingTableOrders]
    );

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    useEffect(() => {
        if (lastSyncedSignatureRef.current === pendingTableOrdersSignature) {
            return;
        }

        lastSyncedSignatureRef.current = pendingTableOrdersSignature;
        setLivePendingOrders(pendingTableOrders);
    }, [pendingTableOrders, pendingTableOrdersSignature]);

    useEffect(() => {
        if (!isOpen) {
            setSearchQuery("");
            setCurrentPage(1);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleOpenQrOrders = () => setIsOpen(true);
        const handleCloseQrOrders = () => setIsOpen(false);

        window.addEventListener("pos:open-qr-orders", handleOpenQrOrders);
        window.addEventListener("pos:close-qr-orders", handleCloseQrOrders);

        return () => {
            window.removeEventListener("pos:open-qr-orders", handleOpenQrOrders);
            window.removeEventListener("pos:close-qr-orders", handleCloseQrOrders);
        };
    }, []);

    useEffect(() => {
        if (!canSeeQrNotifications) {
            return undefined;
        }

        let cancelled = false;

        const syncPendingOrders = async () => {
            try {
                const response = await axios.get(route("notifications.snapshot"));

                if (cancelled) {
                    return;
                }

                const nextOrders = response.data?.pendingTableOrders || [];
                const nextSignature = buildOrdersSignature(nextOrders);

                if (lastSyncedSignatureRef.current === nextSignature) {
                    return;
                }

                lastSyncedSignatureRef.current = nextSignature;
                setLivePendingOrders(nextOrders);
            } catch (error) {
                console.debug("Gagal sinkron pesanan QR meja", error);
            }
        };

        syncPendingOrders();
        const timer = window.setInterval(syncPendingOrders, 10000);

        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [canSeeQrNotifications]);

    if (!canSeeQrNotifications) {
        return null;
    }

    const filteredOrders = useMemo(
        () =>
            livePendingOrders.filter((order) => {
                if (!normalizedSearchQuery) {
                    return true;
                }

                return [
                    order.customer_name,
                    order.order_number,
                    order.customer_phone,
                    order.table?.code,
                    order.table?.name,
                    order.created_at_label,
                ]
                    .filter(Boolean)
                    .some((value) =>
                        String(value).toLowerCase().includes(normalizedSearchQuery)
                    );
            }),
        [livePendingOrders, normalizedSearchQuery]
    );
    const totalPages = Math.max(
        1,
        Math.ceil(filteredOrders.length / PAGE_SIZE)
    );
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const paginatedOrders = useMemo(
        () =>
            filteredOrders.slice(
                (safeCurrentPage - 1) * PAGE_SIZE,
                safeCurrentPage * PAGE_SIZE
            ),
        [filteredOrders, safeCurrentPage]
    );

    const renderSearchHeader = () => (
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <div className="relative">
                <IconSearch
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => {
                        setSearchQuery(event.target.value);
                        setCurrentPage(1);
                    }}
                    placeholder="Cari nomor order, meja, pelanggan..."
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span>{filteredOrders.length} pesanan</span>
                <span>Halaman {safeCurrentPage} / {totalPages}</span>
            </div>
        </div>
    );

    const renderPaginationFooter = (compact = false) => (
        <div
            className={`flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 dark:border-slate-700 ${
                compact ? "bg-white dark:bg-slate-950" : "bg-slate-50 dark:bg-slate-900/50"
            }`}
        >
            <button
                type="button"
                onClick={() =>
                    setCurrentPage((page) => Math.max(1, page - 1))
                }
                disabled={safeCurrentPage <= 1}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
                <IconChevronLeft size={14} />
                Sebelumnya
            </button>
            <button
                type="button"
                onClick={() =>
                    setCurrentPage((page) =>
                        Math.min(totalPages, page + 1)
                    )
                }
                disabled={safeCurrentPage >= totalPages}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
                Berikutnya
                <IconChevronRight size={14} />
            </button>
        </div>
    );

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2.5 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                title="Pesanan QR Meja"
            >
                <IconQrcode size={20} strokeWidth={1.5} />
                {pendingOrders > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-[10px] font-bold text-white">
                        {pendingOrders > 9 ? '9+' : pendingOrders}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
                    <div
                        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="relative flex h-[min(90vh,48rem)] w-full max-w-[min(92vw,56rem)] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 dark:border-slate-700 sm:px-5">
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white sm:text-lg">
                                    Pesanan QR Meja
                                </h3>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                    Cari dan pilih order meja yang masuk ke kasir.
                                </p>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                            >
                                <IconX size={20} />
                            </button>
                        </div>

                        {pendingOrders > 0 ? renderSearchHeader() : null}

                        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                            {pendingOrders > 0 ? (
                                paginatedOrders.length > 0 ? (
                                    <div className="space-y-3">
                                        {paginatedOrders.map((order) => (
                                            <Link
                                                key={order.id}
                                                href={route("transactions.index", {
                                                    open_table_order: order.id,
                                                })}
                                                className={`block rounded-2xl border px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${
                                                    isOnlinePayment(order)
                                                        ? "border-sky-200 bg-sky-50/40 dark:border-sky-900/40 dark:bg-sky-950/10"
                                                        : "border-slate-200 dark:border-slate-700"
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                                            {order.customer_name || order.order_number}
                                                        </p>
                                                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                                            {order.table?.code
                                                                ? `${order.table.code} - ${order.table.name || "Meja"}`
                                                                : order.table?.name || "QR Meja"}
                                                        </p>
                                                        <p className="mt-1 text-xs font-semibold text-primary-600 dark:text-primary-400">
                                                            Rp{" "}
                                                            {new Intl.NumberFormat("id-ID").format(
                                                                Number(order.grand_total || 0)
                                                            )}
                                                        </p>
                                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                                            <span
                                                                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${paymentStateTone(order)}`}
                                                            >
                                                                {paymentStateLabel(order)}
                                                            </span>
                                                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                                {paymentMethodLabel(order)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="shrink-0 text-right">
                                                        <div
                                                            className={`mt-1 ml-auto h-2.5 w-2.5 rounded-full ${
                                                                isOnlinePayment(order)
                                                                    ? "bg-sky-500"
                                                                    : "bg-amber-500"
                                                            }`}
                                                        />
                                                        <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
                                                            {order.created_at_label}
                                                        </p>
                                                    </div>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                                        Tidak ada pesanan yang cocok dengan pencarian.
                                    </div>
                                )
                            ) : (
                                <div className="py-12 text-center">
                                    <IconQrcode size={36} className="mx-auto mb-3 text-slate-400 dark:text-slate-600" strokeWidth={1.5} />
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        Belum ada pesanan QR
                                    </p>
                                </div>
                            )}
                        </div>

                        {pendingOrders > 0 ? renderPaginationFooter() : null}

                        {pendingOrders > 0 && (
                            <div className="border-t border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/50">
                                <Link
                                    href={route("table-orders.index")}
                                    className="block text-center text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                                >
                                    Lihat Semua Pesanan
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
