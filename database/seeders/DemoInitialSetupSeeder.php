<?php

namespace Database\Seeders;

use App\Models\CashierShift;
use App\Models\Category;
use App\Models\Customer;
use App\Models\CustomerOutletMetric;
use App\Models\KitchenTicket;
use App\Models\KitchenStation;
use App\Models\KitchenStationDevice;
use App\Models\Outlet;
use App\Models\Payable;
use App\Models\PrintJob;
use App\Models\Product;
use App\Models\ProductKitchenStationMapping;
use App\Models\ProductOutletStock;
use App\Models\Receivable;
use App\Models\Supplier;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use App\Models\TransactionTenantAllocation;
use App\Models\User;
use App\Services\FoodcourtTenantAllocationService;
use App\Services\KitchenTicketService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class DemoInitialSetupSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $mainOutlet = Outlet::query()
            ->where('is_default', true)
            ->orWhere('outlet_type', 'main')
            ->ordered()
            ->first();

        if (! $mainOutlet) {
            $this->command?->warn('Skipping DemoInitialSetupSeeder because main outlet is missing.');

            return;
        }

        $this->command?->info('Seeding complete demo setup for outlet, kitchen, and foodcourt...');

        DB::transaction(function () use ($mainOutlet) {
            $tenantOutlets = $this->seedTenantOutlets();
            $stations = $this->seedKitchenStations($mainOutlet);
            $this->seedKitchenDevices($stations);
            $users = $this->seedDemoUsers($mainOutlet, $stations);
            $products = $this->seedDemoFoodcourtProducts($mainOutlet, $tenantOutlets);
            $this->seedProductOutletStocks($mainOutlet, $products);
            $this->seedProductMappings($products, $stations);
            $customers = $this->seedDemoCustomers($mainOutlet);
            $transactions = $this->seedDemoTransactions($mainOutlet, $users, $products, $customers);
            $this->seedDemoReceivables($mainOutlet, $transactions, $customers);
            $this->seedDemoPayables($mainOutlet);
            $this->seedDemoPrintJobs($mainOutlet, $transactions);
            $this->markDemoTenantSettlements($transactions);
        });

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    private function seedTenantOutlets(): Collection
    {
        $rows = collect([
            [
                'code' => 'TEN-MINUM',
                'slug' => 'tenant-minuman-demo',
                'name' => 'Tenant Minuman Demo',
                'legal_name' => 'Tenant Minuman Demo',
                'outlet_type' => 'tenant',
                'commission_rate_percent' => 12.5,
                'sort_order' => 10,
            ],
            [
                'code' => 'TEN-AYAM',
                'slug' => 'tenant-ayam-demo',
                'name' => 'Tenant Ayam Demo',
                'legal_name' => 'Tenant Ayam Demo',
                'outlet_type' => 'tenant',
                'commission_rate_percent' => 15,
                'sort_order' => 20,
            ],
            [
                'code' => 'TEN-SATE',
                'slug' => 'tenant-sate-demo',
                'name' => 'Tenant Sate Demo',
                'legal_name' => 'Tenant Sate Demo',
                'outlet_type' => 'tenant',
                'commission_rate_percent' => 10,
                'sort_order' => 30,
            ],
            [
                'code' => 'TEN-SNACK',
                'slug' => 'tenant-snack-demo',
                'name' => 'Tenant Snack Demo',
                'legal_name' => 'Tenant Snack Demo',
                'outlet_type' => 'tenant',
                'commission_rate_percent' => 8,
                'sort_order' => 40,
            ],
        ]);

        return $rows->map(function (array $row) {
            return Outlet::query()->updateOrCreate(
                ['slug' => $row['slug']],
                [
                    ...$row,
                    'address' => 'Area Foodcourt Demo',
                    'city' => 'Bandung',
                    'phone' => '022-6000000',
                    'email' => $row['slug'].'@demo.test',
                    'is_active' => true,
                    'is_default' => false,
                ]
            );
        })->keyBy('slug');
    }

    private function seedKitchenStations(Outlet $mainOutlet): Collection
    {
        $stationRows = collect([
            ['slug' => 'minuman', 'name' => 'Minuman', 'code' => 'ST-MINUMAN', 'display_mode' => 'screen', 'sort_order' => 10],
            ['slug' => 'ayam', 'name' => 'Ayam', 'code' => 'ST-AYAM', 'display_mode' => 'screen', 'sort_order' => 20],
            ['slug' => 'sate', 'name' => 'Sate', 'code' => 'ST-SATE', 'display_mode' => 'screen', 'sort_order' => 30],
            ['slug' => 'salad', 'name' => 'Salad', 'code' => 'ST-SALAD', 'display_mode' => 'screen', 'sort_order' => 40],
        ]);

        return $stationRows->map(function (array $row) use ($mainOutlet) {
            return KitchenStation::query()->updateOrCreate(
                [
                    'outlet_id' => $mainOutlet->id,
                    'slug' => $row['slug'],
                ],
                [
                    'name' => $row['name'],
                    'code' => $row['code'],
                    'station_type' => 'kitchen',
                    'display_mode' => $row['display_mode'],
                    'sort_order' => $row['sort_order'],
                    'is_active' => true,
                ]
            );
        })->keyBy('slug');
    }

    private function seedKitchenDevices(Collection $stations): void
    {
        $blueprints = [
            'minuman' => [
                [
                    'name' => 'Tablet Minuman',
                    'device_type' => 'tablet',
                    'connection_driver' => 'browser',
                    'endpoint' => 'kitchen://tablet/minuman',
                    'is_primary' => true,
                    'meta' => [
                        'dispatch_mode' => 'manual',
                        'print_profile' => KitchenStationDevice::PRINT_PROFILE_BROWSER,
                    ],
                ],
                [
                    'name' => 'Printer Minuman Bluetooth',
                    'device_type' => 'printer',
                    'connection_driver' => 'browser',
                    'endpoint' => 'bluetooth://rawbt/minuman',
                    'is_primary' => true,
                    'meta' => [
                        'paper_width' => '80mm',
                        'template_style' => 'kitchen',
                        'print_copies' => 1,
                        'dispatch_mode' => 'auto',
                        'print_profile' => KitchenStationDevice::PRINT_PROFILE_RAWBT,
                        'rawbt_intent_url' => 'rawbt:base64',
                    ],
                ],
            ],
            'ayam' => [
                [
                    'name' => 'Screen Ayam',
                    'device_type' => 'screen',
                    'connection_driver' => 'browser',
                    'endpoint' => 'screen://ayam-queue',
                    'is_primary' => true,
                    'meta' => [
                        'dispatch_mode' => 'manual',
                        'print_profile' => KitchenStationDevice::PRINT_PROFILE_BROWSER,
                    ],
                ],
                [
                    'name' => 'Printer Ayam Bridge',
                    'device_type' => 'printer',
                    'connection_driver' => 'network',
                    'endpoint' => 'http://127.0.0.1:9101/print/ayam',
                    'is_primary' => true,
                    'meta' => [
                        'paper_width' => '80mm',
                        'template_style' => 'kitchen',
                        'print_copies' => 1,
                        'dispatch_mode' => 'auto',
                        'print_profile' => KitchenStationDevice::PRINT_PROFILE_BRIDGE,
                        'bridge_device_key' => 'ayam-printer-01',
                    ],
                ],
            ],
            'sate' => [
                [
                    'name' => 'Screen Sate',
                    'device_type' => 'screen',
                    'connection_driver' => 'browser',
                    'endpoint' => 'screen://sate-queue',
                    'is_primary' => true,
                    'meta' => [
                        'dispatch_mode' => 'manual',
                        'print_profile' => KitchenStationDevice::PRINT_PROFILE_BROWSER,
                    ],
                ],
                [
                    'name' => 'Printer Sate QZ',
                    'device_type' => 'printer',
                    'connection_driver' => 'usb',
                    'endpoint' => 'QZ:SATE',
                    'is_primary' => true,
                    'meta' => [
                        'paper_width' => '58mm',
                        'template_style' => 'compact',
                        'print_copies' => 1,
                        'dispatch_mode' => 'manual',
                        'print_profile' => KitchenStationDevice::PRINT_PROFILE_QZ_TRAY,
                        'qz_printer_name' => 'Thermal-Sate-01',
                    ],
                ],
            ],
            'salad' => [
                [
                    'name' => 'Tablet Snack',
                    'device_type' => 'tablet',
                    'connection_driver' => 'browser',
                    'endpoint' => 'kitchen://tablet/snack',
                    'is_primary' => true,
                    'meta' => [
                        'dispatch_mode' => 'manual',
                        'print_profile' => KitchenStationDevice::PRINT_PROFILE_BROWSER,
                    ],
                ],
            ],
        ];

        foreach ($blueprints as $stationSlug => $devices) {
            $station = $stations->get($stationSlug);
            if (! $station) {
                continue;
            }

            foreach ($devices as $index => $deviceData) {
                KitchenStationDevice::query()->updateOrCreate(
                    [
                        'kitchen_station_id' => $station->id,
                        'name' => $deviceData['name'],
                    ],
                    [
                        'device_type' => $deviceData['device_type'],
                        'connection_driver' => $deviceData['connection_driver'],
                        'endpoint' => $deviceData['endpoint'],
                        'is_primary' => (bool) $deviceData['is_primary'],
                        'is_active' => true,
                        'meta' => $deviceData['meta'],
                    ]
                );
            }
        }

        // ensure fallback example on ayam printer -> sate printer
        $ayamPrinter = KitchenStationDevice::query()->where('name', 'Printer Ayam Bridge')->first();
        $satePrinter = KitchenStationDevice::query()->where('name', 'Printer Sate QZ')->first();
        if ($ayamPrinter && $satePrinter) {
            $meta = $ayamPrinter->meta ?? [];
            $meta['fallback_device_id'] = $satePrinter->id;
            $ayamPrinter->update(['meta' => $meta]);
        }
    }

    private function seedDemoUsers(Outlet $mainOutlet, Collection $stations): Collection
    {
        $kitchenRole = Role::firstOrCreate(['name' => 'kitchen-operator']);
        $dashboardPermission = Permission::query()->where('name', 'dashboard-access')->first();
        if ($dashboardPermission) {
            $kitchenRole->syncPermissions([$dashboardPermission]);
        }

        $cashierRole = Role::query()->where('name', 'cashier')->first();
        $adminRole = Role::query()->whereIn('name', ['super-admin', 'admin'])->first();
        $workspaceColumnsReady = $this->supportsKitchenWorkspaceColumns();

        $users = collect([
            [
                'email' => 'admin.demo@gmail.com',
                'name' => 'Admin Demo Program',
                'workspace' => 'standard',
                'station' => null,
                'roles' => $adminRole ? [$adminRole->name] : [],
                'primary_outlet' => $mainOutlet->id,
            ],
            [
                'email' => 'supervisor.demo@gmail.com',
                'name' => 'Supervisor Outlet Demo',
                'workspace' => 'standard',
                'station' => null,
                'roles' => $adminRole ? [$adminRole->name] : [],
                'primary_outlet' => $mainOutlet->id,
            ],
            [
                'email' => 'cashier.foodcourt@gmail.com',
                'name' => 'Kasir Foodcourt Demo',
                'workspace' => 'standard',
                'station' => null,
                'roles' => $cashierRole ? [$cashierRole->name] : [],
                'primary_outlet' => $mainOutlet->id,
            ],
            [
                'email' => 'cashier.retail@gmail.com',
                'name' => 'Kasir Retail Demo',
                'workspace' => 'standard',
                'station' => null,
                'roles' => $cashierRole ? [$cashierRole->name] : [],
                'primary_outlet' => $mainOutlet->id,
            ],
            [
                'email' => 'kitchen.minuman@gmail.com',
                'name' => 'Dapur Minuman Demo',
                'workspace' => 'kitchen',
                'station' => $stations->get('minuman')?->id,
                'roles' => [$kitchenRole->name],
                'primary_outlet' => $mainOutlet->id,
            ],
            [
                'email' => 'kitchen.ayam@gmail.com',
                'name' => 'Dapur Ayam Demo',
                'workspace' => 'kitchen',
                'station' => $stations->get('ayam')?->id,
                'roles' => [$kitchenRole->name],
                'primary_outlet' => $mainOutlet->id,
            ],
            [
                'email' => 'kitchen.sate@gmail.com',
                'name' => 'Dapur Sate Demo',
                'workspace' => 'kitchen',
                'station' => $stations->get('sate')?->id,
                'roles' => [$kitchenRole->name],
                'primary_outlet' => $mainOutlet->id,
            ],
            [
                'email' => 'kitchen.salad@gmail.com',
                'name' => 'Dapur Salad Demo',
                'workspace' => 'kitchen',
                'station' => $stations->get('salad')?->id,
                'roles' => [$kitchenRole->name],
                'primary_outlet' => $mainOutlet->id,
            ],
        ])->map(function (array $row) use ($workspaceColumnsReady) {
            $attributes = [
                'name' => $row['name'],
                'password' => Hash::make('password'),
            ];

            if ($workspaceColumnsReady) {
                $attributes['preferred_workspace'] = $row['workspace'];
                $attributes['preferred_kitchen_station_id'] = $row['station'];
            }

            $user = User::query()->updateOrCreate(
                ['email' => $row['email']],
                $attributes
            );

            if ($row['roles'] !== []) {
                $user->syncRoles($row['roles']);
            }

            if ($row['workspace'] === 'kitchen') {
                $dashboardPermission = Permission::query()->where('name', 'dashboard-access')->first();
                if ($dashboardPermission) {
                    $user->givePermissionTo($dashboardPermission);
                }
            }

            $user->outlets()->syncWithoutDetaching([
                $row['primary_outlet'] => ['is_primary' => true],
            ]);

            return $user->fresh();
        });

        return $users->keyBy('email');
    }

    private function seedDemoCustomers(Outlet $mainOutlet): Collection
    {
        $rows = collect([
            [
                'name' => 'Budi Santoso Demo',
                'no_telp' => '081200000101',
                'address' => 'Jl. Demo Utama No. 1',
                'is_loyalty_member' => true,
                'member_code' => 'MBR-DEMO-001',
                'loyalty_tier' => 'gold',
                'loyalty_points' => 180,
                'loyalty_total_spent' => 850000,
                'loyalty_transaction_count' => 12,
            ],
            [
                'name' => 'Siti Nurhaliza Demo',
                'no_telp' => '081200000102',
                'address' => 'Jl. Demo Foodcourt No. 8',
                'is_loyalty_member' => false,
                'member_code' => null,
                'loyalty_tier' => 'silver',
                'loyalty_points' => 0,
                'loyalty_total_spent' => 175000,
                'loyalty_transaction_count' => 4,
            ],
            [
                'name' => 'Corporate Lunch Demo',
                'no_telp' => '081200000103',
                'address' => 'Gedung Kantor Demo',
                'is_loyalty_member' => true,
                'member_code' => 'MBR-DEMO-002',
                'loyalty_tier' => 'platinum',
                'loyalty_points' => 420,
                'loyalty_total_spent' => 2450000,
                'loyalty_transaction_count' => 22,
            ],
        ]);

        $customers = $rows->map(function (array $row) {
            return Customer::query()->updateOrCreate(
                ['no_telp' => $row['no_telp']],
                [
                    ...$row,
                    'loyalty_member_since' => now()->subMonths(4),
                    'last_purchase_at' => now()->subDay(),
                ]
            );
        })->keyBy('no_telp');

        if (Schema::hasTable('customer_outlet_metrics')) {
            foreach ($customers as $customer) {
                CustomerOutletMetric::query()->updateOrCreate(
                    [
                        'customer_id' => $customer->id,
                        'outlet_id' => $mainOutlet->id,
                    ],
                    [
                        'transaction_count' => max(1, (int) $customer->loyalty_transaction_count),
                        'total_spent' => max(0, (int) $customer->loyalty_total_spent),
                        'last_purchase_at' => $customer->last_purchase_at,
                        'loyalty_tier' => $customer->loyalty_tier,
                    ]
                );
            }
        }

        return $customers;
    }

    private function seedDemoFoodcourtProducts(Outlet $mainOutlet, Collection $tenantOutlets): Collection
    {
        $categories = Category::query()->whereIn('name', [
            'Minuman',
            'Makanan Berat',
            'Makanan Ringan',
        ])->get()->keyBy('name');

        $rows = collect([
            [
                'barcode' => 'FC-MNM-001',
                'title' => 'Es Teh Manis Foodcourt',
                'description' => 'Minuman andalan tenant minuman untuk demo foodcourt.',
                'category' => 'Minuman',
                'tenant_slug' => 'tenant-minuman-demo',
                'buy_price' => 4000,
                'sell_price' => 9000,
                'stock' => 120,
            ],
            [
                'barcode' => 'FC-MNM-002',
                'title' => 'Kopi Susu Arena Demo',
                'description' => 'Kopi susu manis untuk jalur demo dapur minuman.',
                'category' => 'Minuman',
                'tenant_slug' => 'tenant-minuman-demo',
                'buy_price' => 8000,
                'sell_price' => 18000,
                'stock' => 80,
            ],
            [
                'barcode' => 'FC-AYM-001',
                'title' => 'Ayam Bakar Sambal Matah',
                'description' => 'Menu tenant ayam untuk simulasi checkout multi-tenant.',
                'category' => 'Makanan Berat',
                'tenant_slug' => 'tenant-ayam-demo',
                'buy_price' => 18000,
                'sell_price' => 32000,
                'stock' => 50,
            ],
            [
                'barcode' => 'FC-AYM-002',
                'title' => 'Nasi Ayam Bakar Komplit',
                'description' => 'Paket ayam bakar lengkap untuk laporan tenant.',
                'category' => 'Makanan Berat',
                'tenant_slug' => 'tenant-ayam-demo',
                'buy_price' => 22000,
                'sell_price' => 38000,
                'stock' => 45,
            ],
            [
                'barcode' => 'FC-SAT-001',
                'title' => 'Sate Ayam 10 Tusuk',
                'description' => 'Produk demo tenant sate.',
                'category' => 'Makanan Berat',
                'tenant_slug' => 'tenant-sate-demo',
                'buy_price' => 20000,
                'sell_price' => 36000,
                'stock' => 55,
            ],
            [
                'barcode' => 'FC-SNK-001',
                'title' => 'Salad Buah Mini',
                'description' => 'Produk demo tenant snack dan dessert.',
                'category' => 'Makanan Ringan',
                'tenant_slug' => 'tenant-snack-demo',
                'buy_price' => 10000,
                'sell_price' => 18000,
                'stock' => 70,
            ],
        ]);

        $products = $rows->map(function (array $row) use ($categories, $tenantOutlets) {
            $category = $categories->get($row['category']);
            $tenant = $tenantOutlets->get($row['tenant_slug']);

            return Product::query()->updateOrCreate(
                ['barcode' => $row['barcode']],
                [
                    'category_id' => $category?->id,
                    'image' => 'default.jpg',
                    'title' => $row['title'],
                    'description' => $row['description'],
                    'buy_price' => $row['buy_price'],
                    'sell_price' => $row['sell_price'],
                    'tenant_outlet_id' => $tenant?->id,
                    'stock' => $row['stock'],
                ]
            );
        });

        return $products->keyBy('barcode');
    }

    private function seedProductOutletStocks(Outlet $mainOutlet, Collection $demoProducts): void
    {
        Product::query()
            ->orderBy('id')
            ->get(['id', 'stock'])
            ->each(function (Product $product) use ($mainOutlet) {
                ProductOutletStock::query()->updateOrCreate(
                    [
                        'outlet_id' => $mainOutlet->id,
                        'product_id' => $product->id,
                    ],
                    [
                        'stock' => max(0, (int) $product->stock),
                        'reorder_level' => 10,
                        'last_counted_at' => now(),
                    ]
                );
            });
    }

    private function seedProductMappings(Collection $demoProducts, Collection $stations): void
    {
        $mappingByBarcode = [
            'FC-MNM-001' => 'minuman',
            'FC-MNM-002' => 'minuman',
            'FC-AYM-001' => 'ayam',
            'FC-AYM-002' => 'ayam',
            'FC-SAT-001' => 'sate',
            'FC-SNK-001' => 'salad',
        ];

        foreach ($mappingByBarcode as $barcode => $stationSlug) {
            $product = $demoProducts->get($barcode);
            $station = $stations->get($stationSlug);

            if (! $product || ! $station) {
                continue;
            }

            ProductKitchenStationMapping::query()->updateOrCreate(
                [
                    'product_id' => $product->id,
                    'kitchen_station_id' => $station->id,
                ],
                [
                    'priority' => 1,
                    'fire_on_sale' => true,
                    'is_active' => true,
                ]
            );
        }
    }

    private function seedDemoTransactions(
        Outlet $mainOutlet,
        Collection $users,
        Collection $demoProducts,
        Collection $customers
    ): Collection
    {
        $cashier = $users->get('cashier.foodcourt@gmail.com') ?? User::query()->where('email', 'cashier@gmail.com')->first();
        if (! $cashier) {
            return collect();
        }

        $shift = CashierShift::query()->firstOrCreate(
            [
                'user_id' => $cashier->id,
                'outlet_id' => $mainOutlet->id,
                'status' => CashierShift::STATUS_OPEN,
            ],
            [
                'opened_by' => $cashier->id,
                'opened_at' => now()->subHours(2),
                'opening_cash' => 300000,
                'expected_cash' => 300000,
                'notes' => 'Shift aktif demo foodcourt.',
            ]
        );

        $foodcourt = Transaction::query()->firstOrCreate(
            ['invoice' => 'DEMO-FOODCOURT-001'],
            [
                'cashier_id' => $cashier->id,
                'cashier_shift_id' => $shift->id,
                'outlet_id' => $mainOutlet->id,
                'customer_id' => null,
                'cash' => 100000,
                'change' => 5000,
                'discount' => 0,
                'grand_total' => 95000,
                'payment_method' => 'cash',
                'payment_status' => 'paid',
            ]
        );

        if (! $foodcourt->details()->exists()) {
            $detailRows = [
                ['barcode' => 'FC-MNM-001', 'qty' => 2],
                ['barcode' => 'FC-AYM-001', 'qty' => 1],
                ['barcode' => 'FC-SAT-001', 'qty' => 1],
            ];

            $grandTotal = 0;

            foreach ($detailRows as $row) {
                $product = $demoProducts->get($row['barcode']);
                if (! $product) {
                    continue;
                }

                $lineTotal = $product->sell_price * $row['qty'];
                $grandTotal += $lineTotal;

                $foodcourt->details()->create([
                    'outlet_id' => $mainOutlet->id,
                    'tenant_outlet_id' => $product->tenant_outlet_id,
                    'product_id' => $product->id,
                    'qty' => $row['qty'],
                    'base_unit_price' => $product->sell_price,
                    'unit_price' => $product->sell_price,
                    'price' => $lineTotal,
                    'discount_total' => 0,
                ]);

                $foodcourt->profits()->create([
                    'total' => ($product->sell_price - $product->buy_price) * $row['qty'],
                ]);
            }

            $foodcourt->update([
                'cash' => $grandTotal,
                'change' => 0,
                'grand_total' => $grandTotal,
            ]);
        }

        app(FoodcourtTenantAllocationService::class)->rebuildForTransaction($foodcourt->fresh('details'));
        app(KitchenTicketService::class)->createForTransaction($foodcourt->fresh([
            'details.product.kitchenStationMappings.kitchenStation',
            'cashierShift',
        ]));

        $retailCashier = $users->get('cashier.retail@gmail.com') ?? $cashier;
        $retailShift = CashierShift::query()->firstOrCreate(
            [
                'user_id' => $retailCashier->id,
                'outlet_id' => $mainOutlet->id,
                'status' => CashierShift::STATUS_OPEN,
            ],
            [
                'opened_by' => $retailCashier->id,
                'opened_at' => now()->subHour(),
                'opening_cash' => 200000,
                'expected_cash' => 200000,
                'notes' => 'Shift aktif demo retail.',
            ]
        );

        $retailMember = Transaction::query()->firstOrCreate(
            ['invoice' => 'DEMO-RETAIL-MEMBER-001'],
            [
                'cashier_id' => $retailCashier->id,
                'cashier_shift_id' => $retailShift->id,
                'outlet_id' => $mainOutlet->id,
                'customer_id' => $customers->get('081200000101')?->id,
                'cash' => 42000,
                'change' => 0,
                'discount' => 2000,
                'grand_total' => 40000,
                'payment_method' => 'cash',
                'payment_status' => 'paid',
                'loyalty_points_earned' => 4,
            ]
        );
        $this->attachSingleProductDetail($retailMember, $demoProducts->get('FC-SNK-001'), 1, $mainOutlet->id);

        $retailReceivable = Transaction::query()->firstOrCreate(
            ['invoice' => 'DEMO-INVOICE-AR-001'],
            [
                'cashier_id' => $retailCashier->id,
                'cashier_shift_id' => $retailShift->id,
                'outlet_id' => $mainOutlet->id,
                'customer_id' => $customers->get('081200000103')?->id,
                'cash' => 0,
                'change' => 0,
                'discount' => 0,
                'grand_total' => 72000,
                'payment_method' => 'invoice',
                'payment_status' => 'pending',
            ]
        );
        $this->attachSingleProductDetail($retailReceivable, $demoProducts->get('FC-AYM-002'), 1, $mainOutlet->id);

        $walkIn = Transaction::query()->firstOrCreate(
            ['invoice' => 'DEMO-WALKIN-001'],
            [
                'cashier_id' => $retailCashier->id,
                'cashier_shift_id' => $retailShift->id,
                'outlet_id' => $mainOutlet->id,
                'customer_id' => null,
                'cash' => 18000,
                'change' => 0,
                'discount' => 0,
                'grand_total' => 18000,
                'payment_method' => 'cash',
                'payment_status' => 'paid',
            ]
        );
        $this->attachSingleProductDetail($walkIn, $demoProducts->get('FC-MNM-002'), 1, $mainOutlet->id);

        return collect([
            'foodcourt' => $foodcourt->fresh(['details', 'kitchenTickets']),
            'retail_member' => $retailMember->fresh('details'),
            'retail_receivable' => $retailReceivable->fresh('details'),
            'walk_in' => $walkIn->fresh('details'),
        ]);
    }

    private function attachSingleProductDetail(Transaction $transaction, ?Product $product, int $qty, int $outletId): void
    {
        if (! $product || $transaction->details()->exists()) {
            return;
        }

        $lineTotal = $product->sell_price * $qty;

        $transaction->details()->create([
            'outlet_id' => $outletId,
            'tenant_outlet_id' => $product->tenant_outlet_id,
            'product_id' => $product->id,
            'qty' => $qty,
            'base_unit_price' => $product->sell_price,
            'unit_price' => $product->sell_price,
            'price' => $lineTotal,
            'discount_total' => 0,
        ]);

        $transaction->profits()->create([
            'total' => ($product->sell_price - $product->buy_price) * $qty,
        ]);
    }

    private function seedDemoReceivables(Outlet $mainOutlet, Collection $transactions, Collection $customers): void
    {
        if (! Schema::hasTable('receivables')) {
            return;
        }

        $receivableTransaction = $transactions->get('retail_receivable');
        $memberCustomer = $customers->get('081200000103');

        if ($receivableTransaction && $memberCustomer) {
            Receivable::query()->updateOrCreate(
                ['invoice' => 'AR-DEMO-001'],
                [
                    'outlet_id' => $mainOutlet->id,
                    'customer_id' => $memberCustomer->id,
                    'transaction_id' => $receivableTransaction->id,
                    'total' => 72000,
                    'paid' => 20000,
                    'due_date' => now()->addDays(7)->toDateString(),
                    'status' => 'partial',
                    'note' => 'Piutang demo corporate lunch.',
                    'collection_notes' => 'Tindak lanjut via sales supervisor.',
                ]
            );
        }
    }

    private function seedDemoPayables(Outlet $mainOutlet): void
    {
        if (! Schema::hasTable('payables')) {
            return;
        }

        $supplier = Supplier::query()->orderBy('id')->first();
        if (! $supplier) {
            return;
        }

        Payable::query()->updateOrCreate(
            ['document_number' => 'PAY-DEMO-001'],
            [
                'outlet_id' => $mainOutlet->id,
                'supplier_id' => $supplier->id,
                'total' => 450000,
                'paid' => 150000,
                'due_date' => now()->addDays(10)->toDateString(),
                'status' => 'partial',
                'note' => 'Hutang demo pembelian bahan tenant.',
            ]
        );
    }

    private function seedDemoPrintJobs(Outlet $mainOutlet, Collection $transactions): void
    {
        if (! Schema::hasTable('print_jobs')) {
            return;
        }

        /** @var Transaction|null $foodcourt */
        $foodcourt = $transactions->get('foodcourt');
        if (! $foodcourt) {
            return;
        }

        $tickets = KitchenTicket::query()
            ->where('transaction_id', $foodcourt->id)
            ->with(['kitchenStation', 'printJobs'])
            ->get();

        foreach ($tickets as $index => $ticket) {
            $device = KitchenStationDevice::query()
                ->where('kitchen_station_id', $ticket->kitchen_station_id)
                ->where('is_active', true)
                ->orderByDesc('is_primary')
                ->first();

            if (! $device) {
                continue;
            }

            $status = match ($index % 3) {
                0 => PrintJob::STATUS_SUCCESS,
                1 => PrintJob::STATUS_QUEUED,
                default => PrintJob::STATUS_FAILED,
            };

            PrintJob::query()->updateOrCreate(
                [
                    'kitchen_ticket_id' => $ticket->id,
                    'kitchen_station_device_id' => $device->id,
                ],
                [
                    'outlet_id' => $mainOutlet->id,
                    'transaction_id' => $foodcourt->id,
                    'job_type' => PrintJob::TYPE_KITCHEN_TICKET,
                    'status' => $status,
                    'copies' => 1,
                    'payload' => [
                        'ticket_number' => $ticket->ticket_number,
                        'station' => $ticket->kitchenStation?->name,
                        'device_name' => $device->name,
                    ],
                    'queued_at' => now()->subMinutes(20 - $index),
                    'processing_at' => $status !== PrintJob::STATUS_QUEUED ? now()->subMinutes(18 - $index) : null,
                    'processed_at' => $status === PrintJob::STATUS_SUCCESS ? now()->subMinutes(17 - $index) : null,
                    'failed_at' => $status === PrintJob::STATUS_FAILED ? now()->subMinutes(16 - $index) : null,
                    'failure_reason' => $status === PrintJob::STATUS_FAILED ? 'Kertas printer habis saat demo.' : null,
                    'created_by' => $foodcourt->cashier_id,
                ]
            );
        }
    }

    private function markDemoTenantSettlements(Collection $transactions): void
    {
        if (! Schema::hasTable('transaction_tenant_allocations')) {
            return;
        }

        /** @var Transaction|null $foodcourt */
        $foodcourt = $transactions->get('foodcourt');
        if (! $foodcourt) {
            return;
        }

        TransactionTenantAllocation::query()
            ->where('transaction_id', $foodcourt->id)
            ->orderBy('id')
            ->get()
            ->each(function (TransactionTenantAllocation $allocation, int $index) {
                $allocation->update([
                    'payment_status' => 'paid',
                    'kitchen_status' => $index === 0 ? 'completed' : 'pending',
                    'settled_at' => $index === 0 ? now()->subDay() : null,
                    'payout_reference' => $index === 0 ? 'PAYOUT-DEMO-001' : null,
                    'payout_notes' => $index === 0 ? 'Settlement demo tenant pertama.' : null,
                    'payout_paid_at' => $index === 0 ? now()->subDay() : null,
                ]);
            });
    }

    private function supportsKitchenWorkspaceColumns(): bool
    {
        return Schema::hasColumn('users', 'preferred_workspace')
            && Schema::hasColumn('users', 'preferred_kitchen_station_id');
    }
}
