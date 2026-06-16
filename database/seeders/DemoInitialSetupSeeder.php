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
            $this->seedDemoCategories($tenantOutlets);
            $diningTables = $this->seedDiningTables($mainOutlet);
            $stations = $this->seedKitchenStations($mainOutlet);
            $this->seedKitchenDevices($stations);
            $this->seedDemoUsers($mainOutlet, $stations, $tenantOutlets);
            $products = $this->seedDemoFoodcourtProducts($mainOutlet, $tenantOutlets);
            $this->seedProductOutletStocks($mainOutlet, $products);
            $this->seedProductMappings($products, $stations);
        });

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    private function seedDemoCategories(Collection $tenantOutlets): Collection
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

        $categories = $rows->map(fn (array $row) => Category::query()->updateOrCreate(
            ['name' => $row['name']],
            [
                'description' => $row['description'],
                'image' => 'default.jpg',
            ]
        ));

        $minumanTenant = $tenantOutlets->get('dapur-minuman');

        if ($minumanTenant) {
            $tenantCategories = collect($this->minumanSections())
                ->map(fn (array $section) => Category::query()->updateOrCreate(
                    [
                        'name' => $section['group'],
                        'tenant_outlet_id' => $minumanTenant->id,
                    ],
                    [
                        'description' => sprintf(
                            'Kategori tenant %s untuk demo foodcourt dapur minuman.',
                            $section['group']
                        ),
                        'image' => 'default.jpg',
                    ]
                ));

            $categories = $categories->merge($tenantCategories);
        }

        $mieTenant = $tenantOutlets->get('dapur-mie');

        if ($mieTenant) {
            $tenantCategories = collect($this->mieSections())
                ->map(fn (array $section) => Category::query()->updateOrCreate(
                    [
                        'name' => $section['group'],
                        'tenant_outlet_id' => $mieTenant->id,
                    ],
                    [
                        'description' => sprintf(
                            'Kategori tenant %s untuk demo foodcourt dapur mie.',
                            $section['group']
                        ),
                        'image' => 'default.jpg',
                    ]
                ));

            $categories = $categories->merge($tenantCategories);
        }

        $durianTenant = $tenantOutlets->get('dapur-durian');

        if ($durianTenant) {
            $tenantCategories = collect($this->durianSections())
                ->map(fn (array $section) => Category::query()->updateOrCreate(
                    [
                        'name' => $section['group'],
                        'tenant_outlet_id' => $durianTenant->id,
                    ],
                    [
                        'description' => sprintf(
                            'Kategori tenant %s untuk demo foodcourt dapur durian.',
                            $section['group']
                        ),
                        'image' => 'default.jpg',
                    ]
                ));

            $categories = $categories->merge($tenantCategories);
        }

        $ayamTenant = $tenantOutlets->get('dapur-ayam');

        if ($ayamTenant) {
            $tenantCategories = collect($this->ayamSections())
                ->map(fn (array $section) => Category::query()->updateOrCreate(
                    [
                        'name' => $section['group'],
                        'tenant_outlet_id' => $ayamTenant->id,
                    ],
                    [
                        'description' => sprintf(
                            'Kategori tenant %s untuk demo foodcourt dapur ayam.',
                            $section['group']
                        ),
                        'image' => 'default.jpg',
                    ]
                ));

            $categories = $categories->merge($tenantCategories);
        }

        $buahTenant = $tenantOutlets->get('dapur-buah');

        if ($buahTenant) {
            $tenantCategories = collect($this->buahSections())
                ->map(fn (array $section) => Category::query()->updateOrCreate(
                    [
                        'name' => $section['group'],
                        'tenant_outlet_id' => $buahTenant->id,
                    ],
                    [
                        'description' => sprintf(
                            'Kategori tenant %s untuk demo foodcourt dapur buah.',
                            $section['group']
                        ),
                        'image' => 'default.jpg',
                    ]
                ));

            $categories = $categories->merge($tenantCategories);
        }

        $ramenTenant = $tenantOutlets->get('dapur-ramen');

        if ($ramenTenant) {
            $tenantCategories = collect($this->ramenSections())
                ->map(fn (array $section) => Category::query()->updateOrCreate(
                    [
                        'name' => $section['group'],
                        'tenant_outlet_id' => $ramenTenant->id,
                    ],
                    [
                        'description' => sprintf(
                            'Kategori tenant %s untuk demo foodcourt dapur ramen.',
                            $section['group']
                        ),
                        'image' => 'default.jpg',
                    ]
                ));

            $categories = $categories->merge($tenantCategories);
        }

        return $categories->keyBy(fn (Category $category) => sprintf(
            '%s:%s',
            $category->tenant_outlet_id ?: 'global',
            Str::lower($category->name)
        ));
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
        $rows = collect();

        foreach (range(1, 45) as $number) {
            $code = str_pad((string) $number, 3, '0', STR_PAD_LEFT);

            if ($number <= 10) {
                $area = 'VIP';
                $capacity = 6;
            } elseif ($number <= 36) {
                $area = 'Semi Outdoor';
                $capacity = 4;
            } elseif ($number <= 40) {
                $area = 'Depan Panggung';
                $capacity = 4;
            } else {
                $area = 'Depan VIP';
                $capacity = 6;
            }

            $rows->push([
                'code' => $code,
                'name' => $code.' '.$area,
                'capacity' => $capacity,
                'sort_order' => $number * 10,
            ]);
        }

        $activeCodes = $rows->pluck('code')->all();

        DiningTable::query()
            ->where('outlet_id', $mainOutlet->id)
            ->whereNotIn('code', $activeCodes)
            ->doesntHave('transactions')
            ->doesntHave('tableOrders')
            ->delete();

        return $rows->map(function (array $row) use ($mainOutlet) {
            return DiningTable::query()->updateOrCreate(
                [
                    'outlet_id' => $mainOutlet->id,
                    'code' => $row['code'],
                ],
                [
                    'name' => $row['name'],
                    'qr_token' => (string) Str::uuid(),
                    'capacity' => $row['capacity'],
                    'status' => 'active',
                    'self_order_enabled' => true,
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
        $workspaceColumnsReady = $this->supportsKitchenWorkspaceColumns();
        $this->purgeLegacyDemoUsers();
        $tenantSpecs = collect([
            ['slug' => 'dapur-minuman', 'station_slug' => 'minuman', 'name' => 'Dapur Minuman', 'handle' => 'minuman'],
            ['slug' => 'dapur-mie', 'station_slug' => 'mie', 'name' => 'Dapur Mie', 'handle' => 'mie'],
            ['slug' => 'dapur-ayam', 'station_slug' => 'ayam', 'name' => 'Dapur Ayam', 'handle' => 'ayam'],
            ['slug' => 'dapur-ramen', 'station_slug' => 'ramen', 'name' => 'Dapur Ramen', 'handle' => 'ramen'],
            ['slug' => 'dapur-steak', 'station_slug' => 'steak', 'name' => 'Dapur Steak', 'handle' => 'steak'],
            ['slug' => 'dapur-durian', 'station_slug' => 'durian', 'name' => 'Dapur Durian', 'handle' => 'durian'],
            ['slug' => 'dapur-nasgor', 'station_slug' => 'nasgor', 'name' => 'Dapur Nasgor', 'handle' => 'nasgor'],
            ['slug' => 'dapur-buah', 'station_slug' => 'buah', 'name' => 'Dapur Buah', 'handle' => 'buah'],
        ]);

        $users = collect([
            [
                'email' => 'admin.outlet@gtc-center.my.id',
                'name' => 'Admin Outlet Demo',
                'workspace' => 'standard',
                'station' => null,
                'roles' => ['admin-owner-outlet'],
                'primary_outlet' => $mainOutlet->id,
                'outlet_ids' => [$mainOutlet->id],
            ],
            [
                'email' => 'owner.outlet@gtc-center.my.id',
                'name' => 'Outlet Owner Demo',
                'workspace' => 'standard',
                'station' => null,
                'roles' => ['outlet-owner'],
                'primary_outlet' => $mainOutlet->id,
                'outlet_ids' => [$mainOutlet->id],
            ],
            [
                'email' => 'cashier.foodcourt@gtc-center.my.id',
                'name' => 'Kasir Foodcourt Demo',
                'workspace' => 'standard',
                'station' => null,
                'roles' => ['cashier'],
                'primary_outlet' => $mainOutlet->id,
                'outlet_ids' => [$mainOutlet->id],
            ],
            [
                'email' => 'waiter.outlet@gtc-center.my.id',
                'name' => 'Petugas Antar Outlet Demo',
                'workspace' => 'standard',
                'station' => null,
                'roles' => ['waiter'],
                'primary_outlet' => $mainOutlet->id,
                'outlet_ids' => [$mainOutlet->id],
                'waiter_service_scope' => 'outlet_all',
                'waiter_tenant_slugs' => [],
            ],
        ])->merge(
            $tenantSpecs->flatMap(function (array $tenant) use ($tenantOutlets, $stations, $mainOutlet) {
                $tenantOutletId = $tenantOutlets->get($tenant['slug'])?->id;
                $stationId = $stations->get($tenant['station_slug'])?->id;

                return [
                    [
                        'email' => 'owner.'.$tenant['handle'].'@gtc-center.my.id',
                        'name' => 'Owner '.$tenant['name'],
                        'workspace' => 'standard',
                        'station' => null,
                        'roles' => ['tenant-owner'],
                        'primary_outlet' => $tenantOutletId,
                        'outlet_ids' => [$tenantOutletId],
                    ],
                    [
                        'email' => 'ops.'.$tenant['handle'].'@gtc-center.my.id',
                        'name' => 'Operasional '.$tenant['name'],
                        'workspace' => 'standard',
                        'station' => null,
                        'roles' => ['tenant-operasional'],
                        'primary_outlet' => $tenantOutletId,
                        'outlet_ids' => [$tenantOutletId],
                    ],
                    [
                        'email' => 'antar.'.$tenant['handle'].'@gtc-center.my.id',
                        'name' => 'Petugas Antar '.$tenant['name'],
                        'workspace' => 'standard',
                        'station' => null,
                        'roles' => ['tenant-petugas-antar'],
                        'primary_outlet' => $tenantOutletId,
                        'outlet_ids' => [$tenantOutletId],
                        'waiter_service_scope' => 'tenant_only',
                        'waiter_tenant_slugs' => [$tenant['slug']],
                    ],
                    [
                        'email' => 'dapur.'.$tenant['handle'].'@gtc-center.my.id',
                        'name' => 'Layar '.$tenant['name'],
                        'workspace' => 'kitchen',
                        'station' => $stationId,
                        'roles' => ['kitchen-operator'],
                        'primary_outlet' => $mainOutlet->id,
                        'outlet_ids' => array_values(array_filter([$mainOutlet->id, $tenantOutletId])),
                    ],
                ];
            })
        )->map(function (array $row) use ($workspaceColumnsReady, $tenantOutlets) {
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

            $syncOutlets = collect($row['outlet_ids'] ?? [$row['primary_outlet']])
                ->filter()
                ->unique()
                ->mapWithKeys(fn ($outletId) => [
                    $outletId => ['is_primary' => (int) $outletId === (int) $row['primary_outlet']],
                ])
                ->all();

            if ($syncOutlets !== []) {
                $user->outlets()->sync($syncOutlets);
            }

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

    private function purgeLegacyDemoUsers(): void
    {
        $emailMap = [
            'admin.outlet@gmail.com' => 'admin.outlet@gtc-center.my.id',
            'owner.outlet@gmail.com' => 'owner.outlet@gtc-center.my.id',
            'cashier.foodcourt@gmail.com' => 'cashier.foodcourt@gtc-center.my.id',
            'waiter.outlet@gmail.com' => 'waiter.outlet@gtc-center.my.id',
            'owner.minuman@gmail.com' => 'owner.minuman@gtc-center.my.id',
            'ops.minuman@gmail.com' => 'ops.minuman@gtc-center.my.id',
            'antar.minuman@gmail.com' => 'antar.minuman@gtc-center.my.id',
            'kitchen.minuman@gmail.com' => 'dapur.minuman@gtc-center.my.id',
            'owner.mie@gmail.com' => 'owner.mie@gtc-center.my.id',
            'ops.mie@gmail.com' => 'ops.mie@gtc-center.my.id',
            'antar.mie@gmail.com' => 'antar.mie@gtc-center.my.id',
            'kitchen.mie@gmail.com' => 'dapur.mie@gtc-center.my.id',
            'owner.ayam@gmail.com' => 'owner.ayam@gtc-center.my.id',
            'ops.ayam@gmail.com' => 'ops.ayam@gtc-center.my.id',
            'antar.ayam@gmail.com' => 'antar.ayam@gtc-center.my.id',
            'kitchen.ayam@gmail.com' => 'dapur.ayam@gtc-center.my.id',
            'owner.ramen@gmail.com' => 'owner.ramen@gtc-center.my.id',
            'ops.ramen@gmail.com' => 'ops.ramen@gtc-center.my.id',
            'antar.ramen@gmail.com' => 'antar.ramen@gtc-center.my.id',
            'kitchen.ramen@gmail.com' => 'dapur.ramen@gtc-center.my.id',
            'owner.steak@gmail.com' => 'owner.steak@gtc-center.my.id',
            'ops.steak@gmail.com' => 'ops.steak@gtc-center.my.id',
            'antar.steak@gmail.com' => 'antar.steak@gtc-center.my.id',
            'kitchen.steak@gmail.com' => 'dapur.steak@gtc-center.my.id',
            'owner.durian@gmail.com' => 'owner.durian@gtc-center.my.id',
            'ops.durian@gmail.com' => 'ops.durian@gtc-center.my.id',
            'antar.durian@gmail.com' => 'antar.durian@gtc-center.my.id',
            'kitchen.durian@gmail.com' => 'dapur.durian@gtc-center.my.id',
            'owner.nasgor@gmail.com' => 'owner.nasgor@gtc-center.my.id',
            'ops.nasgor@gmail.com' => 'ops.nasgor@gtc-center.my.id',
            'antar.nasgor@gmail.com' => 'antar.nasgor@gtc-center.my.id',
            'kitchen.nasgor@gmail.com' => 'dapur.nasgor@gtc-center.my.id',
            'owner.buah@gmail.com' => 'owner.buah@gtc-center.my.id',
            'ops.buah@gmail.com' => 'ops.buah@gtc-center.my.id',
            'antar.buah@gmail.com' => 'antar.buah@gtc-center.my.id',
            'kitchen.buah@gmail.com' => 'dapur.buah@gtc-center.my.id',
        ];

        foreach ($emailMap as $oldEmail => $newEmail) {
            $legacyUser = User::query()->where('email', $oldEmail)->first();

            if (! $legacyUser) {
                continue;
            }

            if (User::query()->where('email', $newEmail)->exists()) {
                continue;
            }

            $legacyUser->update(['email' => $newEmail]);
        }
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
        $rows = collect(array_merge(
            $this->minumanMenuRows(),
            $this->mieMenuRows(),
            $this->durianMenuRows(),
            $this->ayamMenuRows(),
            $this->buahMenuRows(),
            $this->ramenMenuRows(),
            [
            ['barcode' => 'FC-STK-001', 'title' => 'Chicken Steak Crispy', 'description' => 'Steak ayam crispy lengkap dengan sayur.', 'category' => 'Makanan Berat', 'tenant_slug' => 'dapur-steak', 'station_slug' => 'steak', 'buy_price' => 22000, 'sell_price' => 36000, 'stock' => 42, 'modifier_options' => [['name' => 'Kentang wedges', 'price' => 8000], ['name' => 'Mushroom sauce', 'price' => 5000], ['name' => 'Cheese sauce', 'price' => 5000]]],
            ['barcode' => 'FC-STK-002', 'title' => 'Sirloin Steak', 'description' => 'Sirloin steak premium untuk simulasi high value order.', 'category' => 'Makanan Berat', 'tenant_slug' => 'dapur-steak', 'station_slug' => 'steak', 'buy_price' => 38000, 'sell_price' => 58000, 'stock' => 30, 'modifier_options' => [['name' => 'Extra beef slice', 'price' => 18000], ['name' => 'Mashed potato', 'price' => 9000], ['name' => 'Blackpepper sauce', 'price' => 5000]]],
            ['barcode' => 'FC-STK-003', 'title' => 'Beef Steak BBQ', 'description' => 'Beef steak dengan saus BBQ manis asap.', 'category' => 'Makanan Berat', 'tenant_slug' => 'dapur-steak', 'station_slug' => 'steak', 'buy_price' => 34000, 'sell_price' => 54000, 'stock' => 32, 'modifier_options' => [['name' => 'Onion ring', 'price' => 8000], ['name' => 'Cheese sauce', 'price' => 5000], ['name' => 'Sunny side egg', 'price' => 5000]]],
            ['barcode' => 'FC-STK-004', 'title' => 'Mix Grill Platter', 'description' => 'Paket grill combo untuk testing item premium.', 'category' => 'Makanan Berat', 'tenant_slug' => 'dapur-steak', 'station_slug' => 'steak', 'buy_price' => 42000, 'sell_price' => 68000, 'stock' => 26, 'modifier_options' => [['name' => 'Sosis bratwurst', 'price' => 12000], ['name' => 'Mashed potato', 'price' => 9000], ['name' => 'Extra sauce', 'price' => 4000]]],

            ['barcode' => 'FC-NSG-001', 'title' => 'Nasgor Biasa', 'description' => 'Nasi goreng klasik untuk testing dapur nasgor.', 'category' => 'Makanan Berat', 'tenant_slug' => 'dapur-nasgor', 'station_slug' => 'nasgor', 'buy_price' => 15000, 'sell_price' => 24000, 'stock' => 62, 'modifier_options' => [['name' => 'Telur dadar', 'price' => 5000], ['name' => 'Sosis', 'price' => 6000], ['name' => 'Keju', 'price' => 5000]]],
            ['barcode' => 'FC-NSG-002', 'title' => 'Nasgor Ayam', 'description' => 'Nasi goreng ayam gurih untuk simulasi add-on lauk.', 'category' => 'Makanan Berat', 'tenant_slug' => 'dapur-nasgor', 'station_slug' => 'nasgor', 'buy_price' => 17000, 'sell_price' => 28000, 'stock' => 58, 'modifier_options' => [['name' => 'Ayam crispy', 'price' => 10000], ['name' => 'Telur ceplok', 'price' => 5000], ['name' => 'Acar', 'price' => 2000]]],
            ['barcode' => 'FC-NSG-003', 'title' => 'Nasgor Spesial', 'description' => 'Nasi goreng spesial lengkap untuk skenario high-demand.', 'category' => 'Makanan Berat', 'tenant_slug' => 'dapur-nasgor', 'station_slug' => 'nasgor', 'buy_price' => 19000, 'sell_price' => 32000, 'stock' => 50, 'modifier_options' => [['name' => 'Bakso', 'price' => 6000], ['name' => 'Udang', 'price' => 9000], ['name' => 'Keju mozarella', 'price' => 7000]]],
            ['barcode' => 'FC-NSG-004', 'title' => 'Nasgor Seafood', 'description' => 'Nasi goreng seafood untuk testing item lintas topping.', 'category' => 'Makanan Berat', 'tenant_slug' => 'dapur-nasgor', 'station_slug' => 'nasgor', 'buy_price' => 21000, 'sell_price' => 35000, 'stock' => 46, 'modifier_options' => [['name' => 'Cumi extra', 'price' => 10000], ['name' => 'Telur dadar', 'price' => 5000], ['name' => 'Sambal roa', 'price' => 3000]]],

        ]));

        $this->purgeLegacyTenantDemoProducts(
            $tenantOutlets->get('dapur-minuman'),
            'FC-MIN-',
            $rows->where('tenant_slug', 'dapur-minuman')->pluck('barcode')->all()
        );
        $this->purgeLegacyTenantDemoProducts(
            $tenantOutlets->get('dapur-mie'),
            'FC-MIE-',
            $rows->where('tenant_slug', 'dapur-mie')->pluck('barcode')->all()
        );
        $this->purgeLegacyTenantDemoProducts(
            $tenantOutlets->get('dapur-durian'),
            'FC-DRN-',
            $rows->where('tenant_slug', 'dapur-durian')->pluck('barcode')->all()
        );
        $this->purgeLegacyTenantDemoProducts(
            $tenantOutlets->get('dapur-ayam'),
            'FC-AYM-',
            $rows->where('tenant_slug', 'dapur-ayam')->pluck('barcode')->all()
        );
        $this->purgeLegacyTenantDemoProducts(
            $tenantOutlets->get('dapur-buah'),
            'FC-BUH-',
            $rows->where('tenant_slug', 'dapur-buah')->pluck('barcode')->all()
        );
        $this->purgeLegacyTenantDemoProducts(
            $tenantOutlets->get('dapur-ramen'),
            'FC-RMN-',
            $rows->where('tenant_slug', 'dapur-ramen')->pluck('barcode')->all()
        );

        $categories = Category::query()
            ->whereIn('name', $rows->pluck('category')->unique()->values()->all())
            ->get()
            ->keyBy(fn (Category $category) => $this->seedCategoryLookupKey(
                $category->name,
                $category->tenant_outlet_id
            ));

        $products = $rows->values()->map(function (array $row, int $index) use ($categories, $tenantOutlets) {
            $tenant = $tenantOutlets->get($row['tenant_slug']);
            $category = $categories->get($this->seedCategoryLookupKey($row['category'], $tenant?->id))
                ?? $categories->get($this->seedCategoryLookupKey($row['category']));
            $buyPrice = (int) $row['buy_price'];
            $tenantHppPrice = in_array($row['tenant_slug'], ['dapur-minuman', 'dapur-mie', 'dapur-durian', 'dapur-ayam', 'dapur-buah', 'dapur-ramen'], true)
                ? $buyPrice
                : max(0, $buyPrice - 2000);
            $ownerMarkup = (int) ($row['owner_markup']
                ?? (isset($row['sell_price']) ? max(0, (int) $row['sell_price'] - $buyPrice) : ($index % 4 === 3 ? 3000 : 2000)));
            $sellPrice = $buyPrice + $ownerMarkup;
            $modifierOptions = collect($row['modifier_options'] ?? [])->values();

            $product = Product::query()->updateOrCreate(
                ['barcode' => $row['barcode']],
                [
                    'category_id' => $category?->id,
                    'image' => 'default.jpg',
                    'title' => $row['title'],
                    'description' => $row['description'],
                    'tenant_hpp_price' => $tenantHppPrice,
                    'buy_price' => $buyPrice,
                    'sell_price' => $sellPrice,
                    'tenant_outlet_id' => $tenant?->id,
                    'supports_modifiers' => $modifierOptions->isNotEmpty(),
                    'stock' => $row['stock'],
                ]
            );

            $product->modifierOptions()->delete();
            $product->modifierOptions()->createMany(
                $modifierOptions
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

    private function minumanSections(): array
    {
        return [
            [
                'group' => 'Coffee Latte',
                'items' => [
                    ['name' => 'Mouro Coffee (Ice)', 'buy' => 22000, 'owner_sell' => 25000],
                    ['name' => 'Mouro Butterscotch (Ice)', 'buy' => 22000, 'owner_sell' => 25000],
                    ['name' => 'Mouro Caramel Macchiato (Ice)', 'buy' => 21000, 'owner_sell' => 24000],
                    ['name' => 'Mouro Pistachio (Ice)', 'buy' => 22000, 'owner_sell' => 25000],
                    ['name' => 'Mouro Aren (Ice)', 'buy' => 18000, 'owner_sell' => 21000],
                    ['name' => 'Mouro Latte (Ice)', 'buy' => 18000, 'owner_sell' => 21000],
                    ['name' => 'Mouro Vanila (Ice)', 'buy' => 18000, 'owner_sell' => 21000],
                    ['name' => 'Mouro Hazelnut (Ice)', 'buy' => 19000, 'owner_sell' => 22000],
                    ['name' => 'Mouro Pandan (Ice)', 'buy' => 19000, 'owner_sell' => 22000],
                ],
            ],
            [
                'group' => 'Black Coffee',
                'items' => [
                    ['name' => 'Espresso', 'buy' => 7000, 'owner_sell' => 10000],
                    ['name' => 'Americano (Ice)', 'buy' => 12000, 'owner_sell' => 15000],
                    ['name' => 'Long Black (Ice)', 'buy' => 14000, 'owner_sell' => 17000],
                    ['name' => 'Tubruk (Hot)', 'buy' => 10000, 'owner_sell' => 13000],
                    ['name' => 'Vietnam Drip (Hot/Ice)', 'buy' => 14000, 'owner_sell' => 17000],
                    ['name' => 'Kopi Sanger (Hot)', 'buy' => 14000, 'owner_sell' => 17000],
                    ['name' => 'Coffee Latte (Hot)', 'buy' => 16000, 'owner_sell' => 19000],
                    ['name' => 'Affogato (Ice)', 'buy' => 18000, 'owner_sell' => 21000],
                ],
            ],
            [
                'group' => 'Frutycano',
                'items' => [
                    ['name' => 'Berrycano (Ice)', 'buy' => 18000, 'owner_sell' => 21000],
                    ['name' => 'Limepresso (Ice)', 'buy' => 18000, 'owner_sell' => 21000],
                    ['name' => 'Coconutblack (Ice)', 'buy' => 16000, 'owner_sell' => 19000],
                    ['name' => 'Triple Peach Americano (Ice)', 'buy' => 21000, 'owner_sell' => 24000],
                ],
            ],
            [
                'group' => 'Milk Factory',
                'items' => [
                    ['name' => 'Chocolate (Ice)', 'buy' => 17000, 'owner_sell' => 20000],
                    ['name' => 'Dark Choco (Ice)', 'buy' => 14000, 'owner_sell' => 17000],
                    ['name' => 'Oreo Creamy Latte (Ice)', 'buy' => 18000, 'owner_sell' => 21000],
                    ['name' => 'Milosaurus (Ice)', 'buy' => 18000, 'owner_sell' => 21000],
                    ['name' => 'Redvelvet (Ice)', 'buy' => 15000, 'owner_sell' => 18000],
                ],
            ],
            [
                'group' => 'Matcha Base',
                'items' => [
                    ['name' => 'Matcha Latte (Ice)', 'buy' => 16000, 'owner_sell' => 19000],
                    ['name' => 'Matcha Ice Cream (Ice)', 'buy' => 20000, 'owner_sell' => 23000],
                    ['name' => 'Matcha Cream Cheese (Ice)', 'buy' => 20000, 'owner_sell' => 23000],
                    ['name' => 'Strawbery Matcha (Ice)', 'buy' => 20000, 'owner_sell' => 23000],
                    ['name' => 'Matcha Pistacio (Ice)', 'buy' => 20000, 'owner_sell' => 23000],
                    ['name' => 'Coconut Matcha (Ice)', 'buy' => 20000, 'owner_sell' => 23000],
                ],
            ],
            [
                'group' => 'Other',
                'items' => [
                    ['name' => 'Es Teh (Hot/Ice)', 'buy' => 4000, 'owner_sell' => 6000],
                    ['name' => 'Es Jeruk (Hot/Ice)', 'buy' => 6000, 'owner_sell' => 8000],
                    ['name' => 'Lemon Tea (Hot/Ice)', 'buy' => 6000, 'owner_sell' => 8000],
                    ['name' => 'Green Tea (Ice)', 'buy' => 10000, 'owner_sell' => 12000],
                    ['name' => 'Pink Lava (Ice)', 'buy' => 10000, 'owner_sell' => 12000],
                    ['name' => 'Thai Tea (Ice)', 'buy' => 10000, 'owner_sell' => 12000],
                    ['name' => 'Melon Sparkling (Ice)', 'buy' => 10000, 'owner_sell' => 12000],
                    ['name' => 'Lemon Sparkling (Ice)', 'buy' => 10000, 'owner_sell' => 12000],
                    ['name' => 'Blue Sparkling (Ice)', 'buy' => 10000, 'owner_sell' => 12000],
                    ['name' => 'Air Mineral', 'buy' => 5000, 'owner_sell' => 6000],
                ],
            ],
            [
                'group' => 'Taro',
                'items' => [
                    ['name' => 'Taro Latte (Ice)', 'buy' => 15000, 'owner_sell' => 18000],
                    ['name' => 'Taro Cream Cheese (Ice)', 'buy' => 17000, 'owner_sell' => 20000],
                    ['name' => 'Taro Ice Cream (Ice)', 'buy' => 17000, 'owner_sell' => 20000],
                ],
            ],
            [
                'group' => 'Lava Toast',
                'items' => [
                    ['name' => 'Toast Milo', 'buy' => 17000, 'owner_sell' => 20000],
                    ['name' => 'Toast Oreo', 'buy' => 17000, 'owner_sell' => 20000],
                    ['name' => 'Toast Matcha', 'buy' => 17000, 'owner_sell' => 20000],
                    ['name' => 'Toast Cheese', 'buy' => 20000, 'owner_sell' => 23000],
                    ['name' => 'Toast Ice Cream', 'buy' => 20000, 'owner_sell' => 23000],
                ],
            ],
            [
                'group' => 'Tiramishu',
                'items' => [
                    ['name' => 'Original', 'buy' => 27000, 'owner_sell' => 30000],
                    ['name' => 'Strawbery', 'buy' => 30000, 'owner_sell' => 33000],
                ],
            ],
            [
                'group' => 'Darkcoco',
                'items' => [
                    ['name' => 'LAVA', 'buy' => 22000, 'owner_sell' => 25000],
                ],
            ],
        ];
    }

    private function mieSections(): array
    {
        return [
            [
                'group' => 'Mie V. Manis',
                'items' => [
                    ['name' => 'Mie Level V.Manis Lv 1', 'buy' => 11000],
                    ['name' => 'Mie Level V.Manis Lv 2', 'buy' => 11000],
                    ['name' => 'Mie Level V.Manis Lv 3', 'buy' => 11000],
                    ['name' => 'Mie Level V.Manis Lv 4', 'buy' => 11000],
                    ['name' => 'Mie Level V.Manis Lv 5', 'buy' => 12000],
                    ['name' => 'Mie Level V.Manis Lv 6', 'buy' => 12000],
                    ['name' => 'Mie Level V.Manis Lv 7', 'buy' => 12000],
                    ['name' => 'Mie Level V.Manis Lv 8', 'buy' => 12000],
                ],
            ],
            [
                'group' => 'Mie V. Asin',
                'items' => [
                    ['name' => 'Mie Level V.Asin Lv 1', 'buy' => 11000],
                    ['name' => 'Mie Level V.Asin Lv 2', 'buy' => 11000],
                    ['name' => 'Mie Level V.Asin Lv 3', 'buy' => 11000],
                    ['name' => 'Mie Level V.Asin Lv 4', 'buy' => 11000],
                    ['name' => 'Mie Level V.Asin Lv 5', 'buy' => 12000],
                    ['name' => 'Mie Level V.Asin Lv 6', 'buy' => 12000],
                    ['name' => 'Mie Level V.Asin Lv 7', 'buy' => 12000],
                    ['name' => 'Mie Level V.Asin Lv 8', 'buy' => 12000],
                ],
            ],
            [
                'group' => 'Dimsum',
                'items' => [
                    ['name' => 'Udang Keju', 'buy' => 10000],
                    ['name' => 'Udang Rambutan', 'buy' => 10000],
                    ['name' => 'Lumpia Udang', 'buy' => 10000],
                    ['name' => 'Siomay', 'buy' => 10000],
                ],
            ],
            [
                'group' => 'Nasi Daun Jeruk',
                'items' => [
                    ['name' => 'Nasi Daun Jeruk Ayam Kriuk Sambal Matah', 'buy' => 20000],
                    ['name' => 'Nasi Daun Jeruk Ayam Kriuk Sambal Geprek', 'buy' => 20000],
                    ['name' => 'Nasi Daun Jeruk Kulit Crispy Sambal Matah', 'buy' => 20000],
                    ['name' => 'Nasi Daun Jeruk Kulit Crispy Sambal Geprek', 'buy' => 20000],
                ],
            ],
            [
                'group' => 'Spaghetti',
                'items' => [
                    ['name' => 'Spaghetti Bolognese', 'buy' => 22000],
                    ['name' => 'Spaghetti Carbonara', 'buy' => 22000],
                ],
            ],
            [
                'group' => 'Snack',
                'items' => [
                    ['name' => 'Croffle', 'buy' => 13000],
                    ['name' => 'Risol', 'buy' => 10000],
                    ['name' => 'Cireng', 'buy' => 10000],
                    ['name' => 'Singkong Keju', 'buy' => 10000],
                ],
            ],
        ];
    }

    private function durianSections(): array
    {
        return [
            [
                'group' => 'Minuman',
                'items' => [
                    ['name' => 'Durian Kocok', 'buy' => 13000],
                    ['name' => 'Alpokat Kocok', 'buy' => 13000],
                    ['name' => 'Durian / Mix Alpokat', 'buy' => 15000],
                    ['name' => 'Jus Alpokat', 'buy' => 13000],
                    ['name' => 'Jus Apel', 'buy' => 13000],
                    ['name' => 'Jus Anggur', 'buy' => 13000],
                    ['name' => 'Jus Strawberry', 'buy' => 13000],
                    ['name' => 'Jus Nanas', 'buy' => 12000],
                    ['name' => 'Jus B. Naga', 'buy' => 12000],
                    ['name' => 'Jus Mangga', 'buy' => 12000],
                    ['name' => 'Jus Sirsak', 'buy' => 12000],
                    ['name' => 'Jus Melon', 'buy' => 10000],
                    ['name' => 'Jus Semangka', 'buy' => 10000],
                    ['name' => 'Jus Tomat', 'buy' => 10000],
                    ['name' => 'Jus Kiwi', 'buy' => 13000],
                    ['name' => 'Jus Jambu', 'buy' => 12000],
                    ['name' => 'Jus Jeruk', 'buy' => 12000],
                    ['name' => 'Jus Wortel', 'buy' => 12000],
                    ['name' => 'Es Dawet', 'buy' => 12000],
                    ['name' => 'Es Dawet Durian', 'buy' => 15000],
                ],
            ],
            [
                'group' => 'Pempek / Cemilan',
                'items' => [
                    ['name' => 'Pempek Palembang', 'buy' => 16000],
                    ['name' => 'Mix Platter', 'buy' => 15000],
                    ['name' => 'Kentang Goreng', 'buy' => 12000],
                    ['name' => 'Bakso Goreng', 'buy' => 10000],
                    ['name' => 'Cilok Krispi (Ayam Suwir)', 'buy' => 10000],
                    ['name' => 'Mendoan', 'buy' => 10000],
                    ['name' => 'Nuget', 'buy' => 12000],
                    ['name' => 'Sosis', 'buy' => 12000],
                    ['name' => 'Tahu Bakso', 'buy' => 12000],
                    ['name' => 'Sempolan', 'buy' => 10000],
                    ['name' => 'Siomay Goreng', 'buy' => 12000],
                ],
            ],
        ];
    }

    private function ayamSections(): array
    {
        return [
            [
                'group' => 'Harga Ayam Pejantan',
                'items' => [
                    ['name' => 'Ayam Kremes', 'buy' => 30000],
                    ['name' => 'Ayam Bumbu Rempah', 'buy' => 31000],
                    ['name' => 'Ayam Goreng Telur', 'buy' => 31000],
                    ['name' => 'Ayam Bakar', 'buy' => 30000],
                ],
            ],
            [
                'group' => 'Paket Hemat',
                'items' => [
                    ['name' => 'Ayam Kremes', 'buy' => 15000],
                    ['name' => 'Ayam Bakar', 'buy' => 15000],
                ],
            ],
            [
                'group' => 'Menu Lainnya',
                'items' => [
                    ['name' => 'Seblak Sultan', 'buy' => 18000],
                    ['name' => 'Roti Bakar Coklat', 'buy' => 15000],
                    ['name' => 'Roti Bakar Keju', 'buy' => 15000],
                    ['name' => 'Roti Bakar Coklat Keju', 'buy' => 16000],
                ],
            ],
        ];
    }

    private function buahSections(): array
    {
        return [
            [
                'group' => 'Es Teller',
                'items' => [
                    ['name' => 'Es Teller Original', 'buy' => 12000],
                    ['name' => 'Es Teller Keju', 'buy' => 13000],
                    ['name' => 'Es Teller Durian', 'buy' => 15000],
                    ['name' => 'Es Teller Ice Cream', 'buy' => 14000],
                    ['name' => 'Es Pisang Ijo', 'buy' => 12000],
                    ['name' => 'Es Pisang Ijo Durian', 'buy' => 15000],
                ],
            ],
            [
                'group' => 'Smoothie Bowl',
                'items' => [
                    ['name' => 'Tropical Island', 'buy' => 14000],
                    ['name' => 'Golden Mango', 'buy' => 14000],
                    ['name' => 'Tropical Twist', 'buy' => 14000],
                    ['name' => 'Banana Fudge', 'buy' => 15000],
                    ['name' => 'Berry Booster', 'buy' => 15000],
                    ['name' => 'Tropical Green', 'buy' => 14000],
                    ['name' => 'Pina Colada', 'buy' => 14000],
                    ['name' => 'Tropical Mango', 'buy' => 14000],
                    ['name' => 'Golden Berry Bliss', 'buy' => 15000],
                ],
            ],
            [
                'group' => 'Dessert',
                'items' => [
                    ['name' => 'Dubai Tray', 'buy' => 15000],
                    ['name' => 'Strawberry Choco Kunafa', 'buy' => 15000],
                ],
            ],
        ];
    }

    private function ramenSections(): array
    {
        return [
            [
                'group' => 'Menu Donburi',
                'items' => [
                    [
                        'name' => 'BEEF TERIYAKIDON',
                        'buy' => 33000,
                        'description' => 'Nasi daging sapi dengan saus teriyaki, dicampur daun bawang dan telur di atasnya.',
                    ],
                    [
                        'name' => 'CHICKEN KATSUDON',
                        'buy' => 31000,
                        'description' => 'Nasi dengan potongan daging ayam tepung saus gurih, dicampur daun bawang dan telur di atasnya.',
                    ],
                    [
                        'name' => 'CHICKEN KATSU CURRYDON',
                        'buy' => 31000,
                        'description' => 'Nasi chicken katsu yang disiram dengan bumbu kari dan disajikan dengan nasi dan sayuran.',
                    ],
                ],
            ],
            [
                'group' => 'Menu Ramen',
                'items' => [
                    ['name' => 'BEEF TERIYAKI RAMEN', 'buy' => 29000, 'description' => 'Ramen dengan kuah pilihan, beef, telur, jagung, jamur, nori, dan daun bawang.'],
                    ['name' => 'SPICY CHICKEN WINGS RAMEN', 'buy' => 28000, 'description' => 'Ramen dengan kuah pilihan, spicy wings, telur, jagung, jamur, nori, dan daun bawang.'],
                    ['name' => 'CHICKEN KATSU RAMEN', 'buy' => 27000, 'description' => 'Ramen dengan kuah pilihan, chicken katsu, telur, jagung, jamur, nori, dan daun bawang.'],
                    ['name' => 'CHICKEN KARAAGE RAMEN', 'buy' => 27000, 'description' => 'Ramen dengan kuah pilihan, chicken karaage, telur, jagung, jamur, nori, dan daun bawang.'],
                    ['name' => 'TOPPOKI RAMEN', 'buy' => 27000, 'description' => 'Ramen dengan kuah pilihan, toppoki, telur, jagung, jamur, nori, dan daun bawang.'],
                    ['name' => 'EBI FURAI RAMEN', 'buy' => 27000, 'description' => 'Ramen dengan kuah pilihan, ebi furai, telur, jagung, jamur, nori, dan daun bawang.'],
                    ['name' => 'CHICKEN NANBAN RAMEN', 'buy' => 29000, 'description' => 'Ramen dengan kuah pilihan, chicken nanban, telur, jagung, jamur, nori, dan daun bawang.'],
                    ['name' => 'CHICKEN NASHVILLE RAMEN', 'buy' => 28000, 'description' => 'Ramen dengan kuah pilihan, chicken nashville, telur, jagung, jamur, nori, dan daun bawang.'],
                    ['name' => 'CHICKEN YAKITORI RAMEN', 'buy' => 31000, 'description' => 'Ramen dengan kuah pilihan, chicken yakitori, telur, jagung, jamur, nori, dan daun bawang.'],
                    ['name' => 'PREMIUM SAIKORO RAMEN', 'buy' => 46000, 'description' => 'Ramen dengan kuah pilihan, beef saikoro, telur, jagung, jamur, nori, dan daun bawang.'],
                    ['name' => 'PREMIUM WAGYU RAMEN', 'buy' => 49000, 'description' => 'Ramen dengan kuah pilihan, premium wagyu, telur, jagung, jamur, nori, dan daun bawang.'],
                ],
            ],
            [
                'group' => 'Nasi Salad',
                'items' => [
                    [
                        'name' => 'NASI SALAD',
                        'buy' => 27000,
                        'description' => 'Nasi salad start 27K dengan pilihan topping, saus, tingkat pedas, dan varian karbohidrat.',
                    ],
                ],
            ],
            [
                'group' => 'Japanese Bento',
                'items' => [
                    [
                        'name' => 'BEEF TERIYAKI BENTO',
                        'buy' => 39000,
                        'description' => 'Paket nasi bekal ala Jepang. Nasi, beef teriyaki, pilihan topping, saus, dan salad.',
                    ],
                    [
                        'name' => 'CHICKEN KATSU BENTO',
                        'buy' => 37000,
                        'description' => 'Paket nasi bekal ala Jepang. Nasi, chicken katsu, pilihan topping, saus, dan salad.',
                    ],
                    [
                        'name' => 'HAPPY NIKU BENTO',
                        'buy' => 43000,
                        'description' => 'Paket nasi bekal ala Jepang. Nasi, beef teriyaki, pilihan topping, dan mix platter.',
                    ],
                    [
                        'name' => 'HAPPY KAWAII BENTO',
                        'buy' => 39000,
                        'description' => 'Paket nasi bekal ala Jepang. Nasi, chicken katsu, pilihan topping, dan mix platter.',
                    ],
                ],
            ],
            [
                'group' => 'Rempah Nusantara',
                'items' => [
                    ['name' => 'Wedang Uwuh', 'buy' => 15000, 'description' => 'Jahe, kayu secang, cengkeh, kayu manis, daun pala, serai, dan gula batu.'],
                    ['name' => 'Jahe Susu', 'buy' => 15000, 'description' => 'Jahe pilihan, susu creamy, gula atau susu kental manis, dan rempah hangat pilihan.'],
                    ['name' => 'Sari Jahe', 'buy' => 15000, 'description' => 'Jahe pilihan, gula alami, dan rempah tradisional.'],
                    ['name' => 'Sari Jahe - Sugar Free', 'buy' => 15000, 'description' => 'Jahe pilihan, rempah alami, tanpa gula tambahan.'],
                    ['name' => 'Jahe Kencur Jeruk', 'buy' => 15000, 'description' => 'Jahe, kencur, jeruk, gula atau madu.'],
                    ['name' => 'Beras Kencur', 'buy' => 15000, 'description' => 'Beras, kencur, jahe, gula alami, dan rempah pilihan.'],
                    ['name' => 'Temulawak', 'buy' => 15000, 'description' => 'Temulawak, jahe, gula batu atau gula aren, serai, dan air.'],
                    ['name' => 'Temulawak - Sugar Free', 'buy' => 15000, 'description' => 'Temulawak, jahe, serai, sugar free, dan rempah.'],
                    ['name' => 'Kunyit Asam', 'buy' => 15000, 'description' => 'Kunyit, asam jawa, gula aren atau gula batu, dan air.'],
                    ['name' => 'Kunyit Asam Sirih Madu', 'buy' => 15000, 'description' => 'Kunyit, asam jawa, daun sirih, madu, dan gula.'],
                    ['name' => 'Galian Putri', 'buy' => 15000, 'description' => 'Kunyit, asam jawa, sirih, temu ireng, kayu manis, madu, dan rempah pilihan.'],
                    ['name' => 'STMJ', 'buy' => 15000, 'description' => 'Susu, telur, madu, jahe, gula alami, dan rempah pilihan.'],
                    ['name' => 'Genmaicha', 'buy' => 15000, 'description' => 'Rempah pilihan dan tanaman herbal khas Jepang.'],
                ],
            ],
        ];
    }

    private function minumanMenuRows(): array
    {
        $rows = [];
        $counter = 1;

        foreach ($this->minumanSections() as $section) {
            foreach ($section['items'] as $item) {
                $rows[] = [
                    'barcode' => sprintf('FC-MIN-%03d', $counter),
                    'title' => $item['name'],
                    'description' => sprintf(
                        'Menu %s untuk tenant minuman foodcourt demo.',
                        $section['group']
                    ),
                    'category' => $section['group'],
                    'tenant_slug' => 'dapur-minuman',
                    'station_slug' => 'minuman',
                    'buy_price' => $item['buy'],
                    'owner_markup' => max(0, $item['owner_sell'] - $item['buy']),
                    'stock' => max(24, 96 - ($counter % 6) * 7),
                    'modifier_options' => [],
                ];

                $counter++;
            }
        }

        return $rows;
    }

    private function mieMenuRows(): array
    {
        $rows = [];
        $counter = 1;

        foreach ($this->mieSections() as $section) {
            foreach ($section['items'] as $item) {
                $rows[] = [
                    'barcode' => sprintf('FC-MIE-%03d', $counter),
                    'title' => $item['name'],
                    'description' => sprintf(
                        'Menu %s untuk tenant mie foodcourt demo.',
                        $section['group']
                    ),
                    'category' => $section['group'],
                    'tenant_slug' => 'dapur-mie',
                    'station_slug' => 'mie',
                    'buy_price' => $item['buy'],
                    'owner_markup' => 3000,
                    'stock' => max(24, 92 - ($counter % 6) * 6),
                    'modifier_options' => [],
                ];

                $counter++;
            }
        }

        return $rows;
    }

    private function durianMenuRows(): array
    {
        $rows = [];
        $counter = 1;

        foreach ($this->durianSections() as $section) {
            foreach ($section['items'] as $item) {
                $rows[] = [
                    'barcode' => sprintf('FC-DRN-%03d', $counter),
                    'title' => $item['name'],
                    'description' => sprintf(
                        'Menu %s untuk tenant durian foodcourt demo.',
                        $section['group']
                    ),
                    'category' => $section['group'],
                    'tenant_slug' => 'dapur-durian',
                    'station_slug' => 'durian',
                    'buy_price' => $item['buy'],
                    'owner_markup' => 3000,
                    'stock' => max(24, 90 - ($counter % 6) * 6),
                    'modifier_options' => [],
                ];

                $counter++;
            }
        }

        return $rows;
    }

    private function ayamMenuRows(): array
    {
        $rows = [];
        $counter = 1;

        foreach ($this->ayamSections() as $section) {
            foreach ($section['items'] as $item) {
                $rows[] = [
                    'barcode' => sprintf('FC-AYM-%03d', $counter),
                    'title' => $item['name'],
                    'description' => sprintf(
                        'Menu %s untuk tenant ayam foodcourt demo.',
                        $section['group']
                    ),
                    'category' => $section['group'],
                    'tenant_slug' => 'dapur-ayam',
                    'station_slug' => 'ayam',
                    'buy_price' => $item['buy'],
                    'owner_markup' => 3000,
                    'stock' => max(24, 88 - ($counter % 6) * 6),
                    'modifier_options' => [],
                ];

                $counter++;
            }
        }

        return $rows;
    }

    private function buahMenuRows(): array
    {
        $rows = [];
        $counter = 1;

        foreach ($this->buahSections() as $section) {
            foreach ($section['items'] as $item) {
                $rows[] = [
                    'barcode' => sprintf('FC-BUH-%03d', $counter),
                    'title' => $item['name'],
                    'description' => sprintf(
                        'Menu %s untuk tenant buah foodcourt demo.',
                        $section['group']
                    ),
                    'category' => $section['group'],
                    'tenant_slug' => 'dapur-buah',
                    'station_slug' => 'buah',
                    'buy_price' => $item['buy'],
                    'owner_markup' => 3000,
                    'stock' => max(24, 86 - ($counter % 6) * 6),
                    'modifier_options' => [],
                ];

                $counter++;
            }
        }

        return $rows;
    }

    private function ramenMenuRows(): array
    {
        $rows = [];
        $counter = 1;

        foreach ($this->ramenSections() as $section) {
            foreach ($section['items'] as $item) {
                $rows[] = [
                    'barcode' => sprintf('FC-RMN-%03d', $counter),
                    'title' => $item['name'],
                    'description' => $item['description'] ?? sprintf(
                        'Menu %s untuk tenant ramen foodcourt demo.',
                        $section['group']
                    ),
                    'category' => $section['group'],
                    'tenant_slug' => 'dapur-ramen',
                    'station_slug' => 'ramen',
                    'buy_price' => $item['buy'],
                    'owner_markup' => 3000,
                    'stock' => max(20, 84 - ($counter % 6) * 5),
                    'modifier_options' => match ($section['group']) {
                        'Menu Ramen' => $this->ramenMainModifierOptions(),
                        'Nasi Salad' => $this->ramenNasiSaladModifierOptions(),
                        'Japanese Bento' => $this->ramenBentoModifierOptions(),
                        default => [],
                    },
                ];

                $counter++;
            }
        }

        return $rows;
    }

    private function purgeLegacyTenantDemoProducts(?Outlet $tenantOutlet, string $barcodePrefix, array $activeBarcodes): void
    {
        if (! $tenantOutlet) {
            return;
        }

        Product::query()
            ->where('tenant_outlet_id', $tenantOutlet->id)
            ->where('barcode', 'like', $barcodePrefix.'%')
            ->whereNotIn('barcode', $activeBarcodes)
            ->get()
            ->each(function (Product $product) {
                $product->modifierOptions()->delete();
                $product->kitchenStationMappings()->delete();
                $product->outletStocks()->delete();
                $product->delete();
            });

        Category::query()
            ->where('tenant_outlet_id', $tenantOutlet->id)
            ->whereNotIn('name', $this->tenantSectionNamesForSlug($tenantOutlet->slug))
            ->doesntHave('products')
            ->delete();
    }

    private function seedCategoryLookupKey(string $name, ?int $tenantOutletId = null): string
    {
        return sprintf('%s:%s', $tenantOutletId ?: 'global', Str::lower($name));
    }

    private function tenantSectionNamesForSlug(string $tenantSlug): array
    {
        return match ($tenantSlug) {
            'dapur-minuman' => collect($this->minumanSections())->pluck('group')->all(),
            'dapur-mie' => collect($this->mieSections())->pluck('group')->all(),
            'dapur-durian' => collect($this->durianSections())->pluck('group')->all(),
            'dapur-ayam' => collect($this->ayamSections())->pluck('group')->all(),
            'dapur-buah' => collect($this->buahSections())->pluck('group')->all(),
            'dapur-ramen' => collect($this->ramenSections())->pluck('group')->all(),
            default => [],
        };
    }

    private function ramenMainModifierOptions(): array
    {
        return [
            ['name' => 'Kuah: Shoyu Ramen', 'price' => 0],
            ['name' => 'Kuah Premium: Spicy Laksa', 'price' => 4000],
            ['name' => 'Kuah Premium: Cheese Ramen', 'price' => 4000],
            ['name' => 'Kuah Premium: Tantanmen Ramen', 'price' => 4000],
            ['name' => 'Kuah Premium: Curry Ramen', 'price' => 4000],
            ['name' => 'Kuah Premium: Tomyam Ramen', 'price' => 4000],
            ['name' => 'Kuah Premium: Keke Dhashi Ramen', 'price' => 4000],
            ['name' => 'Kuah Premium: Tori Paitan Ramen', 'price' => 4000],
            ['name' => 'Kuah Premium: Dry Tantanmen', 'price' => 4000],
            ['name' => 'Kuah Spesial: Cheese Mozarela', 'price' => 8000],
            ['name' => 'Kuah Spesial: Hot Chicken Mala', 'price' => 8000],
            ['name' => 'Kuah Spesial: Spicy Bulgogi', 'price' => 8000],
            ['name' => 'Kuah Signature: Lodeh Ramen', 'price' => 10000],
            ['name' => 'Kuah Signature: Rendang Ramen', 'price' => 10000],
            ['name' => 'Kuah Signature: Sakura Creamy Dashi', 'price' => 10000],
            ['name' => 'Kuah Signature: Thick Spicy Ramen', 'price' => 10000],
            ['name' => 'Mie: Reguler', 'price' => 0],
            ['name' => 'Mie: Nasi', 'price' => 0],
            ['name' => 'Mie: Udon', 'price' => 8000],
            ['name' => 'Topping: Odeng (1pc)', 'price' => 12000],
            ['name' => 'Topping: Odeng Crispy (1pc)', 'price' => 12000],
            ['name' => 'Topping: Gyoza (3pcs)', 'price' => 17000],
            ['name' => 'Topping: Tempura Gyoza (3pcs)', 'price' => 17000],
            ['name' => 'Topping: Crispy Enoki (3pcs)', 'price' => 12000],
            ['name' => 'Topping: Tempura Tamago (1pc)', 'price' => 10000],
            ['name' => 'Topping: Toppoki (10pcs)', 'price' => 15000],
            ['name' => 'Topping: Tempura Toppoki (10pcs)', 'price' => 15000],
            ['name' => 'Topping: Tempura Nori (2pcs)', 'price' => 12000],
            ['name' => 'Topping: Sosis Bakar/Goreng (3pcs)', 'price' => 12000],
        ];
    }

    private function ramenNasiSaladModifierOptions(): array
    {
        return [
            ['name' => 'Topping: Chicken Nashville', 'price' => 0],
            ['name' => 'Topping: Chicken Katsu', 'price' => 0],
            ['name' => 'Topping: Chicken Karaage', 'price' => 0],
            ['name' => 'Topping: Chicken Wings', 'price' => 0],
            ['name' => 'Topping: Ebi Furai', 'price' => 0],
            ['name' => 'Topping: Beef Teriyaki', 'price' => 4000],
            ['name' => 'Saus: Curry', 'price' => 0],
            ['name' => 'Saus: Mentega', 'price' => 0],
            ['name' => 'Saus: Bulgogi', 'price' => 0],
            ['name' => 'Saus: Gochujang', 'price' => 0],
            ['name' => 'Saus: Samyang', 'price' => 0],
            ['name' => 'Saus: Keju', 'price' => 0],
            ['name' => 'Masak: Bakar', 'price' => 0],
            ['name' => 'Masak: Tidak Bakar', 'price' => 0],
            ['name' => 'Level: Pedas', 'price' => 0],
            ['name' => 'Level: Tidak Pedas', 'price' => 0],
            ['name' => 'Karbohidrat: Nasi Daun Jeruk', 'price' => 2000],
            ['name' => 'Karbohidrat: Savory Rice', 'price' => 2000],
            ['name' => 'Karbohidrat: Hainan Rice', 'price' => 2000],
            ['name' => 'Karbohidrat: Spicy Shiokara Rice', 'price' => 2000],
            ['name' => 'Karbohidrat: Spicy Shatoru Rice', 'price' => 2000],
            ['name' => 'Karbohidrat: Nasi Putih', 'price' => 0],
            ['name' => 'Karbohidrat: Kentang Goreng', 'price' => 0],
            ['name' => 'Karbohidrat: Spaghetti Bolognese', 'price' => 0],
            ['name' => 'Tambahan: Telur Mata Sapi', 'price' => 5000],
            ['name' => 'Tambahan: Tamago Furai', 'price' => 7000],
            ['name' => 'Tambahan: Scramble Egg', 'price' => 5000],
            ['name' => 'Tambahan: Crispy Enoki', 'price' => 5000],
            ['name' => 'Tambahan: Kentang Goreng', 'price' => 10000],
        ];
    }

    private function ramenBentoModifierOptions(): array
    {
        return [
            ['name' => 'Topping: Spicy Chicken Wings', 'price' => 0],
            ['name' => 'Topping: Chicken Karaage', 'price' => 0],
            ['name' => 'Topping: Gyoza', 'price' => 0],
            ['name' => 'Topping: Ebi Furai', 'price' => 0],
            ['name' => 'Topping: Kentang Goreng', 'price' => 2000],
            ['name' => 'Topping: Tempura Egg', 'price' => 2000],
            ['name' => 'Topping: Chicken Nanban', 'price' => 3000],
        ];
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

        $waiter = $users->get('waiter.outlet@gmail.com');

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
                'table_id' => $diningTables->get('003')?->id,
                'waiter_id' => $waiter?->id,
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

        $retailCashier = $cashier;
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
                'table_id' => $diningTables->get('001')?->id,
                'waiter_id' => $waiter?->id,
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
