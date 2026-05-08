<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\KitchenStation;
use App\Models\KitchenStationDevice;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\ProductKitchenStationMapping;
use App\Models\Transaction;
use Inertia\Inertia;

class OperationsGuideController extends Controller
{
    public function outletKitchen()
    {
        return Inertia::render('Dashboard/Guides/OutletKitchen', [
            'outletTypes' => [
                ['value' => 'main', 'label' => 'Main Outlet', 'description' => 'Outlet utama yang menerima transaksi kasir, dashboard utama, dan bisa menaungi tenant foodcourt.'],
                ['value' => 'tenant', 'label' => 'Tenant Foodcourt', 'description' => 'Tenant penjual di foodcourt yang menerima alokasi pendapatan, settlement, dan kitchen routing sendiri.'],
                ['value' => 'warehouse', 'label' => 'Warehouse / Support', 'description' => 'Lokasi stok atau support yang tidak dipakai sebagai tenant penjualan langsung.'],
            ],
            'outlets' => Outlet::ordered()->get(['id', 'name', 'code', 'outlet_type']),
        ]);
    }

    public function setupWizard()
    {
        $mainOutlets = Outlet::query()->where('outlet_type', 'main')->ordered()->get(['id', 'name', 'code']);
        $tenantOutlets = Outlet::query()->where('outlet_type', 'tenant')->ordered()->get(['id', 'name', 'code']);

        $steps = [
            [
                'key' => 'main_outlet',
                'title' => 'Buat Main Outlet',
                'description' => 'Buat outlet utama sebagai pusat kasir dan konteks operasional awal.',
                'done' => $mainOutlets->isNotEmpty(),
                'href' => route('outlets.index', ['create' => 1, 'outlet_type' => 'main']),
                'action_label' => 'Buka Form Main Outlet',
            ],
            [
                'key' => 'tenant_outlet',
                'title' => 'Buat Tenant Foodcourt',
                'description' => 'Tambahkan tenant bila satu kasir melayani banyak tenant dengan settlement terpisah.',
                'done' => $tenantOutlets->isNotEmpty(),
                'href' => route('outlets.index', ['create' => 1, 'outlet_type' => 'tenant']),
                'action_label' => 'Buka Form Tenant',
            ],
            [
                'key' => 'station',
                'title' => 'Buat Station Dapur',
                'description' => 'Siapkan station seperti minuman, ayam, atau salad di outlet yang dipakai operasional.',
                'done' => KitchenStation::query()->exists(),
                'href' => route('settings.kitchen-devices.index', ['station_create' => 1, 'outlet_id' => $mainOutlets->first()?->id]),
                'action_label' => 'Buat Station',
            ],
            [
                'key' => 'device',
                'title' => 'Hubungkan Printer / Screen',
                'description' => 'Tambahkan device ke station agar ticket bisa tampil atau tercetak.',
                'done' => KitchenStationDevice::query()->exists(),
                'href' => route('settings.kitchen-devices.index', ['device_create' => 1, 'outlet_id' => $mainOutlets->first()?->id]),
                'action_label' => 'Tambah Device',
            ],
            [
                'key' => 'tenant_product',
                'title' => 'Petakan Produk ke Tenant',
                'description' => 'Untuk model foodcourt, produk perlu tahu tenant mana yang menerima pendapatan.',
                'done' => Product::query()->whereNotNull('tenant_outlet_id')->exists() || $tenantOutlets->isEmpty(),
                'href' => route('products.index'),
                'action_label' => 'Kelola Produk',
            ],
            [
                'key' => 'station_mapping',
                'title' => 'Petakan Produk ke Station',
                'description' => 'Agar pesanan otomatis pecah ke dapur yang benar, produk harus terhubung ke station kitchen.',
                'done' => ProductKitchenStationMapping::query()->where('is_active', true)->exists(),
                'href' => route('settings.kitchen-devices.index', ['outlet_id' => $mainOutlets->first()?->id]),
                'action_label' => 'Cek Kitchen Ops',
            ],
            [
                'key' => 'transaction',
                'title' => 'Uji Transaksi Pertama',
                'description' => 'Pastikan alur POS, kitchen queue, dan settlement tenant berjalan sampai akhir.',
                'done' => Transaction::query()->exists(),
                'href' => route('transactions.index'),
                'action_label' => 'Mulai Transaksi',
            ],
        ];

        return Inertia::render('Dashboard/Guides/SetupWizard', [
            'steps' => $steps,
            'summary' => [
                'completed' => collect($steps)->where('done', true)->count(),
                'total' => count($steps),
            ],
            'mainOutlets' => $mainOutlets,
            'tenantOutlets' => $tenantOutlets,
        ]);
    }
}
