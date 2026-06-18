<?php

namespace App\Support;

class RbacPresetCatalog
{
    public static function all(): array
    {
        return [
            [
                'key' => 'cashier-basic',
                'label' => 'Kasir',
                'description' => 'Cocok untuk kasir yang melayani transaksi, meja, shift, dan pelanggan di outlet.',
                'suggested_role_name' => 'kasir-operasional',
                'permissions' => [
                    'dashboard-access',
                    'transactions-access',
                    'transactions-history-access',
                    'table-orders-access',
                    'table-orders-approve',
                    'cashier-shifts-access',
                    'cashier-shifts-open',
                    'cashier-shifts-close',
                    'dining-tables-access',
                    'customers-access',
                    'customers-create',
                ],
            ],
            [
                'key' => 'waiter-basic',
                'label' => 'Petugas Antar',
                'description' => 'Cocok untuk tim antar yang mengambil pesanan siap saji dan mengantarkannya ke pelanggan.',
                'suggested_role_name' => 'petugas-antar',
                'permissions' => [
                    'dashboard-access',
                    'waiter-board-access',
                ],
            ],
            [
                'key' => 'kitchen-operator-basic',
                'label' => 'Operator Dapur',
                'description' => 'Cocok untuk tim dapur yang fokus ke antrean dapur, stok harian, dan buka tutup tenant.',
                'suggested_role_name' => 'operator-dapur',
                'permissions' => [
                    'dashboard-access',
                    'kitchen-access',
                    'products-access',
                    'products-stock-update',
                ],
            ],
            [
                'key' => 'tenant-operational',
                'label' => 'Tenant Operasional',
                'description' => 'Cocok untuk PIC tenant yang mengelola produk, stok, dan operasional tenant sehari-hari.',
                'suggested_role_name' => 'tenant-operasional',
                'permissions' => [
                    'dashboard-access',
                    'products-access',
                    'products-stock-update',
                    'stock-mutations-access',
                ],
            ],
            [
                'key' => 'tenant-delivery',
                'label' => 'Tenant Delivery',
                'description' => 'Cocok untuk petugas tenant yang fokus mengambil pesanan siap saji dan mengantarkannya ke pelanggan atau meja.',
                'suggested_role_name' => 'tenant-petugas-antar',
                'permissions' => [
                    'dashboard-access',
                    'waiter-board-access',
                ],
            ],
            [
                'key' => 'tenant-promo',
                'label' => 'Tenant Promo',
                'description' => 'Cocok untuk tenant yang boleh membuat, mengubah, dan menjalankan promo sendiri.',
                'suggested_role_name' => 'tenant-promo',
                'permissions' => [
                    'pricing-rules-access',
                    'pricing-rules-create',
                    'pricing-rules-update',
                ],
            ],
            [
                'key' => 'tenant-owner',
                'label' => 'Tenant Owner',
                'description' => 'Cocok untuk owner tenant yang fokus pada pengawasan produk, harga, promo, dan laporan tenant sendiri tanpa akses operasional outlet owner.',
                'suggested_role_name' => 'tenant-owner',
                'permissions' => [
                    'dashboard-access',
                    'products-access',
                    'products-create',
                    'products-edit',
                    'products-stock-update',
                    'products-pricing-update',
                    'pricing-rules-access',
                    'pricing-rules-create',
                    'pricing-rules-update',
                    'pricing-rules-delete',
                    'reports-access',
                    'profits-access',
                ],
            ],
            [
                'key' => 'owner-pricing',
                'label' => 'Admin Harga Owner',
                'description' => 'Cocok untuk admin owner yang boleh mengubah harga utama dan mengelola promo owner outlet.',
                'suggested_role_name' => 'owner-pricing',
                'permissions' => [
                    'products-access',
                    'products-pricing-update',
                    'pricing-rules-access',
                    'pricing-rules-create',
                    'pricing-rules-update',
                    'pricing-rules-delete',
                ],
            ],
            [
                'key' => 'inventory-admin',
                'label' => 'Admin Stok',
                'description' => 'Cocok untuk staf yang fokus ke stok, pembelian, penerimaan barang, dan supplier.',
                'suggested_role_name' => 'admin-stok',
                'permissions' => [
                    'products-access',
                    'products-stock-update',
                    'stock-opnames-access',
                    'stock-opnames-create',
                    'stock-opnames-finalize',
                    'stock-mutations-access',
                    'purchase-orders-access',
                    'purchase-orders-create',
                    'purchase-orders-update',
                    'goods-receivings-access',
                    'goods-receivings-create',
                    'supplier-returns-access',
                    'supplier-returns-create',
                    'supplier-returns-update',
                    'suppliers-access',
                ],
            ],
            [
                'key' => 'report-viewer',
                'label' => 'Admin Laporan',
                'description' => 'Cocok untuk staf yang hanya memantau laporan penjualan, laba, dan analitik.',
                'suggested_role_name' => 'admin-laporan',
                'permissions' => [
                    'dashboard-access',
                    'reports-access',
                    'profits-access',
                    'cashier-shifts-access',
                ],
            ],
            [
                'key' => 'owner-operations-admin',
                'label' => 'Admin Owner Outlet',
                'description' => 'Cocok untuk admin harian owner yang mengelola kasir, produk, outlet, pelanggan, dan laporan dasar.',
                'suggested_role_name' => 'admin-owner-outlet',
                'permissions' => [
                    'dashboard-access',
                    'customers-access',
                    'customers-create',
                    'kitchen-access',
                    'kitchen-manage',
                    'cashier-settlements-access',
                    'cashier-settlements-approve',
                    'products-access',
                    'products-edit',
                    'products-stock-update',
                    'outlets-access',
                    'outlets-update',
                    'business-settings-access',
                    'business-settings-update',
                    'reports-access',
                    'cashier-shifts-access',
                ],
            ],
            [
                'key' => 'system-admin',
                'label' => 'Admin Sistem',
                'description' => 'Cocok untuk admin internal yang mengelola pengguna, role akses, izin, audit, dan pengaturan penting.',
                'suggested_role_name' => 'admin-sistem',
                'permissions' => [
                    'dashboard-access',
                    'users-access',
                    'users-create',
                    'users-update',
                    'users-delete',
                    'roles-access',
                    'roles-create',
                    'roles-update',
                    'roles-delete',
                    'permissions-access',
                    'permissions-create',
                    'permissions-update',
                    'permissions-delete',
                    'audit-logs-access',
                    'payment-settings-access',
                    'payment-settings-update',
                    'business-settings-access',
                    'business-settings-update',
                    'reports-access',
                ],
            ],
            [
                'key' => 'super-admin',
                'label' => 'Super Admin',
                'description' => 'Akses penuh ke seluruh sistem. Gunakan hanya untuk pemilik sistem atau admin inti yang benar-benar dipercaya.',
                'suggested_role_name' => 'super-admin',
                'use_all_permissions' => true,
                'permissions' => [],
            ],
        ];
    }

    public static function find(string $key): ?array
    {
        foreach (self::all() as $preset) {
            if ($preset['key'] === $key) {
                return $preset;
            }
        }

        return null;
    }
}
