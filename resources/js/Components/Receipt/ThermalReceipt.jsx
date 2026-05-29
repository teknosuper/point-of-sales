import React from "react";
import {
    PROMO_TOTAL_LABEL,
    promoMetaText,
    REWARD_ITEM_LABEL,
    resolveBuyGetBreakdown,
} from "@/Utils/pricingRules";

const PAYMENT_LABELS = {
    cash: "TUNAI",
    bank_transfer: "TRANSFER BANK",
    midtrans: "MIDTRANS",
    xendit: "XENDIT",
    pay_later: "PIUTANG",
};

const formatPrice = (price = 0, compact = false) =>
    `${compact ? "Rp" : "Rp "}${Number(price || 0).toLocaleString("id-ID")}`;

const formatDateTime = (value, compact = false) =>
    new Date(value).toLocaleString("id-ID", {
        day: "2-digit",
        month: compact ? "2-digit" : "short",
        year: compact ? undefined : "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });

const paymentSummary = (transaction) => {
    const method = String(transaction?.payment_method || "cash").toLowerCase();
    const bankAccount = transaction?.bank_account || transaction?.bankAccount;

    if (method === "bank_transfer") {
        return [bankAccount?.bank_name, bankAccount?.account_number]
            .filter(Boolean)
            .join(" • ");
    }

    if (method === "midtrans" || method === "xendit") {
        return transaction?.payment_reference || null;
    }

    if (method === "pay_later") {
        return "Pembayaran dicatat sebagai piutang";
    }

    return null;
};

const paymentMethodLabel = (transaction) =>
    PAYMENT_LABELS[String(transaction?.payment_method || "cash").toLowerCase()] ||
    String(transaction?.payment_method || "TUNAI")
        .replaceAll("_", " ")
        .toUpperCase();

const paidAmount = (transaction) => {
    const method = String(transaction?.payment_method || "cash").toLowerCase();
    const cash = Number(transaction?.cash || 0);
    const grandTotal = Number(transaction?.grand_total || 0);

    return method === "cash" ? cash : Math.max(cash, grandTotal);
};

const normalizeLineItem = (item) => {
    const qty = Math.max(1, Number(item?.qty || 1));
    const itemTotal = Number(item?.price || 0);
    const modifierTotal = Number(
        item?.modifiers?.reduce(
            (sum, modifier) => sum + Number(modifier.total_price || 0),
            0
        ) || 0
    );
    const baseItemTotal = Math.max(0, itemTotal - modifierTotal);
    const unitPrice = Number(item?.unit_price || 0) || baseItemTotal / qty;

    return {
        qty,
        unitPrice,
        baseItemTotal,
    };
};

const Row = ({ label, value, small = false, strong = false }) => (
    <div
        className={`grid grid-cols-[1fr_auto] gap-3 ${
            small ? "text-[10px]" : ""
        } ${strong ? "font-bold" : ""}`}
    >
        <span className="min-w-0 break-words">{label}</span>
        <span className="text-right whitespace-nowrap">{value}</span>
    </div>
);

const LayoutRows = ({ rows = [], compact = false }) => (
    <>
        {rows.map((row, index) => (
            <Row
                key={`${row.label}-${index}`}
                label={row.label}
                value={row.value}
                small={compact}
                strong={Boolean(row.strong)}
            />
        ))}
    </>
);

const ReceiptLayoutSections = ({ layout, compact = false }) => {
    const items = layout?.items || [];

    return (
        <>
            <div className="my-1">
                <LayoutRows rows={layout?.meta_rows || []} compact={compact} />
            </div>

            <pre>{compact ? "-".repeat(24) : "-".repeat(32)}</pre>

            <div className="my-1">
                {items.map((item, index) => (
                    <div key={`${item.name}-${index}`} className="mb-1">
                        <p className={`font-medium ${compact ? "truncate" : "break-words"}`}>
                            {item.name}
                        </p>
                        {item.promo ? (
                            <p className="text-[10px] text-slate-500">{item.promo}</p>
                        ) : null}
                        <Row
                            label={item.detail_left}
                            value={item.detail_right}
                            small={compact}
                        />
                        {(item.modifiers || []).map((modifier, modifierIndex) => (
                            <Row
                                key={`${modifier.label}-${modifierIndex}`}
                                label={modifier.label}
                                value={modifier.value}
                                small
                            />
                        ))}
                        {item.notes ? (
                            <p className="text-[10px] break-words text-slate-500">
                                * {item.notes}
                            </p>
                        ) : null}
                    </div>
                ))}
            </div>

            <pre>{compact ? "-".repeat(24) : "-".repeat(32)}</pre>

            <div className="my-1">
                <LayoutRows rows={layout?.totals || []} compact={compact} />
            </div>

            <pre>{compact ? "-".repeat(24) : "-".repeat(32)}</pre>

            <div className="my-1">
                <LayoutRows rows={layout?.payments || []} compact={compact} />
            </div>
        </>
    );
};

const ReceiptItems = ({ items, compact = false }) => (
    <div className="my-1">
        {items.map((item, index) => {
            const { qty, unitPrice, baseItemTotal } = normalizeLineItem(item);
            const promoText = promoMetaText(item, {
                compact,
                formatPrice: (value) => formatPrice(value, compact),
            });
            const lineBuyGetBreakdown = resolveBuyGetBreakdown({
                ruleKind: item?.pricing_rule_kind,
                quantity: item?.qty,
                baseUnitPrice: item?.base_unit_price,
                discountTotal: item?.discount_total,
                allowAllFree: false,
            });

            return (
                <div key={item.id || index} className="mb-1">
                    <p className={`font-medium ${compact ? "truncate" : "break-words"}`}>
                        {item.product?.title || item.product_title || "Produk"}
                    </p>
                    {promoText ? (
                        <p className="text-[10px] text-slate-500">{promoText}</p>
                    ) : null}
                    {lineBuyGetBreakdown ? (
                        <>
                            <Row
                                label={`${lineBuyGetBreakdown.payableQty}x @ ${formatPrice(
                                    lineBuyGetBreakdown.paidUnitPrice,
                                    compact
                                )}`}
                                value={formatPrice(
                                    lineBuyGetBreakdown.payableQty *
                                        lineBuyGetBreakdown.paidUnitPrice,
                                    compact
                                )}
                                small={compact}
                            />
                            <Row
                                label={`${lineBuyGetBreakdown.bonusQty}x @ ${formatPrice(
                                    0,
                                    compact
                                )}`}
                                value={formatPrice(0, compact)}
                                small
                            />
                        </>
                    ) : (
                        <Row
                            label={`${qty}x @ ${formatPrice(unitPrice, compact)}`}
                            value={formatPrice(baseItemTotal, compact)}
                            small={compact}
                        />
                    )}
                    {item.modifiers?.map((modifier) => (
                        <Row
                            key={modifier.id}
                            label={`+ ${modifier.name}`}
                            value={formatPrice(modifier.total_price, compact)}
                            small
                        />
                    ))}
                    {item.notes ? (
                        <p className="text-[10px] break-words text-slate-500">
                            * {item.notes}
                        </p>
                    ) : null}
                </div>
            );
        })}
    </div>
);

const ReceiptTotals = ({ transaction, compact = false }) => {
    const items = transaction?.details ?? [];
    const promoDiscount = items.reduce(
        (sum, item) => sum + Number(item.discount_total || 0),
        0
    );
    const loyaltyDiscount = Number(transaction?.loyalty_discount_total || 0);
    const voucherDiscount = Number(transaction?.customer_voucher_discount || 0);
    const manualDiscount = Number(transaction?.discount || 0);
    const shippingCost = Number(transaction?.shipping_cost || 0);
    const grandTotal = Number(transaction?.grand_total || 0);
    const subtotal =
        grandTotal +
        manualDiscount -
        shippingCost +
        promoDiscount +
        loyaltyDiscount +
        voucherDiscount;

    return (
        <>
            <Row
                label="Subtotal"
                value={formatPrice(subtotal, compact)}
                small={compact}
            />
            {promoDiscount > 0 ? (
                <Row
                    label="Potongan Promo"
                    value={`-${formatPrice(promoDiscount, compact)}`}
                    small={compact}
                />
            ) : null}
            {manualDiscount > 0 ? (
                <Row
                    label="Diskon Manual"
                    value={`-${formatPrice(manualDiscount, compact)}`}
                    small={compact}
                />
            ) : null}
            {voucherDiscount > 0 ? (
                <Row
                    label="Voucher"
                    value={`-${formatPrice(voucherDiscount, compact)}`}
                    small={compact}
                />
            ) : null}
            {loyaltyDiscount > 0 ? (
                <Row
                    label="Redeem Poin"
                    value={`-${formatPrice(loyaltyDiscount, compact)}`}
                    small={compact}
                />
            ) : null}
            {shippingCost > 0 ? (
                <Row
                    label="Ongkir"
                    value={formatPrice(shippingCost, compact)}
                    small={compact}
                />
            ) : null}
            <Row
                label="TOTAL"
                value={formatPrice(grandTotal, compact)}
                strong
            />
        </>
    );
};

const ReceiptPayment = ({ transaction, compact = false }) => {
    const methodKey = String(transaction?.payment_method || "cash").toLowerCase();
    const summary = paymentSummary(transaction);

    return (
        <>
            <Row
                label="Metode Bayar"
                value={paymentMethodLabel(transaction)}
                small={compact}
            />
            {summary ? (
                <p className="text-[10px] break-words text-slate-500">{summary}</p>
            ) : null}
            <Row
                label={methodKey === "cash" ? "Bayar" : "Nominal Bayar"}
                value={formatPrice(paidAmount(transaction), compact)}
                small={compact}
            />
            {Number(transaction?.change || 0) > 0 ? (
                <Row
                    label="Kembali"
                    value={formatPrice(transaction?.change, compact)}
                    strong
                />
            ) : null}
        </>
    );
};

const SimpleBarcode = ({ value, compact = false }) => {
    const bars = (value || "").split("").map((char, idx) => {
        const weight = (char.charCodeAt(0) + idx * 17) % (compact ? 4 : 5);
        return 2 + weight;
    });

    return (
        <div className="flex items-end justify-center gap-[2px] mt-2">
            {bars.map((width, index) => (
                <span
                    key={index}
                    style={{ width: `${width}px` }}
                    className={`${compact ? "h-8" : "h-10"} bg-black block`}
                />
            ))}
        </div>
    );
};

export default function ThermalReceipt({
    transaction,
    layout = null,
    storeName = "TOKO ANDA",
    storeAddress = "",
    storePhone = "",
    storeEmail = "",
    storeWebsite = "",
}) {
    const items = transaction?.details ?? [];
    const line = "=".repeat(32);
    const dashLine = "-".repeat(32);

    return (
        <div
            className="thermal-receipt font-mono text-xs leading-tight"
            style={{ width: "80mm", padding: "4mm" }}
        >
            <div className="text-center mb-2">
                <p className="text-sm font-bold">{storeName}</p>
                {storeAddress && <p className="text-xs">{storeAddress}</p>}
                {storePhone && <p className="text-xs">Telp: {storePhone}</p>}
                {storeEmail && <p className="text-xs">Email: {storeEmail}</p>}
                {storeWebsite && <p className="text-xs">{storeWebsite}</p>}
            </div>

            <pre className="whitespace-pre-wrap">{line}</pre>
            {layout ? (
                <ReceiptLayoutSections layout={layout} />
            ) : (
                <>
                    <div className="my-1">
                        <Row label="No:" value={transaction?.invoice} />
                        <Row
                            label="Tgl:"
                            value={formatDateTime(transaction?.created_at)}
                        />
                        <Row label="Kasir:" value={transaction?.cashier?.name || "-"} />
                        <Row
                            label="Pelanggan:"
                            value={transaction?.customer?.name || "Umum"}
                        />
                        <Row
                            label="Pesanan:"
                            value={
                                transaction?.order_type === "dine_in"
                                    ? "Makan di Tempat"
                                    : "Bawa Pulang"
                            }
                        />
                        {transaction?.dining_table?.name ? (
                            <Row
                                label="Meja:"
                                value={
                                    transaction.dining_table.code ||
                                    transaction.dining_table.name
                                }
                            />
                        ) : null}
                        {transaction?.waiter?.name ? (
                            <Row
                                label="Petugas Antar:"
                                value={transaction.waiter.name}
                            />
                        ) : null}
                    </div>

                    <pre className="whitespace-pre-wrap">{line}</pre>

                    <ReceiptItems items={items} />

                    <pre className="whitespace-pre-wrap">{dashLine}</pre>

                    <div className="my-1">
                        <ReceiptTotals transaction={transaction} />
                    </div>

                    <pre className="whitespace-pre-wrap">{dashLine}</pre>

                    <div className="my-1">
                        <ReceiptPayment transaction={transaction} />
                    </div>
                </>
            )}

            <pre className="whitespace-pre-wrap">{line}</pre>

            <div className="text-center mt-2">
                <p className="text-xs">Terima kasih</p>
                <p className="text-xs">Barang yang sudah dibeli</p>
                <p className="text-xs">tidak dapat ditukar/dikembalikan</p>
                <p className="text-xs mt-1">#{transaction?.invoice}</p>
                <SimpleBarcode value={transaction?.invoice} />
            </div>

            <style>{`
                @media print {
                    .thermal-receipt {
                        width: 80mm !important;
                        margin: 0 !important;
                        padding: 2mm !important;
                        font-size: 10pt !important;
                    }
                    @page {
                        size: 80mm auto;
                        margin: 0;
                    }
                }
            `}</style>
        </div>
    );
}

export function ThermalReceipt58mm({
    transaction,
    layout = null,
    storeName = "TOKO",
    storePhone = "",
    storeEmail = "",
    storeWebsite = "",
}) {
    const items = transaction?.details ?? [];
    const line = "-".repeat(24);

    return (
        <div
            className="thermal-receipt-58 font-mono text-xs"
            style={{ width: "58mm", padding: "2mm" }}
        >
            <div className="text-center">
                <p className="font-bold">{storeName}</p>
                {storePhone && <p>{storePhone}</p>}
                {storeEmail && <p className="text-[10px]">{storeEmail}</p>}
                {storeWebsite && <p className="text-[10px]">{storeWebsite}</p>}
            </div>

            <pre>{line}</pre>
            {layout ? (
                <ReceiptLayoutSections layout={layout} compact />
            ) : (
                <>
                    <p>#{transaction?.invoice}</p>
                    <p>{formatDateTime(transaction?.created_at, true)}</p>
                    <p>
                        {transaction?.order_type === "dine_in"
                            ? "Makan di Tempat"
                            : "Bawa Pulang"}
                    </p>
                    {transaction?.dining_table?.name ? (
                        <p>
                            Meja{" "}
                            {transaction.dining_table.code ||
                                transaction.dining_table.name}
                        </p>
                    ) : null}
                    <pre>{line}</pre>

                    <ReceiptItems items={items} compact />

                    <pre>{line}</pre>
                    <ReceiptTotals transaction={transaction} compact />
                    <ReceiptPayment transaction={transaction} compact />
                </>
            )}
            <pre>{line}</pre>
            <p className="text-center">Terima kasih!</p>
            <SimpleBarcode value={transaction?.invoice} compact />

            <style>{`
                @media print {
                    .thermal-receipt-58 {
                        width: 58mm !important;
                        font-size: 9pt !important;
                    }
                    @page { size: 58mm auto; margin: 0; }
                }
            `}</style>
        </div>
    );
}
