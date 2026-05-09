<?php

namespace Database\Seeders;

use App\Models\CashierShift;
use App\Models\Category;
use App\Models\Customer;
use App\Models\CustomerOutletMetric;
use App\Models\DiningTable;
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
            $this->seedDemoCategories();
            $diningTables = $this->seedDiningTables($mainOutlet);
            $stations = $this->seedKitchenStations($mainOutlet);
            $this->seedKitchenDevices($stations);
            $users = $this->seedDemoUsers($mainOutlet, $stations, $tenantOutlets);
            $products = $this->seedDemoFoodcourtProducts($mainOutlet, $tenantOutlets);
            $this->seedProductOutletStocks($mainOutlet, $products);
            $this->seedProductMappings($products, $stations);
            $customers = $this->seedDemoCustomers($mainOutlet);
            $transactions = $this->seedDemoTransactions($mainOutlet, $users, $products, $customers, $diningTables);
            $this->seedDemoReceivables($mainOutlet, $transactions, $customers);
            $this->seedDemoPayables($mainOutlet);
            $this->seedDemoPrintJobs($mainOutlet, $transactions);
            $this->markDemoTenantSettlements($transactions);
        });

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    private function seedDemoCategories(): Collection
    {
        $rows = collect([
            [
                'name' => 'Minuman',
                'description' => 'Kategori minuman untuk demo foodcourt dapur.',
            ],
            [
                'name' => 'Makanan Berat',
                'description' => 'Kategori makanan utama untuk demo foodcourt dapur.',
            ],
            [
                'name' => 'Makanan Ringan',
                'description' => 'Kategori snack dan dessert untuk demo foodcourt dapur.',
            ],
            [
                'name' => 'Roti & Kue',
                'description' => 'Kategori bakery dan pastry untuk demo foodcourt dapur.',
            ],
        ]);

        return $rows->map(fn (array $row) => Category::query()->updateOrCreate(
            ['name' => $row['name']],
            [
                'description' => $row['description'],
                'image' => 'default.jpg',
            ]
        ))->keyBy('name');
    }

    private function seedTenantOutlets(): Collection
    {
        $rows = collect([
            [
                'code' => 'TEN-MINUM',
                'slug' => 'dapur-minuman',
                'name' => 'Dapur Minuman',
                'legal_name' => 'Dapur Minuman',
                'outlet_type' => 'tenant',
                'commission_rate_percent' => 12.5,
                'sort_order' => 10,
            ],
            [
                'code' => 'TEN-MIE',
                'slug' => 'dapur-mie',
                'name' => 'Dapur Mie',
                'legal_name' => 'Dapur Mie',
                'outlet_type' => 'tenant',
                'commission_rate_percent' => 10,
                'sort_order' => 20,
            ],
            [
                'code' => 'TEN-AYAM',
                'slug' => 'dapur-ayam',
                'name' => 'Dapur Ayam',
                'legal_name' => 'Dapur Ayam',
                'outlet_type' => 'tenant',
                'commission_rate_percent' => 15,
                'sort_order' => 30,
            ],
            [
                'code' => 'TEN-RAMEN',
                'slug' => 'dapur-ramen',
                'name' => 'Dapur Ramen',
                'legal_name' => 'Dapur Ramen',
                'outlet_type' => 'tenant',
                'commission_rate_percent' => 14,
                'sort_order' => 40,
            ],
            [
                'code' => 'TEN-STEAK',
                'slug' => 'dapur-steak',
                'name' => 'Dapur Steak',
                'legal_name' => 'Dapur Steak',
                'outlet_type' => 'tenant',
                'commission_rate_percent' => 16,
                'sort_order' => 50,
            ],
            [
                'code' => 'TEN-DURIAN',
                'slug' => 'dapur-durian',
                'name' => 'Dapur Durian',
                'legal_name' => 'Dapur Durian',
                'outlet_type' => 'tenant',
                'commission_rate_percent' => 11,
                'sort_order' => 60,
            ],
            [
                'code' => 'TEN-NASGOR',
                'slug' => 'dapur-nasgor',
                'name' => 'Dapur Nasgor',
                'legal_name' => 'Dapur Nasgor',
                'outlet_type' => 'tenant',
                'commission_rate_percent' => 13,
                'sort_order' => 70,
            ],
            [
                'code' => 'TEN-BUAH',
                'slug' => 'dapur-buah',
                'name' => 'Dapur Buah',
                'legal_name' => 'Dapur Buah',
                'outlet_type' => 'tenant',
                'commission_rate_percent' => 9,
                'sort_order' => 80,
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
            ['slug' => 'minuman', 'name' => 'Dapur Minuman', 'code' => 'ST-MINUMAN', 'display_mode' => 'screen', 'sort_order' => 10],
            ['slug' => 'mie', 'name' => 'Dapur Mie', 'code' => 'ST-MIE', 'display_mode' => 'screen', 'sort_order' => 20],
            ['slug' => 'ayam', 'name' => 'Dapur Ayam', 'code' => 'ST-AYAM', 'display_mode' => 'screen', 'sort_order' => 30],
            ['slug' => 'ramen', 'name' => 'Dapur Ramen', 'code' => 'ST-RAMEN', 'display_mode' => 'screen', 'sort_order' => 40],
            ['slug' => 'steak', 'name' => 'Dapur Steak', 'code' => 'ST-STEAK', 'display_mode' => 'screen', 'sort_order' => 50],
            ['slug' => 'durian', 'name' => 'Dapur Durian', 'code' => 'ST-DURIAN', 'display_mode' => 'screen', 'sort_order' => 60],
            ['slug' => 'nasgor', 'name' => 'Dapur Nasgor', 'code' => 'ST-NASGOR', 'display_mode' => 'screen', 'sort_order' => 70],
            ['slug' => 'buah', 'name' => 'Dapur Buah', 'code' => 'ST-BUAH', 'display_mode' => 'screen', 'sort_order' => 80],
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

    private function seedDiningTables(Outlet $mainOutlet): Collection
    {
        $rows = collect([
            ['code' => 'A1', 'name' => 'Meja A1', 'capacity' => 2, 'sort_order' => 10],
            ['code' => 'A2', 'name' => 'Meja A2', 'capacity' => 2, 'sort_order' => 20],
            ['code' => 'A3', 'name' => 'Meja A3', 'capacity' => 4, 'sort_order' => 30],
            ['code' => 'B1', 'name' => 'Meja B1', 'capacity' => 4, 'sort_order' => 40],
            ['code' => 'B2', 'name' => 'Meja B2', 'capacity' => 4, 'sort_order' => 50],
            ['code' => 'B3', 'name' => 'Meja B3', 'capacity' => 6, 'sort_order' => 60],
            ['code' => 'VIP1', 'name' => 'Meja VIP 1', 'capacity' => 6, 'sort_order' => 70],
            ['code' => 'OUT1', 'name' => 'Meja Outdoor 1', 'capacity' => 4, 'sort_order' => 80],
        ]);

        return $rows->map(function (array $row) use ($mainOutlet) {
            return DiningTable::query()->updateOrCreate(
                [
                    'outlet_id' => $mainOutlet->id,
                    'name' => $row['name'],
                ],
                [
                    'code' => $row['code'],
                    'capacity' => $row['capacity'],
                    'status' => 'active',
                    'sort_order' => $row['sort_order'],
                    'notes' => 'Meja demo untuk transaksi dine in.',
                ]
            );
        })->keyBy('code');
    }

    private function seedKitchenDevices(Collection $stations): void
    {
        foreach ($stations as $slug => $station) {
            $label = Str::title(str_replace('-', ' ', $slug));

            $devices = [
                [
                    'name' => 'Screen '.$label,
                    'device_type' => 'screen',
                    'connection_driver' => 'browser',
                    'endpoint' => 'screen://'.$slug.'-queue',
                    'is_primary' => true,
                    'meta' => [
                        'dispatch_mode' => 'manual',
                        'print_profile' => KitchenStationDevice::PRINT_PROFILE_BROWSER,
                    ],
                ],
                [
                    'name' => 'Printer '.$label,
                    'device_type' => 'printer',
                    'connection_driver' => 'browser',
                    'endpoint' => 'bluetooth://rawbt/'.$slug,
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
            ];

            foreach ($devices as $deviceData) {
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
    }

    private function seedDemoUsers(Outlet $mainOutlet, Collection $stations, Collection $tenantOutlets): Collection
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
                'email' => 'cashier.dua.demo@gmail.com',
                'name' => 'Kasir Dua Demo',
                'workspace' => 'standard',
                'station' => null,
                'roles' => $cashierRole ? [$cashierRole->name] : [],
                'primary_outlet' => $mainOutlet->id,
            ],
            [
                'email' => 'waiter.satu.demo@gmail.com',
                'name' => 'Waiter Satu Demo',
                'workspace' => 'standard',
                'station' => null,
                'roles' => ['waiter'],
                'primary_outlet' => $mainOutlet->id,
                'waiter_service_scope' => 'outlet_all',
                'waiter_tenant_slugs' => [],
            ],
            [
                'email' => 'waiter.dua.demo@gmail.com',
                'name' => 'Waiter Dua Demo',
                'workspace' => 'standard',
                'station' => null,
                'roles' => ['waiter'],
                'primary_outlet' => $mainOutlet->id,
                'waiter_service_scope' => 'tenant_only',
                'waiter_tenant_slugs' => ['dapur-minuman', 'dapur-buah', 'dapur-durian'],
            ],
        ])
            ->merge(
                collect([
                    'minuman' => 'Dapur Minuman',
                    'mie' => 'Dapur Mie',
                    'ayam' => 'Dapur Ayam',
                    'ramen' => 'Dapur Ramen',
                    'steak' => 'Dapur Steak',
                    'durian' => 'Dapur Durian',
                    'nasgor' => 'Dapur Nasgor',
                    'buah' => 'Dapur Buah',
                ])->map(fn (string $name, string $slug) => [
                    'email' => 'kitchen.'.$slug.'@gmail.com',
                    'name' => $name.' Demo',
                    'workspace' => 'kitchen',
                    'station' => $stations->get($slug)?->id,
                    'roles' => [$kitchenRole->name],
                    'primary_outlet' => $mainOutlet->id,
                ])
            )
            ->map(function (array $row) use ($workspaceColumnsReady, $tenantOutlets) {
            $attributes = [
                'name' => $row['name'],
                'password' => Hash::make('password'),
            ];

            if ($workspaceColumnsReady) {
                $attributes['preferred_workspace'] = $row['workspace'];
                $attributes['preferred_kitchen_station_id'] = $row['station'];
            }

            if (Schema::hasColumn('users', 'waiter_service_scope')) {
                $attributes['waiter_service_scope'] = $row['waiter_service_scope'] ?? 'outlet_all';
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

            if (Schema::hasTable('user_waiter_tenant_outlet')) {
                $tenantIds = collect($row['waiter_tenant_slugs'] ?? [])
                    ->map(fn (string $slug) => $tenantOutlets->get($slug)?->id)
                    ->filter()
                    ->values()
                    ->all();

                $user->waiterTenantOutlets()->sync($tenantIds);
            }

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
            'Roti & Kue',
        ])->get()->keyBy('name');

        $rows = collect([
            ['barcode' => 'FC-MIN-001', 'title' => 'Es Teh Tarik', 'description' => 'Minuman creamy favorit untuk testing dapur minuman.', 'category' => 'Minuman', 'tenant_slug' => 'dapur-minuman', 'station_slug' => 'minuman', 'buy_price' => 7000, 'sell_price' => 16000, 'stock' => 90, 'modifier_options' => [['name' => 'Boba', 'price' => 4000], ['name' => 'Grass jelly', 'price' => 3000], ['name' => 'Extra susu', 'price' => 3000]]],
            ['barcode' => 'FC-MIN-002', 'title' => 'Kopi Susu Aren', 'description' => 'Kopi susu aren untuk simulasi antrian beverage.', 'category' => 'Minuman', 'tenant_slug' => 'dapur-minuman', 'station_slug' => 'minuman', 'buy_price' => 8000, 'sell_price' => 18000, 'stock' => 80, 'modifier_options' => [['name' => 'Extra espresso', 'price' => 5000], ['name' => 'Oat milk', 'price' => 6000], ['name' => 'Whipped cream', 'price' => 4000]]],
            ['barcode' => 'FC-MIN-003', 'title' => 'Matcha Latte', 'description' => 'Matcha latte premium untuk demo topping minuman.', 'category' => 'Minuman', 'tenant_slug' => 'dapur-minuman', 'station_slug' => 'minuman', 'buy_price' => 10000, 'sell_price' => 22000, 'stock' => 70, 'modifier_options' => [['name' => 'Cheese foam', 'price' => 5000], ['name' => 'Boba', 'price' => 4000], ['name' => 'Extra matcha', 'price' => 5000]]],
            ['barcode' => 'FC-MIN-004', 'title' => 'Chocolate Hazelnut', 'description' => 'Minuman coklat pekat untuk testing custom extra.', 'category' => 'Minuman', 'tenant_slug' => 'dapur-minuman', 'station_slug' => 'minuman', 'buy_price' => 9000, 'sell_price' => 20000, 'stock' => 65, 'modifier_options' => [['name' => 'Marshmallow', 'price' => 3000], ['name' => 'Ice cream vanilla', 'price' => 5000], ['name' => 'Extra sauce coklat', 'price' => 3000]]],

            ['barcode' => 'FC-MIE-001', 'title' => 'Mie Goreng Jawa', 'description' => 'Mie goreng gurih khas untuk dapur mie.', 'category' => 'Makanan Berat', 'tenant_slug' => 'dapur-mie', 'station_slug' => 'mie', 'buy_price' => 13000, 'sell_price' => 22000, 'stock' => 60, 'modifier_options' => [['name' => 'Telur dadar', 'price' => 5000], ['name' => 'Bakso', 'price' => 6000], ['name' => 'Pangsit goreng', 'price' => 4000]]],
            ['barcode' => 'FC-MIE-002', 'title' => 'Mie Nyemek Spesial', 'description' => 'Mie nyemek pedas manis untuk antrian dapur mie.', 'category' => 'Makanan Berat', 'tenant_slug' => 'dapur-mie', 'station_slug' => 'mie', 'buy_price' => 15000, 'sell_price' => 25000, 'stock' => 55, 'modifier_options' => [['name' => 'Kornet', 'price' => 7000], ['name' => 'Keju', 'price' => 5000], ['name' => 'Sosis', 'price' => 6000]]],
            ['barcode' => 'FC-MIE-003', 'title' => 'Mie Godog Kampung', 'description' => 'Mie kuah gurih lengkap untuk skenario kitchen ticket.', 'category' => 'Makanan Berat', 'tenant_slug' => 'dapur-mie', 'station_slug' => 'mie', 'buy_price' => 14000, 'sell_price' => 23000, 'stock' => 58, 'modifier_options' => [['name' => 'Telur ceplok', 'price' => 5000], ['name' => 'Ayam suwir', 'price' => 7000], ['name' => 'Sambal ijo', 'price' => 2000]]],
            ['barcode' => 'FC-MIE-004', 'title' => 'Mie Ayam Rica', 'description' => 'Mie ayam pedas untuk dapur mie dengan topping lengkap.', 'category' => 'Makanan Berat', 'tenant_slug' => 'dapur-mie', 'station_slug' => 'mie', 'buy_price' => 16000, 'sell_price' => 26000, 'stock' => 52, 'modifier_options' => [['name' => 'Pangsit rebus', 'price' => 5000], ['name' => 'Ceker', 'price' => 7000], ['name' => 'Bakso', 'price' => 6000]]],

            ['barcode' => 'FC-AYM-001', 'title' => 'Ayam Geprek Original', 'description' => 'Menu ayam favorit untuk skenario dapur ayam.', 'category' => 'Makanan Berat', 'tenant_slug' => 'dapur-ayam', 'station_slug' => 'ayam', 'buy_price' => 17000, 'sell_price' => 28000, 'stock' => 68, 'modifier_options' => [['name' => 'Keju leleh', 'price' => 6000], ['name' => 'Telur dadar', 'price' => 5000], ['name' => 'Sambal ekstra', 'price' => 2000]]],
            ['barcode' => 'FC-AYM-002', 'title' => 'Ayam Bakar Madu', 'description' => 'Ayam bakar manis gurih untuk tenant ayam.', 'category' => 'Makanan Berat', 'tenant_slug' => 'dapur-ayam', 'station_slug' => 'ayam', 'buy_price' => 19000, 'sell_price' => 32000, 'stock' => 54, 'modifier_options' => [['name' => 'Nasi putih', 'price' => 6000], ['name' => 'Kulit crispy', 'price' => 7000], ['name' => 'Sambal matah', 'price' => 3000]]],
            ['barcode' => 'FC-AYM-003', 'title' => 'Ayam Crispy Blackpepper', 'description' => 'Ayam crispy dengan saus lada hitam.', 'category' => 'Makanan Berat', 'tenant_slug' => 'dapur-ayam', 'station_slug' => 'ayam', 'buy_price' => 20000, 'sell_price' => 34000, 'stock' => 48, 'modifier_options' => [['name' => 'Kentang goreng', 'price' => 8000], ['name' => 'Cheese sauce', 'price' => 5000], ['name' => 'Telur ceplok', 'price' => 5000]]],
            ['barcode' => 'FC-AYM-004', 'title' => 'Paket Ayam Komplit', 'description' => 'Ayam, nasi, lalap, dan sambal untuk testing paket.', 'category' => 'Makanan Berat', 'tenant_slug' => 'dapur-ayam', 'station_slug' => 'ayam', 'buy_price' => 24000, 'sell_price' => 39000, 'stock' => 46, 'modifier_options' => [['name' => 'Extra ayam', 'price' => 14000], ['name' => 'Tahu tempe', 'price' => 4000], ['name' => 'Sambal korek', 'price' => 3000]]],

            ['barcode' => 'FC-RMN-001', 'title' => 'Ramen Original', 'description' => 'Ramen kuah gurih untuk dapur ramen.', 'category' => 'Makanan Berat', 'tenant_slug' => 'dapur-ramen', 'station_slug' => 'ramen', 'buy_price' => 22000, 'sell_price' => 36000, 'stock' => 44, 'modifier_options' => [['name' => 'Ajitama egg', 'price' => 7000], ['name' => 'Nori', 'price' => 4000], ['name' => 'Chashu', 'price' => 12000]]],
            ['barcode' => 'FC-RMN-002', 'title' => 'Spicy Tori Ramen', 'description' => 'Ramen ayam pedas untuk skenario modifier pedas.', 'category' => 'Makanan Berat', 'tenant_slug' => 'dapur-ramen', 'station_slug' => 'ramen', 'buy_price' => 23000, 'sell_price' => 38000, 'stock' => 40, 'modifier_options' => [['name' => 'Jamur enoki', 'price' => 6000], ['name' => 'Extra chicken', 'price' => 10000], ['name' => 'Cheese slice', 'price' => 5000]]],
            ['barcode' => 'FC-RMN-003', 'title' => 'Beef Curry Ramen', 'description' => 'Ramen kari daging dengan topping premium.', 'category' => 'Makanan Berat', 'tenant_slug' => 'dapur-ramen', 'station_slug' => 'ramen', 'buy_price' => 25000, 'sell_price' => 42000, 'stock' => 35, 'modifier_options' => [['name' => 'Beef slice', 'price' => 12000], ['name' => 'Ajitama egg', 'price' => 7000], ['name' => 'Extra noodle', 'price' => 8000]]],
            ['barcode' => 'FC-RMN-004', 'title' => 'Chicken Katsu Ramen', 'description' => 'Ramen dengan chicken katsu untuk test combo.', 'category' => 'Makanan Berat', 'tenant_slug' => 'dapur-ramen', 'station_slug' => 'ramen', 'buy_price' => 24000, 'sell_price' => 40000, 'stock' => 38, 'modifier_options' => [['name' => 'Katsu extra', 'price' => 12000], ['name' => 'Corn butter', 'price' => 5000], ['name' => 'Nori', 'price' => 4000]]],

            ['barcode' => 'FC-STK-001', 'title' => 'Chicken Steak Crispy', 'description' => 'Steak ayam crispy lengkap dengan sayur.', 'category' => 'Makanan Berat', 'tenant_slug' => 'dapur-steak', 'station_slug' => 'steak', 'buy_price' => 22000, 'sell_price' => 36000, 'stock' => 42, 'modifier_options' => [['name' => 'Kentang wedges', 'price' => 8000], ['name' => 'Mushroom sauce', 'price' => 5000], ['name' => 'Cheese sauce', 'price' => 5000]]],
            ['barcode' => 'FC-STK-002', 'title' => 'Sirloin Steak', 'description' => 'Sirloin steak premium untuk simulasi high value order.', 'category' => 'Makanan Berat', 'tenant_slug' => 'dapur-steak', 'station_slug' => 'steak', 'buy_price' => 38000, 'sell_price' => 58000, 'stock' => 30, 'modifier_options' => [['name' => 'Extra beef slice', 'price' => 18000], ['name' => 'Mashed potato', 'price' => 9000], ['name' => 'Blackpepper sauce', 'price' => 5000]]],
            ['barcode' => 'FC-STK-003', 'title' => 'Beef Steak BBQ', 'description' => 'Beef steak dengan saus BBQ manis asap.', 'category' => 'Makanan Berat', 'tenant_slug' => 'dapur-steak', 'station_slug' => 'steak', 'buy_price' => 34000, 'sell_price' => 54000, 'stock' => 32, 'modifier_options' => [['name' => 'Onion ring', 'price' => 8000], ['name' => 'Cheese sauce', 'price' => 5000], ['name' => 'Sunny side egg', 'price' => 5000]]],
            ['barcode' => 'FC-STK-004', 'title' => 'Mix Grill Platter', 'description' => 'Paket grill combo untuk testing item premium.', 'category' => 'Makanan Berat', 'tenant_slug' => 'dapur-steak', 'station_slug' => 'steak', 'buy_price' => 42000, 'sell_price' => 68000, 'stock' => 26, 'modifier_options' => [['name' => 'Sosis bratwurst', 'price' => 12000], ['name' => 'Mashed potato', 'price' => 9000], ['name' => 'Extra sauce', 'price' => 4000]]],

            ['barcode' => 'FC-DRN-001', 'title' => 'Es Durian Original', 'description' => 'Dessert durian andalan untuk dapur durian.', 'category' => 'Makanan Ringan', 'tenant_slug' => 'dapur-durian', 'station_slug' => 'durian', 'buy_price' => 18000, 'sell_price' => 30000, 'stock' => 40, 'modifier_options' => [['name' => 'Extra daging durian', 'price' => 12000], ['name' => 'Keju parut', 'price' => 5000], ['name' => 'Coklat meses', 'price' => 3000]]],
            ['barcode' => 'FC-DRN-002', 'title' => 'Pancake Durian', 'description' => 'Pancake durian lembut isi krim melimpah.', 'category' => 'Roti & Kue', 'tenant_slug' => 'dapur-durian', 'station_slug' => 'durian', 'buy_price' => 16000, 'sell_price' => 28000, 'stock' => 36, 'modifier_options' => [['name' => 'Extra filling durian', 'price' => 10000], ['name' => 'Oreo crumble', 'price' => 4000], ['name' => 'Cheese topping', 'price' => 5000]]],
            ['barcode' => 'FC-DRN-003', 'title' => 'Durian Box Premium', 'description' => 'Durian cup premium untuk transaksi dessert.', 'category' => 'Makanan Ringan', 'tenant_slug' => 'dapur-durian', 'station_slug' => 'durian', 'buy_price' => 20000, 'sell_price' => 34000, 'stock' => 34, 'modifier_options' => [['name' => 'Almond slice', 'price' => 5000], ['name' => 'Extra krim', 'price' => 4000], ['name' => 'Brown sugar sauce', 'price' => 4000]]],
            ['barcode' => 'FC-DRN-004', 'title' => 'Durian Cheese Cup', 'description' => 'Durian cup dengan kombinasi keju gurih.', 'category' => 'Makanan Ringan', 'tenant_slug' => 'dapur-durian', 'station_slug' => 'durian', 'buy_price' => 19000, 'sell_price' => 32000, 'stock' => 33, 'modifier_options' => [['name' => 'Cheese foam', 'price' => 6000], ['name' => 'Extra daging durian', 'price' => 12000], ['name' => 'Biskuit regal', 'price' => 4000]]],

            ['barcode' => 'FC-NSG-001', 'title' => 'Nasgor Biasa', 'description' => 'Nasi goreng klasik untuk testing dapur nasgor.', 'category' => 'Makanan Berat', 'tenant_slug' => 'dapur-nasgor', 'station_slug' => 'nasgor', 'buy_price' => 15000, 'sell_price' => 24000, 'stock' => 62, 'modifier_options' => [['name' => 'Telur dadar', 'price' => 5000], ['name' => 'Sosis', 'price' => 6000], ['name' => 'Keju', 'price' => 5000]]],
            ['barcode' => 'FC-NSG-002', 'title' => 'Nasgor Ayam', 'description' => 'Nasi goreng ayam gurih untuk simulasi add-on lauk.', 'category' => 'Makanan Berat', 'tenant_slug' => 'dapur-nasgor', 'station_slug' => 'nasgor', 'buy_price' => 17000, 'sell_price' => 28000, 'stock' => 58, 'modifier_options' => [['name' => 'Ayam crispy', 'price' => 10000], ['name' => 'Telur ceplok', 'price' => 5000], ['name' => 'Acar', 'price' => 2000]]],
            ['barcode' => 'FC-NSG-003', 'title' => 'Nasgor Spesial', 'description' => 'Nasi goreng spesial lengkap untuk skenario high-demand.', 'category' => 'Makanan Berat', 'tenant_slug' => 'dapur-nasgor', 'station_slug' => 'nasgor', 'buy_price' => 19000, 'sell_price' => 32000, 'stock' => 50, 'modifier_options' => [['name' => 'Bakso', 'price' => 6000], ['name' => 'Udang', 'price' => 9000], ['name' => 'Keju mozarella', 'price' => 7000]]],
            ['barcode' => 'FC-NSG-004', 'title' => 'Nasgor Seafood', 'description' => 'Nasi goreng seafood untuk testing item lintas topping.', 'category' => 'Makanan Berat', 'tenant_slug' => 'dapur-nasgor', 'station_slug' => 'nasgor', 'buy_price' => 21000, 'sell_price' => 35000, 'stock' => 46, 'modifier_options' => [['name' => 'Cumi extra', 'price' => 10000], ['name' => 'Telur dadar', 'price' => 5000], ['name' => 'Sambal roa', 'price' => 3000]]],

            ['barcode' => 'FC-BUH-001', 'title' => 'Salad Buah Premium', 'description' => 'Salad buah segar untuk dapur buah.', 'category' => 'Makanan Ringan', 'tenant_slug' => 'dapur-buah', 'station_slug' => 'buah', 'buy_price' => 12000, 'sell_price' => 18000, 'stock' => 72, 'modifier_options' => [['name' => 'Keju parut', 'price' => 4000], ['name' => 'Yogurt dressing', 'price' => 4000], ['name' => 'Granola', 'price' => 5000]]],
            ['barcode' => 'FC-BUH-002', 'title' => 'Jus Alpukat', 'description' => 'Jus alpukat kental untuk dapur buah.', 'category' => 'Minuman', 'tenant_slug' => 'dapur-buah', 'station_slug' => 'buah', 'buy_price' => 10000, 'sell_price' => 17000, 'stock' => 64, 'modifier_options' => [['name' => 'Extra espresso', 'price' => 5000], ['name' => 'Coklat sauce', 'price' => 3000], ['name' => 'Ice cream vanilla', 'price' => 5000]]],
            ['barcode' => 'FC-BUH-003', 'title' => 'Sop Buah', 'description' => 'Sop buah segar untuk order family.', 'category' => 'Minuman', 'tenant_slug' => 'dapur-buah', 'station_slug' => 'buah', 'buy_price' => 13000, 'sell_price' => 20000, 'stock' => 66, 'modifier_options' => [['name' => 'Nata de coco', 'price' => 3000], ['name' => 'Melon extra', 'price' => 3000], ['name' => 'Susu kental manis', 'price' => 2000]]],
            ['barcode' => 'FC-BUH-004', 'title' => 'Fruit Yogurt Bowl', 'description' => 'Yogurt bowl buah untuk testing dessert outlet.', 'category' => 'Makanan Ringan', 'tenant_slug' => 'dapur-buah', 'station_slug' => 'buah', 'buy_price' => 14000, 'sell_price' => 22000, 'stock' => 48, 'modifier_options' => [['name' => 'Madu', 'price' => 3000], ['name' => 'Granola', 'price' => 5000], ['name' => 'Kiwi extra', 'price' => 4000]]],
        ]);

        $products = $rows->map(function (array $row) use ($categories, $tenantOutlets) {
            $category = $categories->get($row['category']);
            $tenant = $tenantOutlets->get($row['tenant_slug']);

            $product = Product::query()->updateOrCreate(
                ['barcode' => $row['barcode']],
                [
                    'category_id' => $category?->id,
                    'image' => 'default.jpg',
                    'title' => $row['title'],
                    'description' => $row['description'],
                    'buy_price' => $row['buy_price'],
                    'sell_price' => $row['sell_price'],
                    'tenant_outlet_id' => $tenant?->id,
                    'supports_modifiers' => true,
                    'stock' => $row['stock'],
                ]
            );

            $product->modifierOptions()->delete();
            $product->modifierOptions()->createMany(
                collect($row['modifier_options'] ?? [])
                    ->values()
                    ->map(fn (array $option, int $index) => [
                        'name' => $option['name'],
                        'price' => (int) ($option['price'] ?? 0),
                        'is_active' => true,
                        'sort_order' => $index + 1,
                    ])
                    ->all()
            );

            return tap($product, function (Product $product) use ($row) {
                $product->setAttribute('demo_station_slug', $row['station_slug']);
            });
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
        foreach ($demoProducts as $product) {
            $stationSlug = $product->getAttribute('demo_station_slug');
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
        Collection $customers,
        Collection $diningTables
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
                'order_type' => 'dine_in',
                'table_id' => $diningTables->get('A3')?->id,
                'waiter_id' => $users->get('waiter.satu.demo@gmail.com')?->id,
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
                ['barcode' => 'FC-MIN-001', 'qty' => 2],
                ['barcode' => 'FC-MIE-002', 'qty' => 1],
                ['barcode' => 'FC-AYM-002', 'qty' => 1],
                ['barcode' => 'FC-NSG-003', 'qty' => 1],
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
                'order_type' => 'take_away',
                'waiter_id' => null,
                'cash' => 20000,
                'change' => 2000,
                'discount' => 0,
                'grand_total' => 18000,
                'payment_method' => 'cash',
                'payment_status' => 'paid',
                'loyalty_points_earned' => 4,
            ]
        );
        $this->attachSingleProductDetail($retailMember, $demoProducts->get('FC-BUH-001'), 1, $mainOutlet->id);

        $retailReceivable = Transaction::query()->firstOrCreate(
            ['invoice' => 'DEMO-INVOICE-AR-001'],
            [
                'cashier_id' => $retailCashier->id,
                'cashier_shift_id' => $retailShift->id,
                'outlet_id' => $mainOutlet->id,
                'customer_id' => $customers->get('081200000103')?->id,
                'order_type' => 'dine_in',
                'table_id' => $diningTables->get('VIP1')?->id,
                'waiter_id' => $users->get('waiter.dua.demo@gmail.com')?->id,
                'cash' => 0,
                'change' => 0,
                'discount' => 0,
                'grand_total' => 58000,
                'payment_method' => 'invoice',
                'payment_status' => 'pending',
            ]
        );
        $this->attachSingleProductDetail($retailReceivable, $demoProducts->get('FC-STK-002'), 1, $mainOutlet->id);

        $walkIn = Transaction::query()->firstOrCreate(
            ['invoice' => 'DEMO-WALKIN-001'],
            [
                'cashier_id' => $retailCashier->id,
                'cashier_shift_id' => $retailShift->id,
                'outlet_id' => $mainOutlet->id,
                'customer_id' => null,
                'order_type' => 'take_away',
                'waiter_id' => null,
                'cash' => 18000,
                'change' => 0,
                'discount' => 0,
                'grand_total' => 18000,
                'payment_method' => 'cash',
                'payment_status' => 'paid',
            ]
        );
        $this->attachSingleProductDetail($walkIn, $demoProducts->get('FC-MIN-002'), 1, $mainOutlet->id);

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
                    'kitchen_status' => $index <= 1 ? 'completed' : 'pending',
                    'waiter_status' => match ($index) {
                        0 => 'delivered',
                        1 => 'picked_up',
                        2 => 'ready',
                        default => 'pending',
                    },
                    'ready_at' => $index <= 2 ? now()->subMinutes(20 - ($index * 4)) : null,
                    'picked_up_at' => $index <= 1 ? now()->subMinutes(15 - ($index * 3)) : null,
                    'delivered_at' => $index === 0 ? now()->subMinutes(8) : null,
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
