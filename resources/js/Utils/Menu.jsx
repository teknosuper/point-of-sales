import React from "react";
import { usePage } from "@inertiajs/react";
import {
    IconBell,
    IconBooks,
    IconDeviceMobile,
    IconBox,
    IconChartArrowsVertical,
    IconChartBar,
    IconChartBarPopular,
    IconChartInfographic,
    IconCirclePlus,
    IconClockHour6,
    IconClipboardCheck,
    IconCreditCard,
    IconCrown,
    IconReceipt2,
    IconFileCertificate,
    IconFileDescription,
    IconFolder,
    IconLayout2,
    IconBuildingStore,
    IconShoppingCart,
    IconTable,
    IconUserShield,
    IconUsers,
    IconUsersPlus,
    IconFileInvoice,
    IconBuildingWarehouse,
    IconCurrencyDollar,
    IconWallet,
    IconTruckDelivery,
    IconTruckReturn,
    IconSpeakerphone,
    IconLock,
    IconPrinter,
    IconChecklist,
} from "@/Utils/icons";
import { useAuthorization } from "./authorization";

function menuItem(title, href, active, icon, permissions = []) {
    return { title, href, active, icon, permissions };
}

export default function Menu() {
    const { url, props } = usePage();
    const { canAny, isSuperAdmin } = useAuthorization();
    const isTenantWorkspace = props?.activeOutlet?.outlet_type === "tenant";
    const canAccess = (permissions = []) =>
        permissions.length === 0 ? true : isSuperAdmin() || canAny(permissions);

    const sections = [
        {
            title: "Utama",
            details: [
                menuItem(
                    "Dashboard",
                    route("dashboard"),
                    url === "/dashboard",
                    <IconLayout2 size={20} strokeWidth={1.5} />,
                    ["dashboard-access"]
                ),
                menuItem(
                    "Panduan",
                    route("guides.outlet-kitchen"),
                    url.startsWith("/dashboard/guides"),
                    <IconBooks size={20} strokeWidth={1.5} />,
                    ["dashboard-access"]
                ),
                menuItem(
                    "Aplikasi & Perangkat",
                    route("guides.pwa-setup"),
                    url.startsWith("/dashboard/guides/pwa-setup"),
                    <IconDeviceMobile size={20} strokeWidth={1.5} />,
                    ["dashboard-access"]
                ),
                menuItem(
                    "Ringkasan Penjualan",
                    route("workspace-sales.index"),
                    url.startsWith("/dashboard/workspace-sales"),
                    <IconChartBar size={20} strokeWidth={1.5} />,
                    ["reports-access"]
                ),
                menuItem(
                    "Ganti Password",
                    route("account.password.edit"),
                    url.startsWith("/dashboard/account/password"),
                    <IconLock size={20} strokeWidth={1.5} />,
                    ["dashboard-access"]
                ),
            ],
        },
        {
            title: "Master",
            details: [
                menuItem(
                    "Kategori",
                    route("categories.index"),
                    url === "/dashboard/categories",
                    <IconFolder size={20} strokeWidth={1.5} />,
                    ["categories-access"]
                ),
                menuItem(
                    "Produk",
                    route("products.index"),
                    url === "/dashboard/products",
                    <IconBox size={20} strokeWidth={1.5} />,
                    ["products-access"]
                ),
                menuItem(
                    "Meja",
                    route("dining-tables.index"),
                    url.startsWith("/dashboard/dining-tables"),
                    <IconTable size={20} strokeWidth={1.5} />,
                    ["dining-tables-access"]
                ),
                menuItem(
                    "Pelanggan",
                    route("customers.index"),
                    url === "/dashboard/customers",
                    <IconUsersPlus size={20} strokeWidth={1.5} />,
                    ["customers-access"]
                ),
                menuItem(
                    "Supplier",
                    route("suppliers.index"),
                    url.startsWith("/dashboard/suppliers"),
                    <IconBuildingWarehouse size={20} strokeWidth={1.5} />,
                    ["suppliers-access"]
                ),
                menuItem(
                    "Outlet & Tenant",
                    route("outlets.index"),
                    url.startsWith("/dashboard/outlets"),
                    <IconBuildingStore size={20} strokeWidth={1.5} />,
                    ["outlets-access"]
                ),
            ],
        },
        {
            title: "Operasional",
            details: [
                menuItem(
                    "Kasir",
                    route("transactions.index"),
                    url === "/dashboard/transactions",
                    <IconShoppingCart size={20} strokeWidth={1.5} />,
                    ["transactions-access"]
                ),
                menuItem(
                    "Riwayat",
                    route("transactions.history"),
                    url === "/dashboard/transactions/history",
                    <IconClockHour6 size={20} strokeWidth={1.5} />,
                    ["transactions-history-access"]
                ),
                menuItem(
                    "Setoran",
                    route("cashier-settlements.index"),
                    url.startsWith("/dashboard/cashier-settlements"),
                    <IconWallet size={20} strokeWidth={1.5} />,
                    ["cashier-settlements-access"]
                ),
                menuItem(
                    "Pesanan Meja",
                    route("table-orders.index"),
                    url.startsWith("/dashboard/table-orders"),
                    <IconDeviceMobile size={20} strokeWidth={1.5} />,
                    ["table-orders-access"]
                ),
                menuItem(
                    "Layar Dapur",
                    route("kitchen.index"),
                    url.startsWith("/dashboard/kitchen"),
                    <IconClipboardCheck size={20} strokeWidth={1.5} />,
                    ["kitchen-access"]
                ),
                menuItem(
                    "Papan Antar",
                    route("waiter-board.index"),
                    url.startsWith("/dashboard/waiter-board"),
                    <IconSpeakerphone size={20} strokeWidth={1.5} />,
                    ["waiter-board-access"]
                ),
                menuItem(
                    "Shift Kasir",
                    route("cashier-shifts.index"),
                    url.startsWith("/dashboard/cashier-shifts"),
                    <IconClockHour6 size={20} strokeWidth={1.5} />,
                    ["cashier-shifts-access"]
                ),
                menuItem(
                    "Retur",
                    route("sales-returns.index"),
                    url.startsWith("/dashboard/sales-returns"),
                    <IconFileCertificate size={20} strokeWidth={1.5} />,
                    ["sales-returns-access"]
                ),
                menuItem(
                    "Piutang",
                    route("receivables.index"),
                    url.startsWith("/dashboard/receivables"),
                    <IconFileInvoice size={20} strokeWidth={1.5} />,
                    ["receivables-access"]
                ),
                menuItem(
                    "Pengingat Piutang",
                    route("aging.index"),
                    url.startsWith("/dashboard/aging"),
                    <IconChartBar size={20} strokeWidth={1.5} />,
                    ["receivables-access"]
                ),
                menuItem(
                    "Hutang Supplier",
                    route("payables.index"),
                    url.startsWith("/dashboard/payables"),
                    <IconCurrencyDollar size={20} strokeWidth={1.5} />,
                    ["payables-access"]
                ),
            ],
        },
        {
            title: "Stok & Pengadaan",
            details: [
                menuItem(
                    "Stock Opname",
                    route("stock-opnames.index"),
                    url.startsWith("/dashboard/stock-opnames"),
                    <IconFileDescription size={20} strokeWidth={1.5} />,
                    ["stock-opnames-access"]
                ),
                menuItem(
                    "Mutasi Stok",
                    route("stock-mutations.index"),
                    url.startsWith("/dashboard/stock-mutations"),
                    <IconChartArrowsVertical size={20} strokeWidth={1.5} />,
                    ["stock-mutations-access"]
                ),
                menuItem(
                    "PO",
                    route("purchase-orders.index"),
                    url.startsWith("/dashboard/purchase-orders"),
                    <IconClipboardCheck size={20} strokeWidth={1.5} />,
                    ["purchase-orders-access"]
                ),
                menuItem(
                    "Penerimaan",
                    route("goods-receivings.index"),
                    url.startsWith("/dashboard/goods-receivings"),
                    <IconTruckDelivery size={20} strokeWidth={1.5} />,
                    ["goods-receivings-access"]
                ),
                menuItem(
                    "Retur Supplier",
                    route("supplier-returns.index"),
                    url.startsWith("/dashboard/supplier-returns"),
                    <IconTruckReturn size={20} strokeWidth={1.5} />,
                    ["supplier-returns-access"]
                ),
            ],
        },
        {
            title: "Pelanggan & Promo",
            details: [
                menuItem(
                    "Member",
                    route("members.index"),
                    url.startsWith("/dashboard/members"),
                    <IconCrown size={20} strokeWidth={1.5} />,
                    ["customers-access"]
                ),
                menuItem(
                    "Promo",
                    route("pricing-rules.index"),
                    url.startsWith("/dashboard/pricing-rules"),
                    <IconChartInfographic size={20} strokeWidth={1.5} />,
                    ["pricing-rules-access"]
                ),
                menuItem(
                    "Voucher",
                    route("customer-vouchers.index"),
                    url.startsWith("/dashboard/customer-vouchers"),
                    <IconCreditCard size={20} strokeWidth={1.5} />,
                    ["customer-vouchers-access"]
                ),
                menuItem(
                    "Segmen",
                    route("customer-segments.index"),
                    url.startsWith("/dashboard/customer-segments"),
                    <IconUsers size={20} strokeWidth={1.5} />,
                    ["customer-segments-access"]
                ),
                menuItem(
                    "Kampanye",
                    route("crm-campaigns.index"),
                    url.startsWith("/dashboard/crm-campaigns"),
                    <IconSpeakerphone size={20} strokeWidth={1.5} />,
                    ["crm-campaigns-access"]
                ),
                menuItem(
                    "Pengingat CRM",
                    route("crm-reminders.index"),
                    url.startsWith("/dashboard/crm-reminders"),
                    <IconClockHour6 size={20} strokeWidth={1.5} />,
                    ["crm-reminders-access"]
                ),
            ],
        },
        {
            title: "Laporan",
            details: [
                menuItem(
                    "Penjualan",
                    route("reports.sales.index"),
                    url.startsWith("/dashboard/reports/sales"),
                    <IconChartArrowsVertical size={20} strokeWidth={1.5} />,
                    ["reports-access"]
                ),
                menuItem(
                    "Profit",
                    route("reports.profits.index"),
                    url.startsWith("/dashboard/reports/profits"),
                    <IconChartBarPopular size={20} strokeWidth={1.5} />,
                    ["profits-access"]
                ),
                menuItem(
                    "Procurement",
                    route("reports.procurement.index"),
                    url.startsWith("/dashboard/reports/procurement"),
                    <IconTruckDelivery size={20} strokeWidth={1.5} />,
                    ["reports-access"]
                ),
                menuItem(
                    "Insight",
                    route("reports.insights.index"),
                    url.startsWith("/dashboard/reports/insights"),
                    <IconChartBar size={20} strokeWidth={1.5} />,
                    ["reports-access"]
                ),
                ...(!isTenantWorkspace
                    ? [
                          menuItem(
                              "Statistik Outlet",
                              route("reports.outlet-analytics.index"),
                              url.startsWith("/dashboard/reports/outlet-analytics"),
                              <IconChartBarPopular size={20} strokeWidth={1.5} />,
                              ["reports-access"]
                          ),
                      ]
                    : []),
            ],
        },
        {
            title: "Pengaturan",
            details: [
                menuItem(
                    "Target",
                    route("settings.target"),
                    url.startsWith("/dashboard/settings/target"),
                    <IconCirclePlus size={20} strokeWidth={1.5} />,
                    ["business-settings-access"]
                ),
                menuItem(
                    "Pengeluaran",
                    route("settings.expenses.index"),
                    url.startsWith("/dashboard/settings/expenses"),
                    <IconReceipt2 size={20} strokeWidth={1.5} />,
                    ["business-settings-access"]
                ),
                menuItem(
                    "Profil Toko",
                    route("settings.store"),
                    url.startsWith("/dashboard/settings/store"),
                    <IconBuildingStore size={20} strokeWidth={1.5} />,
                    ["business-settings-access"]
                ),
                menuItem(
                    "Printer",
                    route("settings.printer"),
                    url.startsWith("/dashboard/settings/printer"),
                    <IconPrinter size={20} strokeWidth={1.5} />,
                    ["business-settings-access"]
                ),
                ...(!isTenantWorkspace
                    ? [
                          menuItem(
                              "Data Repair",
                              route("settings.data-repair"),
                              url.startsWith("/dashboard/settings/data-repair"),
                              <IconChecklist size={20} strokeWidth={1.5} />,
                              ["business-settings-access"]
                          ),
                      ]
                    : []),
                menuItem(
                    "Perangkat Dapur",
                    route("settings.kitchen-devices.index"),
                    url.startsWith("/dashboard/settings/kitchen"),
                    <IconSpeakerphone size={20} strokeWidth={1.5} />,
                    ["kitchen-manage"]
                ),
                menuItem(
                    "Pembayaran",
                    route("settings.payments.edit"),
                    url.startsWith("/dashboard/settings/payments"),
                    <IconCreditCard size={20} strokeWidth={1.5} />,
                    ["payment-settings-access"]
                ),
                menuItem(
                    "Rekening Bank",
                    route("settings.bank-accounts.index"),
                    url.startsWith("/dashboard/settings/bank-accounts"),
                    <IconWallet size={20} strokeWidth={1.5} />,
                    ["payment-settings-access"]
                ),
                menuItem(
                    "Suara Notifikasi",
                    route("settings.notification-sounds.index"),
                    url.startsWith("/dashboard/settings/notification-sounds"),
                    <IconBell size={20} strokeWidth={1.5} />,
                    ["business-settings-access"]
                ),
            ],
        },
        {
            title: "Sistem",
            details: [
                menuItem(
                    "Pengguna",
                    route("users.index"),
                    url.startsWith("/dashboard/users"),
                    <IconUsers size={20} strokeWidth={1.5} />,
                    ["users-access"]
                ),
                menuItem(
                    "Role",
                    route("roles.index"),
                    url.startsWith("/dashboard/roles"),
                    <IconUserShield size={20} strokeWidth={1.5} />,
                    ["roles-access"]
                ),
                menuItem(
                    "Permission",
                    route("permissions.index"),
                    url.startsWith("/dashboard/permissions"),
                    <IconLock size={20} strokeWidth={1.5} />,
                    ["permissions-access"]
                ),
                menuItem(
                    "Audit Log",
                    route("audit-logs.index"),
                    url.startsWith("/dashboard/audit-logs"),
                    <IconFileDescription size={20} strokeWidth={1.5} />,
                    ["audit-logs-access"]
                ),
            ],
        },
    ];

    return sections
        .map((section) => ({
            ...section,
            details: section.details
                .filter((item) => canAccess(item.permissions))
                .map((item) => ({
                    ...item,
                    permissions: true,
                })),
        }))
        .filter((section) => section.details.length > 0);
}
