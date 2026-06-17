import React, { useState, useRef, useEffect, useMemo } from "react";
import { Link, usePage } from "@inertiajs/react";
import axios from "axios";
import { IconQrcode, IconX } from "@/Utils/icons";

export default function QRNotification() {
    const { pendingTableOrders = [], notificationAccess = {} } = usePage().props;
    const [isOpen, setIsOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [livePendingOrders, setLivePendingOrders] = useState(
        pendingTableOrders
    );
    const dropdownRef = useRef(null);
    const lastSyncedSignatureRef = useRef("");

    const pendingOrders = livePendingOrders.length;
    const canSeeQrNotifications = notificationAccess?.qrOrders === true;
    const pendingTableOrdersSignature = useMemo(
        () =>
            JSON.stringify(
                (pendingTableOrders || []).map((order) => ({
                    id: order.id,
                    updated_at: order.updated_at || null,
                    status: order.status || null,
                    grand_total: Number(order.grand_total || 0),
                }))
            ),
        [pendingTableOrders]
    );

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        window.addEventListener("resize", handleResize);
        handleResize();

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            window.removeEventListener("resize", handleResize);
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
                const nextSignature = JSON.stringify(
                    nextOrders.map((order) => ({
                        id: order.id,
                        updated_at: order.updated_at || null,
                        status: order.status || null,
                        grand_total: Number(order.grand_total || 0),
                    }))
                );

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
                isMobile ? (
                    <div className="fixed top-0 right-0 z-50 w-[300px] h-full transition-all duration-300 transform border-l bg-white dark:bg-slate-950 dark:border-slate-900">
                        <div className="flex justify-between items-center gap-2 p-4 border-b mt-2 dark:border-slate-900">
                            <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">
                                Pesanan QR Meja
                            </h3>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <IconX size={20} className="text-slate-500 dark:text-slate-400" />
                            </button>
                        </div>
                        <div className="p-4">
                            {pendingOrders > 0 ? (
                                <div className="space-y-3">
                                    {livePendingOrders.map((order) => (
                                        <Link
                                            key={order.id}
                                            href={route("transactions.index", {
                                                open_table_order: order.id,
                                            })}
                                            className="block rounded-xl border border-slate-200 px-4 py-3 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-slate-900 dark:text-white">
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
                                                </div>
                                                <div className="shrink-0 text-right">
                                                    <div className="mt-1 h-2 w-2 rounded-full bg-primary-600" />
                                                    <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
                                                        {order.created_at_label}
                                                    </p>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-8 text-center">
                                    <IconQrcode size={32} className="mx-auto text-slate-400 dark:text-slate-600 mb-2" strokeWidth={1.5} />
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        Belum ada pesanan QR
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                                Pesanan QR Meja
                            </h3>
                        </div>
                        
                        {pendingOrders > 0 ? (
                            <div className="max-h-96 overflow-y-auto">
                                {livePendingOrders.map((order) => (
                                    <Link
                                        key={order.id}
                                        href={route("transactions.index", {
                                            open_table_order: order.id,
                                        })}
                                        className="block border-b border-slate-100 px-4 py-3 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-slate-900 dark:text-white">
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
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <div className="mt-1 h-2 w-2 rounded-full bg-primary-600" />
                                                <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
                                                    {order.created_at_label}
                                                </p>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="px-4 py-8 text-center">
                                <IconQrcode size={32} className="mx-auto text-slate-400 dark:text-slate-600 mb-2" strokeWidth={1.5} />
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Belum ada pesanan QR
                                </p>
                            </div>
                        )}
                        
                        {pendingOrders > 0 && (
                            <div className="p-3 bg-slate-50 dark:bg-slate-900/50">
                                <Link
                                    href={route('table-orders.index')}
                                    className="block text-center text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                                >
                                    Lihat Semua Pesanan
                                </Link>
                            </div>
                        )}
                    </div>
                )
            )}
        </div>
    );
}
