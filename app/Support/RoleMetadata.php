<?php

namespace App\Support;

class RoleMetadata
{
    public static function defaults(): array
    {
        return [
            'super-admin' => [
                'display_name' => 'Super Admin',
                'description' => 'Akses penuh ke seluruh sistem.',
            ],
            'cashier' => [
                'display_name' => 'Kasir',
                'description' => 'Fokus pada transaksi kasir dan operasional checkout.',
            ],
            'waiter' => [
                'display_name' => 'Petugas Antar',
                'description' => 'Fokus pada pengantaran pesanan dari dapur ke pelanggan.',
            ],
            'kitchen-operator' => [
                'display_name' => 'Operator Dapur Tenant',
                'description' => 'Fokus pada layar dapur dan update stok operasional tenant.',
            ],
            'kasir-operasional' => [
                'display_name' => 'Kasir Operasional',
                'description' => 'Fokus pada transaksi, meja, shift, dan pelanggan outlet.',
            ],
            'petugas-antar' => [
                'display_name' => 'Petugas Antar',
                'description' => 'Fokus pada pengantaran pesanan siap saji.',
            ],
            'operator-dapur' => [
                'display_name' => 'Operator Dapur',
                'description' => 'Fokus pada layar dapur dan operasional tenant.',
            ],
            'tenant-operasional' => [
                'display_name' => 'Tenant Operasional',
                'description' => 'Fokus pada produk, stok, dan operasional tenant harian.',
            ],
            'tenant-petugas-antar' => [
                'display_name' => 'Tenant Delivery',
                'description' => 'Fokus pada pengantaran pesanan tenant.',
            ],
            'tenant-promo' => [
                'display_name' => 'Tenant Promo',
                'description' => 'Fokus pada pengelolaan promo tenant.',
            ],
            'tenant-owner' => [
                'display_name' => 'Tenant Owner',
                'description' => 'Fokus pada pengawasan penuh aktivitas tenant.',
            ],
            'owner-pricing' => [
                'display_name' => 'Admin Harga Owner',
                'description' => 'Fokus pada harga utama dan promo owner outlet.',
            ],
            'admin-stok' => [
                'display_name' => 'Admin Stok',
                'description' => 'Fokus pada pembelian, stok, dan supplier.',
            ],
            'admin-laporan' => [
                'display_name' => 'Admin Laporan',
                'description' => 'Fokus pada laporan dan analitik.',
            ],
            'admin-owner-outlet' => [
                'display_name' => 'Admin Owner Outlet',
                'description' => 'Fokus pada operasional owner outlet tanpa akses RBAC sistem.',
            ],
            'admin-sistem' => [
                'display_name' => 'Admin Sistem',
                'description' => 'Fokus pada user, role, permission, audit, dan pengaturan penting.',
            ],
            'outlet-owner' => [
                'display_name' => 'Outlet Owner',
                'description' => 'Fokus pada operasional, settlement, laporan, dan pricing outlet.',
            ],
        ];
    }

    public static function forName(string $name): array
    {
        $defaults = self::defaults()[$name] ?? null;

        return [
            'display_name' => $defaults['display_name'] ?? self::humanize($name),
            'description' => $defaults['description'] ?? null,
        ];
    }

    public static function humanize(string $name): string
    {
        return str($name)
            ->replace('-', ' ')
            ->replaceMatches('/\s+/', ' ')
            ->trim()
            ->title()
            ->toString();
    }
}
