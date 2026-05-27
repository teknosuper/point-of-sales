import React, { useState } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, Link, router } from "@inertiajs/react";
import Button from "@/Components/Dashboard/Button";
import Table from "@/Components/Dashboard/Table";
import { useAuthorization } from "@/Utils/authorization";
import {
    IconArrowLeft,
    IconCheck,
    IconChevronDown,
    IconChevronUp,
    IconCircleX,
    IconPackage,
    IconTruckDelivery,
} from "@tabler/icons-react";
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

const statusBadge = (status) => {
    const base = "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold";
    const map = {
        draft: "bg-warning-100 text-warning-700 dark:bg-warning-950/30 dark:text-warning-400",
        ordered: "bg-primary-100 text-primary-700 dark:bg-primary-950/30 dark:text-primary-400",
        partial_received: "bg-accent-100 text-accent-700 dark:bg-accent-950/30 dark:text-accent-400",
        completed: "bg-success-100 text-success-700 dark:bg-success-950/30 dark:text-success-400",
        cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400",
    };
    const labels = {
        draft: "Draft",
        ordered: "Dipesan",
        partial_received: "Sebagian Diterima",
        completed: "Selesai",
        cancelled: "Dibatalkan",
    };
    return <span className={`${base} ${map[status] || map.draft}`}>{labels[status] || status}</span>;
};

export default function Show({ order }) {
    const { can } = useAuthorization();
    const canEdit = can("purchase-orders-update");
    const canCreateReceiving = can("goods-receivings-create");
    const [showReceivings, setShowReceivings] = useState(true);
    const [showNotes, setShowNotes] = useState(Boolean(order.notes));
    const [showPayableInfo, setShowPayableInfo] = useState(Boolean(order.payable));
    const [showOrderInfo, setShowOrderInfo] = useState(false);

    const placeOrder = () => {
        router.post(route("purchase-orders.place", order.id), {}, {
            preserveScroll: true,
            onSuccess: () => toast.success("PO berhasil dipesan"),
            onError: () => toast.error("Gagal memesan PO"),
        });
    };

    const cancelOrder = () => {
        router.post(route("purchase-orders.cancel", order.id), {}, {
            preserveScroll: true,
            onSuccess: () => toast.success("PO dibatalkan"),
            onError: () => toast.error("Gagal membatalkan PO"),
        });
    };

    const canPlace = order.status === "draft" && canEdit;
    const canCancel = ["draft", "ordered", "partial_received"].includes(order.status) && canEdit;

    return (
        <>
            <Head title={order.document_number} />
            <div className="mb-6">
                <Link
                    href={route("purchase-orders.index")}
                    className="mb-3 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary-600"
                >
                    <IconArrowLeft size={16} />
                    Kembali ke daftar PO
                </Link>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <div className="mb-2 flex items-center gap-2">
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                                Detail Purchase Order
                            </h1>
                            {statusBadge(order.status)}
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Dokumen {order.document_number} untuk pembelian ke supplier.
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Supplier: {order.supplier?.name || "-"} &bull; Dibuat oleh {order.creator?.name || "-"} &bull; {formatDateTime(order.created_at)}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {canPlace && (
                            <Button
                                type="button"
                                icon={<IconCheck size={18} />}
                                className="bg-primary-500 hover:bg-primary-600 text-white"
                                label="Pesan ke Supplier"
                                onClick={placeOrder}
                            />
                        )}
                        {canCancel && (
                            <Button
                                type="button"
                                icon={<IconCircleX size={18} />}
                                className="bg-rose-500 hover:bg-rose-600 text-white"
                                label="Batalkan PO"
                                onClick={cancelOrder}
                            />
                        )}
                        {canCreateReceiving && ["ordered", "partial_received"].includes(order.status) && (
                            <Button
                                type="link"
                                href={route("goods-receivings.create", { purchase_order_id: order.id })}
                                icon={<IconTruckDelivery size={18} />}
                                className="bg-success-500 hover:bg-success-600 text-white"
                                label="Terima Barang"
                            />
                        )}
                    </div>
                </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
                <div className="space-y-6">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
                            Item Purchase Order
                        </h2>
                        <Table>
                            <Table.Thead>
                                <tr>
                                    <Table.Th>Produk</Table.Th>
                                    <Table.Th>Qty Dipesan</Table.Th>
                                    <Table.Th>Qty Diterima</Table.Th>
                                    <Table.Th>Sisa</Table.Th>
                                    <Table.Th>Harga Satuan</Table.Th>
                                    <Table.Th>Subtotal</Table.Th>
                                </tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {order.items.length > 0 ? (
                                    order.items.map((item) => {
                                        const remaining = item.qty_ordered - item.qty_received;
                                        return (
                                            <tr key={item.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                <Table.Td>
                                                    <p className="font-medium text-slate-800 dark:text-slate-200">
                                                        {item.product?.title || "Produk #" + item.product_id}
                                                    </p>
                                                    <p className="text-xs text-slate-500">{item.product?.sku || "-"}</p>
                                                </Table.Td>
                                                <Table.Td>{item.qty_ordered}</Table.Td>
                                                <Table.Td>{item.qty_received}</Table.Td>
                                                <Table.Td>
                                                    <span className={`font-semibold ${remaining > 0 ? "text-warning-600" : "text-success-600"}`}>
                                                        {remaining}
                                                    </span>
                                                </Table.Td>
                                                <Table.Td>{formatCurrency(item.unit_price)}</Table.Td>
                                                <Table.Td className="font-semibold">{formatCurrency(item.qty_ordered * item.unit_price)}</Table.Td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <Table.Empty colSpan={6} message={
                                        <div className="text-slate-500 dark:text-slate-400">Tidak ada item pada PO ini.</div>
                                    }>
                                        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                                            <IconPackage size={28} className="text-slate-400" />
                                        </div>
                                    </Table.Empty>
                                )}
                            </Table.Tbody>
                        </Table>
                    </div>

                    {order.goods_receivings?.length > 0 && (
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                        Riwayat Penerimaan
                                    </h2>
                                    <p className="text-xs text-slate-500">Buka jika ingin melihat penerimaan barang dari PO ini.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowReceivings((prev) => !prev)}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    {showReceivings ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                                    {showReceivings ? "Sembunyikan" : "Buka"}
                                </button>
                            </div>
                            {showReceivings && (
                                <Table className="mt-4">
                                    <Table.Thead>
                                        <tr>
                                            <Table.Th>Dokumen</Table.Th>
                                            <Table.Th>Tanggal Terima</Table.Th>
                                            <Table.Th>Item</Table.Th>
                                            <Table.Th>Aksi</Table.Th>
                                        </tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {order.goods_receivings.map((gr) => (
                                            <tr key={gr.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                <Table.Td className="font-medium">{gr.document_number}</Table.Td>
                                                <Table.Td>{formatDateTime(gr.received_at)}</Table.Td>
                                                <Table.Td>{gr.items?.length || 0}</Table.Td>
                                                <Table.Td>
                                                    <Link
                                                        href={route("goods-receivings.show", gr.id)}
                                                        className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
                                                    >
                                                        Detail
                                                    </Link>
                                                </Table.Td>
                                            </tr>
                                        ))}
                                    </Table.Tbody>
                                </Table>
                            )}
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    {order.notes && (
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Catatan</h2>
                                    <p className="text-xs text-slate-500">Buka jika ada catatan khusus di PO ini.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowNotes((prev) => !prev)}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    {showNotes ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                                    {showNotes ? "Sembunyikan" : "Buka"}
                                </button>
                            </div>
                            {showNotes && (
                                <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{order.notes}</p>
                            )}
                        </div>
                    )}

                    {order.payable && (
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Hutang Supplier</h2>
                                    <p className="text-xs text-slate-500">Buka jika ingin melihat tagihan dari PO ini.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowPayableInfo((prev) => !prev)}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    {showPayableInfo ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                                    {showPayableInfo ? "Sembunyikan" : "Buka"}
                                </button>
                            </div>
                            {showPayableInfo && (
                                <div className="mt-3 space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Dokumen</span>
                                        <span className="font-medium text-slate-800 dark:text-slate-200">{order.payable.document_number}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Total</span>
                                        <span className="font-medium text-slate-800 dark:text-slate-200">{formatCurrency(order.payable.total)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Dibayar</span>
                                        <span className="font-medium text-slate-800 dark:text-slate-200">{formatCurrency(order.payable.paid)}</span>
                                    </div>
                                    <Link
                                        href={route("payables.show", order.payable.id)}
                                        className="mt-3 inline-flex text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
                                    >
                                        Lihat detail hutang
                                    </Link>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Informasi</h2>
                                <p className="text-xs text-slate-500">Buka jika ingin melihat langkah singkat proses PO.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowOrderInfo((prev) => !prev)}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                {showOrderInfo ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                                {showOrderInfo ? "Sembunyikan" : "Buka"}
                            </button>
                        </div>
                        {showOrderInfo && (
                            <div className="mt-4 space-y-3 text-sm text-slate-500 dark:text-slate-400">
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                                    <p className="font-medium text-slate-700 dark:text-slate-200">Alur PO</p>
                                    <ul className="mt-2 space-y-2">
                                        <li>1. Buat PO sebagai draft.</li>
                                        <li>2. Pesan ke supplier agar status berubah jadi dipesan.</li>
                                        <li>3. Terima barang saat supplier mengirim.</li>
                                        <li>4. Tagihan supplier akan tercatat otomatis.</li>
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

Show.layout = (page) => <DashboardLayout children={page} />;
