<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\KitchenStation;
use App\Models\KitchenStationDevice;
use App\Models\PwaPushSubscription;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\ProductKitchenStationMapping;
use App\Models\Transaction;
use App\Services\WebPushService;
use Illuminate\Support\Facades\File;
use Inertia\Inertia;

class OperationsGuideController extends Controller
{
    public function __construct(
        private readonly WebPushService $webPushService,
    ) {
    }

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

    public function pwaSetup()
    {
        $manifestPath = public_path('build/manifest.json');
        $buildVersion = null;
        $buildGeneratedAt = null;

        if (File::exists($manifestPath)) {
            $buildVersion = substr(sha1_file($manifestPath) ?: '', 0, 10) ?: null;
            $buildGeneratedAt = date(DATE_ATOM, File::lastModified($manifestPath));
        }

        $user = auth()->user();
        $dashboardPushSubscription = $user
            ? PwaPushSubscription::query()
                ->where('user_id', $user->id)
                ->where('kind', PwaPushSubscription::KIND_DASHBOARD)
                ->latest('last_used_at')
                ->latest('updated_at')
                ->first(['id', 'endpoint', 'last_used_at', 'updated_at'])
            : null;
        $optionalRoute = static function (?string $permission, string $routeName) use ($user) {
            if (!$user) {
                return null;
            }

            if ($permission && !$user->can($permission)) {
                return null;
            }

            return route($routeName);
        };

        $buildProfile = static function (string $key, string $label, string $description, array $routes) {
            $preparedRoutes = collect($routes)
                ->filter(fn ($route) => !empty($route['href']))
                ->unique('href')
                ->values()
                ->all();

            if (count($preparedRoutes) === 0) {
                return null;
            }

            return [
                'key' => $key,
                'label' => $label,
                'description' => $description,
                'routes' => $preparedRoutes,
            ];
        };

        $offlineShellProfiles = array_values(array_filter([
            $buildProfile(
                'cashier',
                'Kasir / Frontline',
                'Menyiapkan route utama kasir agar POS, shift, dan riwayat transaksi lebih siap dibuka kembali saat perangkat sempat online sebelumnya.',
                [
                    ['label' => 'Setup PWA', 'href' => $optionalRoute('dashboard-access', 'guides.pwa-setup')],
                    ['label' => 'Dashboard', 'href' => $optionalRoute('dashboard-access', 'dashboard')],
                    ['label' => 'POS Kasir', 'href' => $optionalRoute('transactions-access', 'transactions.index')],
                    ['label' => 'Riwayat Transaksi', 'href' => $optionalRoute('transactions-history-access', 'transactions.history')],
                    ['label' => 'Shift Kasir', 'href' => $optionalRoute('cashier-shifts-access', 'cashier-shifts.index')],
                    ['label' => 'Pesanan QR Meja', 'href' => $optionalRoute('table-orders-access', 'table-orders.index')],
                ]
            ),
            $buildProfile(
                'kitchen',
                'Kitchen / Produksi',
                'Cocok untuk tablet dapur yang fokus ke antrian kitchen dan pemantauan order tanpa memuat modul administrasi.',
                [
                    ['label' => 'Setup PWA', 'href' => $optionalRoute('dashboard-access', 'guides.pwa-setup')],
                    ['label' => 'Dashboard', 'href' => $optionalRoute('dashboard-access', 'dashboard')],
                    ['label' => 'Kitchen Queue', 'href' => $optionalRoute('kitchen-access', 'kitchen.index')],
                ]
            ),
            $buildProfile(
                'supervisor',
                'Owner / Supervisor',
                'Memanaskan dashboard inti, data master, inventaris, dan laporan yang paling sering dibuka untuk pemantauan operasional.',
                [
                    ['label' => 'Setup PWA', 'href' => $optionalRoute('dashboard-access', 'guides.pwa-setup')],
                    ['label' => 'Dashboard', 'href' => $optionalRoute('dashboard-access', 'dashboard')],
                    ['label' => 'Produk', 'href' => $optionalRoute('products-access', 'products.index')],
                    ['label' => 'Pelanggan', 'href' => $optionalRoute('customers-access', 'customers.index')],
                    ['label' => 'Supplier', 'href' => $optionalRoute('suppliers-access', 'suppliers.index')],
                    ['label' => 'Stock Opname', 'href' => $optionalRoute('stock-opnames-access', 'stock-opnames.index')],
                    ['label' => 'Mutasi Stok', 'href' => $optionalRoute('stock-mutations-access', 'stock-mutations.index')],
                    ['label' => 'Piutang', 'href' => $optionalRoute('receivables-access', 'receivables.index')],
                    ['label' => 'Laporan Penjualan', 'href' => $optionalRoute('reports-access', 'reports.sales.index')],
                    ['label' => 'Laporan Profit', 'href' => $optionalRoute('profits-access', 'reports.profits.index')],
                    ['label' => 'Audit Log', 'href' => $optionalRoute('audit-logs-access', 'audit-logs.index')],
                ]
            ),
        ]));

        return Inertia::render('Dashboard/Guides/PWASetup', [
            'platforms' => [
                [
                    'name' => 'Android / Chrome',
                    'steps' => [
                        'Buka aplikasi dari browser Chrome.',
                        'Login lalu tekan tombol Install App jika muncul.',
                        'Simpan ke home screen dan izinkan mode standalone.',
                    ],
                ],
                [
                    'name' => 'iPhone / iPad',
                    'steps' => [
                        'Buka aplikasi dari Safari.',
                        'Tekan Share lalu pilih Add to Home Screen.',
                        'Gunakan shortcut yang terbentuk untuk mode app.',
                    ],
                ],
                [
                    'name' => 'Windows / Desktop Chrome',
                    'steps' => [
                        'Buka aplikasi dari Chrome atau Edge.',
                        'Gunakan tombol Install App dari aplikasi atau browser.',
                        'Pin shortcut hasil install ke taskbar bila perlu.',
                    ],
                ],
            ],
            'recommendedRoutes' => [
                [
                    'label' => 'Dashboard Admin',
                    'href' => route('dashboard'),
                    'description' => 'Untuk admin dan supervisor yang memantau seluruh sistem.',
                ],
                [
                    'label' => 'POS / Kasir',
                    'href' => route('transactions.index'),
                    'description' => 'Untuk perangkat kasir yang fokus ke transaksi.',
                ],
                [
                    'label' => 'Kitchen Queue',
                    'href' => route('kitchen.index'),
                    'description' => 'Untuk layar dapur umum sebelum dikunci ke station tertentu.',
                ],
            ],
            'offlineShellProfiles' => $offlineShellProfiles,
            'buildInfo' => [
                'version' => $buildVersion,
                'generated_at' => $buildGeneratedAt,
            ],
            'pushConfig' => [
                'enabled' => $this->webPushService->isConfigured(),
                'vapidPublicKey' => $this->webPushService->publicKey(),
                'existingSubscription' => $dashboardPushSubscription ? [
                    'endpoint' => $dashboardPushSubscription->endpoint,
                    'last_used_at' => optional($dashboardPushSubscription->last_used_at)?->toAtomString(),
                    'updated_at' => optional($dashboardPushSubscription->updated_at)?->toAtomString(),
                ] : null,
            ],
        ]);
    }
}
