<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Customer;
use App\Models\CustomerOutletMetric;
use App\Models\KitchenStation;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\ProductKitchenStationMapping;
use App\Models\ProductOutletStock;
use App\Models\User;
use App\Services\AuditLogService;
use App\Services\CustomerOutletMetricService;
use App\Services\LoyaltyService;
use App\Services\OutletResolver;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DataRepairController extends Controller
{
    public function __construct(
        private readonly OutletResolver $outletResolver,
        private readonly AuditLogService $auditLogService,
        private readonly CustomerOutletMetricService $customerOutletMetricService,
        private readonly LoyaltyService $loyaltyService
    ) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $activeOutlet = $this->outletResolver->resolve($request, $user);
        $mainOutlets = $this->accessibleMainOutlets($user)->get(['outlets.id', 'outlets.name', 'outlets.code']);
        $targetMainOutlet = $this->resolveTargetMainOutlet($request, $user, $activeOutlet, $mainOutlets);

        abort_if(! $targetMainOutlet, 403, 'Outlet utama target tidak ditemukan.');

        $tenantChildren = Outlet::query()
            ->active()
            ->where('outlet_type', 'tenant')
            ->where('parent_outlet_id', $targetMainOutlet->id)
            ->ordered()
            ->get(['id', 'name', 'code', 'parent_outlet_id']);

        $tenantIds = $tenantChildren->pluck('id')->map(fn ($id) => (int) $id)->values();
        $scopedOutletIds = collect([(int) $targetMainOutlet->id])
            ->merge($tenantIds)
            ->unique()
            ->values();
        $tenantProducts = Product::query()
            ->with([
                'category:id,name,description,image,tenant_outlet_id',
                'outletStocks:id,outlet_id,product_id,stock',
                'kitchenStationMappings' => fn ($query) => $query
                ->where('is_active', true)
                ->select(['id', 'product_id', 'kitchen_station_id', 'is_active']),
            ])
            ->whereIn('tenant_outlet_id', $tenantIds->all())
            ->get(['id', 'title', 'stock', 'tenant_outlet_id']);

        $activeOutletIds = Outlet::query()
            ->active()
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values();

        $stockMismatchCount = $tenantProducts
            ->filter(function (Product $product) use ($activeOutletIds) {
                $productStock = (int) $product->stock;
                $stockMap = $product->outletStocks
                    ->mapWithKeys(fn (ProductOutletStock $stock) => [(int) $stock->outlet_id => (int) $stock->stock]);

                if ($stockMap->count() !== $activeOutletIds->count()) {
                    return true;
                }

                return $activeOutletIds->contains(
                    fn (int $outletId) => ! $stockMap->has($outletId) || (int) $stockMap->get($outletId) !== $productStock
                );
            })
            ->count();

        $orphanTenantCount = $this->accessibleTenantOutlets($user)
            ->whereNull('parent_outlet_id')
            ->count();

        $tenantProductsWithoutStationCount = $tenantProducts
            ->filter(fn (Product $product) => $product->kitchenStationMappings->isEmpty())
            ->count();

        $tenantCategoryMismatchCount = $tenantProducts
            ->filter(function (Product $product) {
                $tenantOutletId = (int) ($product->tenant_outlet_id ?? 0);
                $categoryTenantOutletId = (int) ($product->category?->tenant_outlet_id ?? 0);

                return ! $product->category || $categoryTenantOutletId !== $tenantOutletId;
            })
            ->count();

        $tenantStationsCount = KitchenStation::query()
            ->where('is_active', true)
            ->whereIn('outlet_id', $tenantIds->all())
            ->count();

        $memberMetricsScopeCount = DB::table('transactions')
            ->whereIn('outlet_id', $scopedOutletIds->all())
            ->whereNotNull('customer_id')
            ->distinct('customer_id')
            ->count('customer_id');

        $orphanAudit = [
            [
                'label' => 'Produk tenant tanpa kategori cocok',
                'count' => (int) $tenantCategoryMismatchCount,
                'helper' => 'Produk tenant yang kategorinya kosong, global, atau milik tenant lain.',
            ],
            [
                'label' => 'Kategori tenant tanpa outlet valid',
                'count' => (int) Category::query()
                    ->whereNotNull('tenant_outlet_id')
                    ->whereHas('tenantOutlet', fn (Builder $query) => $query->where('outlet_type', '!=', 'tenant'))
                    ->count(),
                'helper' => 'Kategori yang menunjuk outlet non-tenant.',
            ],
            [
                'label' => 'Station tenant tanpa parent outlet',
                'count' => (int) KitchenStation::query()
                    ->whereIn('outlet_id', $this->accessibleTenantOutlets($user)->whereNull('parent_outlet_id')->pluck('id')->all())
                    ->count(),
                'helper' => 'Station dapur yang masih berada di tenant orphan.',
            ],
            [
                'label' => 'Metrik customer di scope outlet',
                'count' => (int) $memberMetricsScopeCount,
                'helper' => 'Customer unik yang punya transaksi pada outlet utama target atau tenant anaknya.',
            ],
        ];

        return Inertia::render('Dashboard/Settings/DataRepair', [
            'target' => [
                'active_outlet' => $activeOutlet ? [
                    'id' => $activeOutlet->id,
                    'name' => $activeOutlet->name,
                    'code' => $activeOutlet->code,
                    'outlet_type' => $activeOutlet->outlet_type,
                    'parent_outlet_id' => $activeOutlet->parent_outlet_id,
                ] : null,
                'main_outlet_id' => $targetMainOutlet->id,
                'main_outlet' => [
                    'id' => $targetMainOutlet->id,
                    'name' => $targetMainOutlet->name,
                    'code' => $targetMainOutlet->code,
                ],
                'main_outlets' => $mainOutlets->values(),
            ],
            'summary' => [
                'orphan_tenants_count' => (int) $orphanTenantCount,
                'tenant_children_count' => (int) $tenantChildren->count(),
                'tenant_products_count' => (int) $tenantProducts->count(),
                'tenant_products_without_station_count' => (int) $tenantProductsWithoutStationCount,
                'tenant_stations_count' => (int) $tenantStationsCount,
                'stock_mismatch_count' => (int) $stockMismatchCount,
                'tenant_category_mismatch_count' => (int) $tenantCategoryMismatchCount,
                'member_metrics_scope_count' => (int) $memberMetricsScopeCount,
            ],
            'tenantsPreview' => $tenantChildren->map(fn (Outlet $outlet) => [
                'id' => $outlet->id,
                'name' => $outlet->name,
                'code' => $outlet->code,
                'parent_outlet_id' => $outlet->parent_outlet_id,
            ])->values(),
            'orphanAudit' => $orphanAudit,
        ]);
    }

    public function syncTenantParents(Request $request): RedirectResponse
    {
        $user = $request->user();
        $activeOutlet = $this->outletResolver->resolve($request, $user);
        $mainOutlets = $this->accessibleMainOutlets($user)->get(['outlets.id', 'outlets.name', 'outlets.code']);
        $targetMainOutlet = $this->resolveTargetMainOutlet($request, $user, $activeOutlet, $mainOutlets, strict: true);

        abort_if(! $targetMainOutlet, 403, 'Outlet utama target tidak ditemukan.');

        $updated = $this->accessibleTenantOutlets($user)
            ->whereNull('parent_outlet_id')
            ->update([
                'parent_outlet_id' => $targetMainOutlet->id,
                'updated_at' => now(),
            ]);

        $this->auditLogService->log(
            event: 'data-repair.tenant-parents.synced',
            module: 'data_repair',
            auditable: ['target_label' => 'Tenant Parent Sync'],
            description: 'Parent outlet tenant diperbaiki melalui halaman repair.',
            after: [
                'main_outlet_id' => $targetMainOutlet->id,
                'main_outlet_code' => $targetMainOutlet->code,
                'updated_tenants_count' => (int) $updated,
            ]
        );

        return back()->with('success', "{$updated} tenant orphan berhasil dipetakan ke outlet utama {$targetMainOutlet->code}.");
    }

    public function syncUnifiedStocks(Request $request): RedirectResponse
    {
        $user = $request->user();
        $activeOutlet = $this->outletResolver->resolve($request, $user);
        $mainOutlets = $this->accessibleMainOutlets($user)->get(['outlets.id', 'outlets.name', 'outlets.code']);
        $targetMainOutlet = $this->resolveTargetMainOutlet($request, $user, $activeOutlet, $mainOutlets, strict: true);

        abort_if(! $targetMainOutlet, 403, 'Outlet utama target tidak ditemukan.');

        $tenantIds = Outlet::query()
            ->active()
            ->where('outlet_type', 'tenant')
            ->where('parent_outlet_id', $targetMainOutlet->id)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values();

        $activeOutletIds = Outlet::query()
            ->active()
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values();

        $products = Product::query()
            ->with('outletStocks:id,outlet_id,product_id,stock,reorder_level,last_counted_at')
            ->whereIn('tenant_outlet_id', $tenantIds->all())
            ->get(['id', 'title', 'stock', 'tenant_outlet_id']);

        $updatedProducts = 0;
        $createdRows = 0;

        foreach ($products as $product) {
            $productStock = max(0, (int) $product->stock);
            $createdRowsForProduct = 0;
            $existingOutletIds = $product->outletStocks
                ->pluck('outlet_id')
                ->map(fn ($id) => (int) $id)
                ->values();

            foreach ($activeOutletIds as $outletId) {
                if (! $existingOutletIds->contains($outletId)) {
                    ProductOutletStock::query()->create([
                        'outlet_id' => $outletId,
                        'product_id' => $product->id,
                        'stock' => $productStock,
                        'reorder_level' => 0,
                        'last_counted_at' => now(),
                    ]);
                    $createdRowsForProduct++;
                    $createdRows++;
                }
            }

            $rowUpdates = ProductOutletStock::query()
                ->where('product_id', $product->id)
                ->where(function (Builder $query) use ($productStock) {
                    $query->where('stock', '!=', $productStock)
                        ->orWhereNull('last_counted_at');
                })
                ->update([
                    'stock' => $productStock,
                    'last_counted_at' => now(),
                ]);

            if ($rowUpdates > 0 || $createdRowsForProduct > 0) {
                $updatedProducts++;
            }
        }

        $this->auditLogService->log(
            event: 'data-repair.stocks.synced',
            module: 'data_repair',
            auditable: ['target_label' => 'Unified Stock Sync'],
            description: 'Mirror stok outlet disinkronkan ke stok produk terpusat.',
            after: [
                'main_outlet_id' => $targetMainOutlet->id,
                'main_outlet_code' => $targetMainOutlet->code,
                'products_count' => (int) $products->count(),
                'updated_products_count' => (int) $updatedProducts,
                'created_stock_rows_count' => (int) $createdRows,
            ]
        );

        return back()->with('success', "Sinkron stok selesai untuk {$updatedProducts} produk tenant. {$createdRows} baris stok outlet dibuat.");
    }

    public function autoMapKitchenProducts(Request $request): RedirectResponse
    {
        $user = $request->user();
        $activeOutlet = $this->outletResolver->resolve($request, $user);
        $mainOutlets = $this->accessibleMainOutlets($user)->get(['outlets.id', 'outlets.name', 'outlets.code']);
        $targetMainOutlet = $this->resolveTargetMainOutlet($request, $user, $activeOutlet, $mainOutlets, strict: true);

        abort_if(! $targetMainOutlet, 403, 'Outlet utama target tidak ditemukan.');

        $tenantIds = Outlet::query()
            ->active()
            ->where('outlet_type', 'tenant')
            ->where('parent_outlet_id', $targetMainOutlet->id)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values();

        $stationIdsByTenant = KitchenStation::query()
            ->where('is_active', true)
            ->whereIn('outlet_id', $tenantIds->all())
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'outlet_id'])
            ->groupBy('outlet_id')
            ->map(fn ($stations) => (int) $stations->first()->id);

        $products = Product::query()
            ->whereIn('tenant_outlet_id', $tenantIds->all())
            ->whereDoesntHave('kitchenStationMappings', fn ($query) => $query->where('is_active', true))
            ->get(['id', 'tenant_outlet_id']);

        $mappedCount = 0;
        $skippedCount = 0;

        foreach ($products as $product) {
            $tenantOutletId = (int) ($product->tenant_outlet_id ?? 0);
            $stationId = $stationIdsByTenant->get($tenantOutletId);

            if (! $stationId) {
                $skippedCount++;
                continue;
            }

            ProductKitchenStationMapping::query()->updateOrCreate(
                [
                    'product_id' => $product->id,
                    'kitchen_station_id' => $stationId,
                ],
                [
                    'priority' => 1,
                    'fire_on_sale' => true,
                    'is_active' => true,
                ]
            );

            $mappedCount++;
        }

        $this->auditLogService->log(
            event: 'data-repair.kitchen-mapping.synced',
            module: 'data_repair',
            auditable: ['target_label' => 'Kitchen Auto Mapping Sync'],
            description: 'Produk tenant tanpa mapping dapur diperbaiki otomatis.',
            after: [
                'main_outlet_id' => $targetMainOutlet->id,
                'main_outlet_code' => $targetMainOutlet->code,
                'mapped_products_count' => (int) $mappedCount,
                'skipped_products_count' => (int) $skippedCount,
            ]
        );

        return back()->with('success', "{$mappedCount} produk tenant berhasil di-auto-map ke station dapur. {$skippedCount} produk dilewati.");
    }

    public function rebuildMemberMetrics(Request $request): RedirectResponse
    {
        $user = $request->user();
        $activeOutlet = $this->outletResolver->resolve($request, $user);
        $mainOutlets = $this->accessibleMainOutlets($user)->get(['outlets.id', 'outlets.name', 'outlets.code']);
        $targetMainOutlet = $this->resolveTargetMainOutlet($request, $user, $activeOutlet, $mainOutlets, strict: true);

        abort_if(! $targetMainOutlet, 403, 'Outlet utama target tidak ditemukan.');

        $scopedOutletIds = $this->scopedOutletIdsForMainOutlet($targetMainOutlet);
        $existingMetricCustomerIds = CustomerOutletMetric::query()
            ->whereIn('outlet_id', $scopedOutletIds->all())
            ->pluck('customer_id')
            ->map(fn ($id) => (int) $id);

        $transactionCustomerIds = DB::table('transactions')
            ->whereIn('outlet_id', $scopedOutletIds->all())
            ->whereNotNull('customer_id')
            ->pluck('customer_id')
            ->map(fn ($id) => (int) $id);

        $impactedCustomerIds = $existingMetricCustomerIds
            ->merge($transactionCustomerIds)
            ->filter()
            ->unique()
            ->values();

        if ($impactedCustomerIds->isEmpty()) {
            return back()->with('success', 'Tidak ada customer pada scope outlet ini yang perlu dihitung ulang.');
        }

        $customers = Customer::query()
            ->whereIn('id', $impactedCustomerIds->all())
            ->get();

        $pairs = DB::table('transactions')
            ->whereIn('outlet_id', $scopedOutletIds->all())
            ->whereNotNull('customer_id')
            ->select('customer_id', 'outlet_id')
            ->distinct()
            ->get()
            ->groupBy('customer_id')
            ->map(fn ($rows) => collect($rows)->pluck('outlet_id')->map(fn ($id) => (int) $id)->values());

        CustomerOutletMetric::query()
            ->whereIn('outlet_id', $scopedOutletIds->all())
            ->whereIn('customer_id', $impactedCustomerIds->all())
            ->delete();

        $rebuiltMetricRows = 0;

        foreach ($customers as $customer) {
            foreach ($pairs->get((int) $customer->id, collect()) as $outletId) {
                $this->customerOutletMetricService->syncForCustomer($customer, $outletId);
                $rebuiltMetricRows++;
            }

            $this->rebuildGlobalCustomerMetrics($customer);
        }

        $this->auditLogService->log(
            event: 'data-repair.member-metrics.rebuilt',
            module: 'data_repair',
            auditable: ['target_label' => 'Member Metrics Rebuild'],
            description: 'Metric customer dan loyalty aggregate dihitung ulang pada scope outlet target.',
            after: [
                'main_outlet_id' => $targetMainOutlet->id,
                'main_outlet_code' => $targetMainOutlet->code,
                'customers_count' => (int) $customers->count(),
                'rebuilt_metric_rows_count' => (int) $rebuiltMetricRows,
            ]
        );

        return back()->with('success', "Member metrics berhasil dihitung ulang untuk {$customers->count()} customer.");
    }

    public function syncTenantCategories(Request $request): RedirectResponse
    {
        $user = $request->user();
        $activeOutlet = $this->outletResolver->resolve($request, $user);
        $mainOutlets = $this->accessibleMainOutlets($user)->get(['outlets.id', 'outlets.name', 'outlets.code']);
        $targetMainOutlet = $this->resolveTargetMainOutlet($request, $user, $activeOutlet, $mainOutlets, strict: true);

        abort_if(! $targetMainOutlet, 403, 'Outlet utama target tidak ditemukan.');

        $tenantIds = Outlet::query()
            ->active()
            ->where('outlet_type', 'tenant')
            ->where('parent_outlet_id', $targetMainOutlet->id)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values();

        $products = Product::query()
            ->with('category')
            ->whereIn('tenant_outlet_id', $tenantIds->all())
            ->get(['id', 'title', 'category_id', 'tenant_outlet_id']);

        $fixedProducts = 0;
        $createdCategories = 0;

        foreach ($products as $product) {
            $tenantOutletId = (int) ($product->tenant_outlet_id ?? 0);
            $category = $product->category;
            $categoryTenantOutletId = (int) ($category?->tenant_outlet_id ?? 0);

            if ($category && $categoryTenantOutletId === $tenantOutletId) {
                continue;
            }

            $sourceName = trim((string) ($category?->name ?: 'Tanpa Kategori'));
            $tenantCategory = Category::query()
                ->where('tenant_outlet_id', $tenantOutletId)
                ->where('name', $sourceName)
                ->first();

            if (! $tenantCategory) {
                $tenantCategory = Category::query()->create([
                    'name' => $sourceName,
                    'description' => (string) ($category?->description ?: 'Kategori tenant hasil sinkronisasi data repair.'),
                    'image' => $category ? $category->getRawOriginal('image') : 'default.jpg',
                    'tenant_outlet_id' => $tenantOutletId,
                ]);
                $createdCategories++;
            }

            if ((int) $product->category_id !== (int) $tenantCategory->id) {
                $product->forceFill([
                    'category_id' => $tenantCategory->id,
                ])->save();
                $fixedProducts++;
            }
        }

        $this->auditLogService->log(
            event: 'data-repair.tenant-categories.synced',
            module: 'data_repair',
            auditable: ['target_label' => 'Tenant Category Sync'],
            description: 'Kategori produk tenant diselaraskan dengan tenant outlet yang benar.',
            after: [
                'main_outlet_id' => $targetMainOutlet->id,
                'main_outlet_code' => $targetMainOutlet->code,
                'fixed_products_count' => (int) $fixedProducts,
                'created_categories_count' => (int) $createdCategories,
            ]
        );

        return back()->with('success', "{$fixedProducts} produk tenant berhasil diselaraskan. {$createdCategories} kategori tenant dibuat otomatis.");
    }

    private function accessibleMainOutlets(?User $user): Builder
    {
        if (! $user) {
            return Outlet::query()->whereRaw('1 = 0');
        }

        if ($user->isSuperAdmin()) {
            return Outlet::query()->active()->where('outlet_type', 'main')->ordered();
        }

        return $user->accessibleOutletsQuery()
            ->active()
            ->where('outlet_type', 'main')
            ->ordered();
    }

    private function accessibleTenantOutlets(?User $user): Builder
    {
        if (! $user) {
            return Outlet::query()->whereRaw('1 = 0');
        }

        if ($user->isSuperAdmin()) {
            return Outlet::query()->active()->where('outlet_type', 'tenant')->ordered();
        }

        return $user->accessibleOutletsQuery()
            ->active()
            ->where('outlet_type', 'tenant')
            ->ordered();
    }

    private function resolveTargetMainOutlet(
        Request $request,
        ?User $user,
        ?Outlet $activeOutlet,
        $mainOutlets,
        bool $strict = false
    ): ?Outlet {
        $requestedMainOutletId = (int) $request->input('main_outlet_id', 0);

        if ($requestedMainOutletId > 0) {
            return $mainOutlets->firstWhere('id', $requestedMainOutletId);
        }

        if ($activeOutlet?->outlet_type === 'main') {
            return $mainOutlets->firstWhere('id', (int) $activeOutlet->id);
        }

        if ($activeOutlet?->outlet_type === 'tenant' && $activeOutlet->parent_outlet_id) {
            return $mainOutlets->firstWhere('id', (int) $activeOutlet->parent_outlet_id);
        }

        if ($strict) {
            return null;
        }

        return $mainOutlets->first();
    }

    private function scopedOutletIdsForMainOutlet(Outlet $mainOutlet)
    {
        return collect([(int) $mainOutlet->id])
            ->merge(
                Outlet::query()
                    ->active()
                    ->where('outlet_type', 'tenant')
                    ->where('parent_outlet_id', $mainOutlet->id)
                    ->pluck('id')
                    ->map(fn ($id) => (int) $id)
            )
            ->unique()
            ->values();
    }

    private function rebuildGlobalCustomerMetrics(Customer $customer): void
    {
        $transactionAggregate = DB::table('transactions')
            ->where('customer_id', $customer->id)
            ->selectRaw('
                COALESCE(SUM(grand_total), 0) as total_spent,
                COUNT(*) as transaction_count,
                MAX(created_at) as last_purchase_at
            ')
            ->first();

        $pointsBalance = DB::table('loyalty_point_histories')
            ->where('customer_id', $customer->id)
            ->sum('points_delta');

        $totalSpent = (int) ($transactionAggregate->total_spent ?? 0);

        $customer->forceFill([
            'loyalty_points' => max(0, (int) $pointsBalance),
            'loyalty_total_spent' => $totalSpent,
            'loyalty_transaction_count' => (int) ($transactionAggregate->transaction_count ?? 0),
            'last_purchase_at' => $transactionAggregate->last_purchase_at,
            'loyalty_tier' => $this->loyaltyService->tierForTotalSpent($totalSpent),
        ])->save();
    }
}
