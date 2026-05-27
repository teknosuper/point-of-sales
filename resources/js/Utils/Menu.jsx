import { usePage } from "@inertiajs/react";
import {
    IconBooks,
    IconDeviceMobile,
    IconBox,
    IconCategory,
    IconChartArrowsVertical,
    IconChartBar,
    IconChartBarPopular,
    IconChartInfographic,
    IconCirclePlus,
    IconClockHour6,
    IconClipboardCheck,
    IconCreditCard,
    IconCrown,
    IconFileCertificate,
    IconFileDescription,
    IconFolder,
    IconGift,
    IconLayout2,
    IconBuildingStore,
    IconSchool,
    IconShoppingCart,
    IconTable,
    IconUserBolt,
    IconUserShield,
    IconUserSquare,
    IconUsers,
    IconUsersPlus,
    IconFileInvoice,
    IconBuildingWarehouse,
    IconCurrencyDollar,
    IconWallet,
    IconFileSearch,
    IconTruckDelivery,
    IconTruckReturn,
    IconSpeakerphone,
    IconLock,
    IconPrinter,
} from "@tabler/icons-react";
import hasAnyPermission from "./Permission";
import React from "react";

export default function Menu() {
    // define use page
    const page = usePage();
    const { url } = page;
    const { auth } = page.props;
    const isKitchenWorkspace = auth?.user?.preferred_workspace === "kitchen";

    if (isKitchenWorkspace) {
        return [
            {
                title: "Utama",
                details: [
                    {
                        title: "Dashboard",
                        href: route("dashboard"),
                        active: url === "/dashboard",
                        icon: <IconLayout2 size={20} strokeWidth={1.5} />,
                        permissions: hasAnyPermission(["dashboard-access"]),
                    },
                    {
                        title: "Aplikasi & Perangkat",
                        href: route("guides.pwa-setup"),
                        active: url.startsWith("/dashboard/guides/pwa-setup"),
                        icon: <IconDeviceMobile size={20} strokeWidth={1.5} />,
                        permissions: hasAnyPermission(["dashboard-access"]),
                    },
                    {
                        title: "Ringkasan Penjualan",
                        href: route("workspace-sales.index"),
                        active: url.startsWith("/dashboard/workspace-sales"),
                        icon: <IconChartBar size={20} strokeWidth={1.5} />,
                        permissions: hasAnyPermission(["dashboard-access"]),
                    },
                    {
                        title: "Setoran",
                        href: route("cashier-settlements.index"),
                        active: url.startsWith("/dashboard/cashier-settlements"),
                        icon: <IconWallet size={20} strokeWidth={1.5} />,
                        permissions: hasAnyPermission(["dashboard-access"]),
                    },
                    {
                        title: "Ganti Password",
                        href: route("account.password.edit"),
                        active: url.startsWith("/dashboard/account/password"),
                        icon: <IconLock size={20} strokeWidth={1.5} />,
                        permissions: hasAnyPermission(["dashboard-access"]),
                    },
                ],
            },
            {
                title: "Dapur",
                details: [
                    {
                        title: "Layar Dapur",
                        href: route("kitchen.index"),
                        active: url.startsWith("/dashboard/kitchen"),
                        icon: <IconClipboardCheck size={20} strokeWidth={1.5} />,
                        permissions: hasAnyPermission(["dashboard-access"]),
                    },
                    {
                        title: "Papan Antar",
                        href: route("waiter-board.index"),
                        active: url.startsWith("/dashboard/waiter-board"),
                        icon: <IconSpeakerphone size={20} strokeWidth={1.5} />,
                        permissions: hasAnyPermission(["waiter-board-access"]),
                    },
                    {
                        title: "Perangkat Dapur",
                        href: route("settings.kitchen-devices.index"),
                        active: url === "/dashboard/settings/kitchen-devices",
                        icon: <IconSpeakerphone size={20} strokeWidth={1.5} />,
                        permissions: hasAnyPermission(["dashboard-access"]),
                    },
                ],
            },
            {
                title: "Master & Stok",
                details: [
                    {
                        title: "Kategori",
                        href: route("categories.index"),
                        active: url === "/dashboard/categories",
                        icon: <IconFolder size={20} strokeWidth={1.5} />,
                        permissions: hasAnyPermission(["categories-access"]),
                    },
                    {
                        title: "Produk",
                        href: route("products.index"),
                        active: url === "/dashboard/products",
                        icon: <IconBox size={20} strokeWidth={1.5} />,
                        permissions: hasAnyPermission(["products-access"]),
                    },
                    {
                        title: "Stock Opname",
                        href: route("stock-opnames.index"),
                        active: url.startsWith("/dashboard/stock-opnames"),
                        icon: <IconFileDescription size={20} strokeWidth={1.5} />,
                        permissions: hasAnyPermission(["stock-opnames-access"]),
                    },
                    {
                        title: "Mutasi Stok",
                        href: route("stock-mutations.index"),
                        active: url.startsWith("/dashboard/stock-mutations"),
                        icon: <IconChartArrowsVertical size={20} strokeWidth={1.5} />,
                        permissions: hasAnyPermission(["stock-mutations-access"]),
                    },
                ],
            },
        ];
    }

    // define menu navigations
    const menuNavigation = [
        {
            title: "Utama",
            details: [
                {
                    title: "Dashboard",
                    href: route("dashboard"),
                    active: url === "/dashboard" ? true : false, // Update comparison here
                    icon: <IconLayout2 size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["dashboard-access"]),
                },
                {
                    title: "Panduan",
                    href: route("guides.outlet-kitchen"),
                    active: url.startsWith("/dashboard/guides/outlet-kitchen"),
                    icon: <IconBooks size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["dashboard-access"]),
                },
                {
                    title: "Aplikasi & Perangkat",
                    href: route("guides.pwa-setup"),
                    active: url.startsWith("/dashboard/guides/pwa-setup"),
                    icon: <IconDeviceMobile size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["dashboard-access"]),
                },
                {
                    title: "Ringkasan Penjualan",
                    href: route("workspace-sales.index"),
                    active: url.startsWith("/dashboard/workspace-sales"),
                    icon: <IconChartBar size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["dashboard-access"]),
                },
            ],
        },
        {
            title: "Master",
            details: [
                {
                    title: "Kategori",
                    href: route("categories.index"),
                    active: url === "/dashboard/categories" ? true : false, // Update comparison here
                    icon: <IconFolder size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["categories-access"]),
                },
                {
                    title: "Produk",
                    href: route("products.index"),
                    active: url === "/dashboard/products" ? true : false, // Update comparison here
                    icon: <IconBox size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["products-access"]),
                },
                {
                    title: "Meja",
                    href: route("dining-tables.index"),
                    active: url.startsWith("/dashboard/dining-tables"),
                    icon: <IconTable size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["dining-tables-access"]),
                },
                {
                    title: "Pelanggan",
                    href: route("customers.index"),
                    active: url === "/dashboard/customers" ? true : false, // Update comparison here
                    icon: <IconUsersPlus size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["customers-access"]),
                },
                {
                    title: "Supplier",
                    href: route("suppliers.index"),
                    active: url.startsWith("/dashboard/suppliers"),
                    icon: <IconBuildingWarehouse size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["suppliers-access"]),
                },
                {
                    title: "Outlet & Tenant",
                    href: route("outlets.index"),
                    active: url.startsWith("/dashboard/outlets"),
                    icon: <IconBuildingStore size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["dashboard-access"]),
                },
            ],
        },
        {
            title: "Penjualan",
            details: [
                {
                    title: "Kasir",
                    href: route("transactions.index"),
                    active: url === "/dashboard/transactions" ? true : false, // Update comparison here
                    icon: <IconShoppingCart size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["transactions-access"]),
                },
                {
                    title: "Riwayat",
                    href: route("transactions.history"),
                    active:
                        url === "/dashboard/transactions/history"
                            ? true
                            : false,
                    icon: <IconClockHour6 size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["transactions-access"]),
                },
                {
                    title: "Setoran",
                    href: route("cashier-settlements.index"),
                    active: url.startsWith("/dashboard/cashier-settlements"),
                    icon: <IconWallet size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["dashboard-access"]),
                },
                {
                    title: "Pesanan Meja",
                    href: route("table-orders.index"),
                    active: url.startsWith("/dashboard/table-orders"),
                    icon: <IconDeviceMobile size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["table-orders-access"]),
                },
                {
                    title: "Kitchen Queue",
                    href: route("kitchen.index"),
                    active: url.startsWith("/dashboard/kitchen"),
                    icon: <IconClipboardCheck size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["dashboard-access"]),
                },
                {
                    title: "Retur",
                    href: route("sales-returns.index"),
                    active: url.startsWith("/dashboard/sales-returns"),
                    icon: <IconFileCertificate size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["sales-returns-access"]),
                },
                {
                    title: "Piutang",
                    href: route("receivables.index"),
                    active: url.startsWith("/dashboard/receivables"),
                    icon: <IconFileInvoice size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["receivables-access"]),
                },
                {
                    title: "Pengingat Piutang",
                    href: route("aging.index"),
                    active: url.startsWith("/dashboard/aging"),
                    icon: <IconChartBar size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["receivables-access"]),
                },
            ],
        },
        {
            title: "Stok",
            details: [
                {
                    title: "Stock Opname",
                    href: route("stock-opnames.index"),
                    active: url.startsWith("/dashboard/stock-opnames"),
                    icon: <IconFileDescription size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["stock-opnames-access"]),
                },
                {
                    title: "Mutasi Stok",
                    href: route("stock-mutations.index"),
                    active: url.startsWith("/dashboard/stock-mutations"),
                    icon: (
                        <IconChartArrowsVertical size={20} strokeWidth={1.5} />
                    ),
                    permissions: hasAnyPermission(["stock-mutations-access"]),
                },
            ],
        },
        {
            title: "Pengadaan",
            details: [
                {
                    title: "PO",
                    href: route("purchase-orders.index"),
                    active: url.startsWith("/dashboard/purchase-orders"),
                    icon: <IconClipboardCheck size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["purchase-orders-access"]),
                },
                {
                    title: "Penerimaan",
                    href: route("goods-receivings.index"),
                    active: url.startsWith("/dashboard/goods-receivings"),
                    icon: <IconTruckDelivery size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["goods-receivings-access"]),
                },
                {
                    title: "Retur Supplier",
                    href: route("supplier-returns.index"),
                    active: url.startsWith("/dashboard/supplier-returns"),
                    icon: <IconTruckReturn size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["supplier-returns-access"]),
                },
                {
                    title: "Hutang Supplier",
                    href: route("payables.index"),
                    active: url.startsWith("/dashboard/payables"),
                    icon: <IconCurrencyDollar size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["payables-access"]),
                },
            ],
        },
        {
            title: "Pelanggan & Promo",
            details: [
                {
                    title: "Member",
                    href: route("members.index"),
                    active: url.startsWith("/dashboard/members"),
                    icon: <IconCrown size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["customers-access"]),
                },
                {
                    title: "Promo",
                    href: route("pricing-rules.index"),
                    active: url.startsWith("/dashboard/pricing-rules"),
                    icon: <IconChartInfographic size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["pricing-rules-access"]),
                },
                {
                    title: "Voucher",
                    href: route("customer-vouchers.index"),
                    active: url.startsWith("/dashboard/customer-vouchers"),
                    icon: <IconCreditCard size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["customer-vouchers-access"]),
                },
                {
                    title: "Segmen",
                    href: route("customer-segments.index"),
                    active: url.startsWith("/dashboard/customer-segments"),
                    icon: <IconUsers size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["customer-segments-access"]),
                },
                {
                    title: "Kampanye",
                    href: route("crm-campaigns.index"),
                    active: url.startsWith("/dashboard/crm-campaigns"),
                    icon: <IconSpeakerphone size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["crm-campaigns-access"]),
                },
                {
                    title: "Pengingat CRM",
                    href: route("crm-reminders.index"),
                    active: url.startsWith("/dashboard/crm-reminders"),
                    icon: <IconClockHour6 size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["crm-reminders-access"]),
                },
            ],
        },
        {
            title: "Laporan",
            details: [
                {
                    title: "Penjualan",
                    href: route("reports.sales.index"),
                    active: url.startsWith("/dashboard/reports/sales"),
                    icon: (
                        <IconChartArrowsVertical size={20} strokeWidth={1.5} />
                    ),
                    permissions: hasAnyPermission(["reports-access"]),
                },
                {
                    title: "Profit",
                    href: route("reports.profits.index"),
                    active: url.startsWith("/dashboard/reports/profits"),
                    icon: <IconChartBarPopular size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["profits-access"]),
                },
                {
                    title: "Procurement",
                    href: route("reports.procurement.index"),
                    active: url.startsWith("/dashboard/reports/procurement"),
                    icon: <IconTruckDelivery size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["reports-access"]),
                },
                {
                    title: "Insight",
                    href: route("reports.insights.index"),
                    active: url.startsWith("/dashboard/reports/insights"),
                    icon: <IconChartBar size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["reports-access"]),
                },
                {
                    title: "Statistik Outlet",
                    href: route("reports.outlet-analytics.index"),
                    active: url.startsWith("/dashboard/reports/outlet-analytics"),
                    icon: <IconChartBarPopular size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["reports-access"]),
                },
                {
                    title: "Audit Setup",
                    href: route("reports.setup-audit.index"),
                    active: url.startsWith("/dashboard/reports/setup-audit"),
                    icon: <IconFileSearch size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["reports-access"]),
                },
            ],
        },
        {
            title: "Operasional",
            details: [
                {
                    title: "Shift Kasir",
                    href: route("cashier-shifts.index"),
                    active: url.startsWith("/dashboard/cashier-shifts"),
                    icon: <IconWallet size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["cashier-shifts-access"]),
                },
                {
                    title: "Audit Log",
                    href: route("audit-logs.index"),
                    active: url.startsWith("/dashboard/audit-logs"),
                    icon: <IconFileSearch size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["audit-logs-access"]),
                },
            ],
        },
        {
            title: "Pengguna & Akses",
            details: [
                {
                    title: "Permission",
                    href: route("permissions.index"),
                    active: url === "/dashboard/permissions" ? true : false, // Update comparison here
                    icon: <IconUserBolt size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["permissions-access"]),
                },
                {
                    title: "Role",
                    href: route("roles.index"),
                    active: url === "/dashboard/roles" ? true : false, // Update comparison here
                    icon: <IconUserShield size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["roles-access"]),
                },
                {
                    title: "Pengguna",
                    icon: <IconUsers size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["users-access"]),
                    subdetails: [
                        {
                            title: "Daftar Pengguna",
                            href: route("users.index"),
                            icon: <IconTable size={20} strokeWidth={1.5} />,
                            active: url === "/dashboard/users" ? true : false,
                            permissions: hasAnyPermission(["users-access"]),
                        },
                        {
                            title: "Tambah Pengguna",
                            href: route("users.create"),
                            icon: (
                                <IconCirclePlus size={20} strokeWidth={1.5} />
                            ),
                            active:
                                url === "/dashboard/users/create"
                                    ? true
                                    : false,
                            permissions: hasAnyPermission(["users-create"]),
                        },
                    ],
                },
            ],
        },
        {
            title: "Pengaturan",
            details: [
                {
                    title: "Pembayaran",
                    href: route("settings.payments.edit"),
                    active: url === "/dashboard/settings/payments",
                    icon: <IconCreditCard size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["payment-settings-access"]),
                },
                {
                    title: "Profil Toko",
                    href: route("settings.store"),
                    active: url === "/dashboard/settings/store",
                    icon: <IconBuildingStore size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["dashboard-access"]),
                },
                {
                    title: "Rekening",
                    href: route("settings.bank-accounts.index"),
                    active: url === "/dashboard/settings/bank-accounts",
                    icon: <IconCreditCard size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["payment-settings-access"]),
                },
                {
                    title: "Loyalti",
                    href: route("settings.loyalty"),
                    active: url === "/dashboard/settings/loyalty",
                    icon: <IconGift size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["dashboard-access"]),
                },
                {
                    title: "Dapur & Printer",
                    href: route("settings.kitchen-devices.index"),
                    active: url === "/dashboard/settings/kitchen-devices",
                    icon: <IconSpeakerphone size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["dashboard-access"]),
                },
                {
                    title: "Printer Kasir",
                    href: route("settings.printer"),
                    active: url === "/dashboard/settings/printer",
                    icon: <IconPrinter size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["dashboard-access"]),
                },
                {
                    title: "Target",
                    href: route("settings.target"),
                    active: url === "/dashboard/settings/target",
                    icon: <IconChartInfographic size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["dashboard-access"]),
                },
                {
                    title: "Ganti Password",
                    href: route("account.password.edit"),
                    active: url.startsWith("/dashboard/account/password"),
                    icon: <IconLock size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["dashboard-access"]),
                },
            ],
        },
    ];

    return menuNavigation;
}
