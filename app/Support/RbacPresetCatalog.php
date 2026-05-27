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
                'description' => 'Untuk kasir yang fokus ke transaksi, meja, shift, dan pelanggan.',
                'suggested_role_name' => 'kasir-operasional',
                'permissions' => [
                    'dashboard-access',
                    'transactions-access',
                    'table-orders-access',
                    'table-orders-approve',
                    'cashier-shifts-access',
                    'cashier-shifts-open',
                    'cashier-shifts-close',
                    'dining-tables-access',
                    'customers-access',
                    'customers-create',
                    'receivables-access',
                ],
            ],
            [
                'key' => 'waiter-basic',
                'label' => 'Petugas Antar',
                'description' => 'Untuk tim antar yang menangani papan antar dan pesanan siap serah.',
                'suggested_role_name' => 'petugas-antar',
                'permissions' => [
                    'dashboard-access',
                    'transactions-access',
                    'waiter-board-access',
                    'table-orders-access',
                ],
            ],
            [
                'key' => 'kitchen-operator-basic',
                'label' => 'Operator Dapur',
                'description' => 'Untuk tim dapur yang melihat produk, stok, dan buka tutup tenant.',
                'suggested_role_name' => 'operator-dapur',
                'permissions' => [
                    'dashboard-access',
                    'outlets-access',
                    'outlets-toggle',
                    'products-access',
                    'products-edit',
                ],
            ],
            [
                'key' => 'tenant-operational',
                'label' => 'Tenant Operasional',
                'description' => 'Untuk PIC tenant harian yang mengelola produk, stok, dan operasional outlet tenant.',
                'suggested_role_name' => 'tenant-operasional',
                'permissions' => [
                    'products-access',
                    'products-edit',
                    'outlets-access',
                    'outlets-toggle',
                ],
            ],
            [
                'key' => 'tenant-promo',
                'label' => 'Tenant Promo',
                'description' => 'Untuk tenant yang boleh membuat dan mengubah promo sendiri.',
                'suggested_role_name' => 'tenant-promo',
                'permissions' => [
                    'pricing-rules-access',
                    'pricing-rules-create',
                    'pricing-rules-update',
                ],
            ],
            [
                'key' => 'owner-pricing',
                'label' => 'Owner Pricing',
                'description' => 'Untuk admin owner yang boleh mengubah harga utama dan mengelola promo owner.',
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
                'description' => 'Untuk staf yang fokus ke stok, pembelian, penerimaan barang, dan supplier.',
                'suggested_role_name' => 'admin-stok',
                'permissions' => [
                    'products-access',
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
                'description' => 'Untuk staf yang hanya memantau laporan penjualan, laba, dan analitik.',
                'suggested_role_name' => 'admin-laporan',
                'permissions' => [
                    'dashboard-access',
                    'reports-access',
                    'profits-access',
                    'cashier-shifts-access',
                ],
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
