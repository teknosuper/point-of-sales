<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\KitchenStation;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\ProductKitchenStationMapping;
use App\Models\ProductOutletStock;
use App\Services\AuditLogService;
use App\Services\ImageUploadService;
use App\Services\ModifierMarkupService;
use App\Services\OutletResolver;
use App\Services\PricingService;
use App\Services\StockMutationService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class ProductController extends Controller
{
    private const TENANT_OWNER_DEFAULT_MARKUP = 3000;

    private const NORMALIZED_MODIFIER_GROUP_SQL = "LOWER(COALESCE(NULLIF(TRIM(group_name), ''), 'topping'))";

    private const NORMALIZED_MODIFIER_NAME_SQL = "LOWER(REPLACE(REPLACE(REPLACE(TRIM(name), ' ', ''), '-', ''), '_', ''))";

    public function __construct(
        private readonly StockMutationService $stockMutationService,
        private readonly AuditLogService $auditLogService,
        private readonly ImageUploadService $imageUploadService,
        private readonly ModifierMarkupService $modifierMarkupService,
        private readonly OutletResolver $outletResolver,
        private readonly PricingService $pricingService
    ) {}

    /**
     * Display a listing of the resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function index(Request $request)
    {
        $isKitchenWorkspace = $request->user()?->isKitchenWorkspace() ?? false;
        $activeOutlet = $this->outletResolver->resolve($request);
        $activeOutletId = $activeOutlet?->id;
        $isTenantOutlet = $activeOutlet?->outlet_type === 'tenant';
        $canViewOwnerSellPrice = ! $isTenantOutlet
            || ($request->user()?->can('products-pricing-update') ?? false);

        $filters = [
            'search' => trim((string) $request->input('search', '')),
            'category_id' => $request->input('category_id', ''),
            'tenant_outlet_id' => $request->input('tenant_outlet_id', ''),
            'mapping_status' => $request->input('mapping_status', ''),
            'stock_status' => $request->input('stock_status', ''),
            'featured' => $request->input('featured', ''),
            'penalty_status' => $request->input('penalty_status', ''),
            'sort' => $request->input('sort', 'latest'),
            'per_page' => (int) $request->input('per_page', 10),
        ];

        $allowedPerPage = [10, 25, 50, 100];
        if (! in_array($filters['per_page'], $allowedPerPage, true)) {
            $filters['per_page'] = 10;
        }

        $resolvedStockExpression = 'products.stock';

        $products = $this->buildProductIndexQuery($request, $filters, $resolvedStockExpression)
            ->with([
                'category:id,name',
                'tenantOutlet:id,name,code',
                'outletStocks' => fn ($query) => $query
                    ->with('outlet:id,name,code')
                    ->orderByDesc('stock')
                    ->orderBy('outlet_id'),
            ])
            ->withCount([
                'kitchenStationMappings as active_kitchen_station_mappings_count' => fn ($query) => $query->where('is_active', true),
            ])
            ->withAvg('reviews as rating_avg', 'rating')
            ->withCount('reviews as rating_count')
            ->selectSub(
                \DB::table('transaction_details')
                    ->selectRaw('COALESCE(SUM(qty), 0)')
                    ->whereColumn('product_id', 'products.id'),
                'sold_qty'
            );

        $products = $this->applyProductIndexSort($products, $filters['sort'] ?? 'latest', $resolvedStockExpression);

        $paginatedProducts = $products
            ->paginate($filters['per_page'])
            ->withQueryString();

        $productCollection = collect($paginatedProducts->items());
        $pricingBadges = $this->pricingService->previewProducts(
            $productCollection,
            null,
            outletId: $activeOutletId
        );

        $products = $paginatedProducts->through(
            fn (Product $product) => $this->productIndexPayload(
                $product,
                $activeOutletId,
                $canViewOwnerSellPrice,
                $pricingBadges->get($product->id)
            )
        );

        $tenantOutlets = ($isKitchenWorkspace || $isTenantOutlet)
            ? collect()
            : $this->accessibleTenantOutlets($request);
        $tenantOutletIds = $tenantOutlets
            ->where('outlet_type', 'tenant')
            ->pluck('id');
        $modifierSourceProducts = $this->applyWorkspaceProductScope(Product::query(), $request)
            ->select(['products.id', 'products.title', 'products.tenant_outlet_id'])
            ->with('tenantOutlet:id,name')
            ->where('supports_modifiers', true)
            ->orderBy('title')
            ->get()
            ->map(fn (Product $product) => [
                'id' => $product->id,
                'title' => $product->title,
                'tenant_outlet_name' => $product->tenantOutlet?->name,
            ])
            ->values();

        $setupStatus = ($isKitchenWorkspace || $isTenantOutlet)
            ? [
                'tenant_outlets_count' => 0,
                'products_with_tenant_count' => 0,
                'products_without_tenant_count' => 0,
                'products_with_station_mapping_count' => 0,
                'products_without_station_mapping_count' => 0,
                'needs_tenant_mapping' => false,
                'needs_station_mapping' => false,
            ]
            : [
                'tenant_outlets_count' => $tenantOutletIds->count(),
                'products_with_tenant_count' => Product::query()->whereNotNull('tenant_outlet_id')->count(),
                'products_without_tenant_count' => Product::query()->whereNull('tenant_outlet_id')->count(),
                'products_with_station_mapping_count' => ProductKitchenStationMapping::query()
                    ->where('is_active', true)
                    ->distinct('product_id')
                    ->count('product_id'),
                'products_without_station_mapping_count' => Product::query()
                    ->whereDoesntHave('kitchenStationMappings', fn ($query) => $query->where('is_active', true))
                    ->count(),
            ];

        if (! $isKitchenWorkspace && ! $isTenantOutlet) {
            $setupStatus['needs_tenant_mapping'] = $setupStatus['tenant_outlets_count'] > 0
                && $setupStatus['products_without_tenant_count'] > 0;
            $setupStatus['needs_station_mapping'] = $setupStatus['products_without_station_mapping_count'] > 0;
        }

        return Inertia::render('Dashboard/Products/Index', [
            'products' => $products,
            'filters' => $filters,
            'setupStatus' => $setupStatus,
            'workspace' => [
                'is_kitchen' => $isKitchenWorkspace,
                'is_tenant' => $isTenantOutlet,
                'active_outlet_id' => $activeOutletId,
            ],
            'meta' => [
                'per_page_options' => $allowedPerPage,
                'categories' => $this->categoryOptionsQuery($request)->get(['id', 'name', 'tenant_outlet_id']),
                'tenantOutlets' => $tenantOutlets,
                'modifierSourceProducts' => $modifierSourceProducts,
                'kitchenStations' => ($isKitchenWorkspace || $isTenantOutlet)
                    ? []
                    : $this->accessibleKitchenStations($request),
            ],
        ]);
    }

    private function buildProductIndexQuery(Request $request, array $filters, string $resolvedStockExpression): Builder
    {
        return $this->applyWorkspaceProductScope(Product::query(), $request)
            ->select('products.*')
            ->selectRaw("{$resolvedStockExpression} as resolved_stock")
            ->when($filters['search'] !== '', function ($query) use ($filters) {
                $search = $filters['search'];

                $query->where('title', 'like', '%'.$search.'%');
            })
            ->when($filters['category_id'] !== '', fn ($query) => $query->where('category_id', $filters['category_id']))
            ->when($filters['tenant_outlet_id'] !== '', function ($query) use ($filters) {
                if ($filters['tenant_outlet_id'] === 'unassigned') {
                    return $query->whereNull('tenant_outlet_id');
                }

                return $query->where('tenant_outlet_id', $filters['tenant_outlet_id']);
            })
            ->when($filters['mapping_status'] !== '', function ($query) use ($filters) {
                return match ($filters['mapping_status']) {
                    'tenant_missing' => $query->whereNull('tenant_outlet_id'),
                    'kitchen_missing' => $query->whereDoesntHave('kitchenStationMappings', fn ($mappingQuery) => $mappingQuery->where('is_active', true)),
                    'ready' => $query
                        ->whereNotNull('tenant_outlet_id')
                        ->whereHas('kitchenStationMappings', fn ($mappingQuery) => $mappingQuery->where('is_active', true)),
                    default => $query,
                };
            })
            ->when($filters['stock_status'] !== '', function ($query) use ($filters, $resolvedStockExpression) {
                return match ($filters['stock_status']) {
                    'out' => $query->whereRaw("{$resolvedStockExpression} <= 0"),
                    'low' => $query->whereRaw("{$resolvedStockExpression} > 0 AND {$resolvedStockExpression} <= 5"),
                    'ready' => $query->whereRaw("{$resolvedStockExpression} > 5"),
                    default => $query,
                };
            })
            ->when($filters['featured'] !== '', function ($query) use ($filters) {
                return match ($filters['featured']) {
                    '1' => $query->where('is_featured', true),
                    '0' => $query->where('is_featured', false),
                    default => $query,
                };
            })
            ->when($filters['penalty_status'] !== '', function ($query) use ($filters) {
                return match ($filters['penalty_status']) {
                    'shadow_banned' => $query->whereNotNull('shadow_banned_at'),
                    'active' => $query->whereNull('shadow_banned_at'),
                    'under_review' => $query->where('penalty_status', 'under_review'),
                    'accepted' => $query->where('penalty_status', 'accepted'),
                    'rejected' => $query->where('penalty_status', 'rejected'),
                    default => $query,
                };
            });
    }

    private function applyProductIndexSort(Builder $query, string $sort, string $resolvedStockExpression): Builder
    {
        return match ($sort) {
            'title_asc' => $query->orderBy('title'),
            'title_desc' => $query->orderByDesc('title'),
            'price_low' => $query->orderBy('sell_price'),
            'price_high' => $query->orderByDesc('sell_price'),
            'stock_low' => $query->orderByRaw("{$resolvedStockExpression} asc"),
            'stock_high' => $query->orderByRaw("{$resolvedStockExpression} desc"),
            'featured_first' => $query->orderByDesc('is_featured')->orderByDesc('id'),
            'shadow_banned_desc' => $query->orderByDesc('shadow_banned_at'),
            'oldest' => $query->oldest(),
            default => $query->latest(),
        };
    }

    public function menuBook(Request $request)
    {
        $outlet = $this->outletResolver->resolve($request);

        $categories = Category::query()
            ->with([
                'products' => function ($query) {
                    $query
                        ->with([
                            'tenantOutlet:id,name,code',
                            'modifierOptions' => fn ($modifierQuery) => $modifierQuery
                                ->where('is_active', true)
                                ->orderBy('sort_order')
                                ->orderBy('name'),
                        ])
                        ->orderBy('tenant_outlet_id')
                        ->orderBy('title');
                },
            ])
            ->whereHas('products')
            ->orderBy('name')
            ->get()
            ->map(function (Category $category) use ($outlet) {
                return [
                    'id' => $category->id,
                    'name' => $category->name,
                    'description' => $category->description,
                    'products' => $category->products->map(function (Product $product) use ($outlet) {
                        return [
                            'id' => $product->id,
                            'title' => $product->title,
                            'description' => $product->description,
                            'image' => $product->image,
                            'sell_price' => (int) $product->sell_price,
                            'tenant_outlet' => $product->tenantOutlet ? [
                                'id' => $product->tenantOutlet->id,
                                'name' => $product->tenantOutlet->name,
                                'code' => $product->tenantOutlet->code,
                            ] : null,
                            'modifier_options' => $product->modifierOptions
                                ->map(fn ($option) => $this->modifierMarkupService->payloadForOption($option, $outlet?->id))
                                ->values()
                                ->all(),
                            'supports_modifiers' => (bool) $product->supports_modifiers,
                            'requires_modifier_selection' => (bool) $product->requires_modifier_selection,
                        ];
                    })->values()->all(),
                ];
            })
            ->values();

        return Inertia::render('Dashboard/Products/MenuBook', [
            'menuBook' => [
                'store' => $outlet?->profilePayload() ?? $this->outletResolver->profilePayload(),
                'generated_at' => now()->toIso8601String(),
                'categories' => $categories,
            ],
        ]);
    }

    public function bulkMapping(Request $request)
    {
        if ($this->isTenantOutletWorkspace($request)) {
            return $this->rejectStockOnlyUpdate();
        }

        $data = $request->validate([
            'product_ids' => ['required', 'array', 'min:1'],
            'product_ids.*' => ['integer', 'exists:products,id'],
            'apply_tenant' => ['nullable', 'boolean'],
            'tenant_outlet_id' => ['nullable', 'exists:outlets,id'],
            'apply_kitchen' => ['nullable', 'boolean'],
            'kitchen_station_id' => ['nullable', 'exists:kitchen_stations,id'],
        ]);

        $products = Product::query()
            ->whereIn('id', $data['product_ids'])
            ->get();

        if ((bool) ($data['apply_tenant'] ?? false)) {
            $tenantOutletId = $request->filled('tenant_outlet_id')
                ? (int) $data['tenant_outlet_id']
                : null;

            Product::query()
                ->whereIn('id', $products->pluck('id'))
                ->update(['tenant_outlet_id' => $tenantOutletId]);
        }

        if ((bool) ($data['apply_kitchen'] ?? false)) {
            $stationId = $request->filled('kitchen_station_id')
                ? (int) $data['kitchen_station_id']
                : null;

            foreach ($products as $product) {
                $product->kitchenStationMappings()->update(['is_active' => false]);

                if ($stationId) {
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
                }
            }
        }

        return back()->with('success', 'Bulk mapping produk berhasil diperbarui.');
    }

    public function bulkCopyModifiers(Request $request): RedirectResponse
    {
        if ($this->isTenantOutletWorkspace($request)) {
            return $this->rejectStockOnlyUpdate();
        }

        $data = $request->validate([
            'source_product_id' => ['required', 'integer', 'exists:products,id'],
            'target_product_ids' => ['required', 'array', 'min:1'],
            'target_product_ids.*' => ['integer', 'exists:products,id'],
        ]);

        $sourceProduct = Product::query()
            ->with('modifierOptions')
            ->findOrFail($data['source_product_id']);
        $this->resolveWorkspaceProduct($sourceProduct, $request);

        $targetProducts = Product::query()
            ->whereIn('id', $data['target_product_ids'])
            ->get()
            ->filter(function (Product $product) use ($request, $sourceProduct) {
                $this->resolveWorkspaceProduct($product, $request);

                return (int) $product->id !== (int) $sourceProduct->id;
            })
            ->values();

        if ($targetProducts->isEmpty()) {
            return back()->with('error', 'Pilih minimal satu produk target yang berbeda dari produk sumber.');
        }

        $modifierRows = $sourceProduct->modifierOptions()
            ->orderBy('group_sort_order')
            ->orderBy('sort_order')
            ->get([
                'group_name',
                'selection_mode',
                'min_select',
                'max_select',
                'name',
                'price',
                'stock',
                'is_required',
                'group_sort_order',
            ])
            ->map(fn ($option) => [
                'group_name' => $option->group_name,
                'selection_mode' => $option->selection_mode,
                'min_select' => $option->min_select,
                'max_select' => $option->max_select,
                'name' => $option->name,
                'price' => (int) $option->price,
                'stock' => $option->stock,
                'is_required' => (bool) $option->is_required,
                'group_sort_order' => (int) ($option->group_sort_order ?? 0),
            ])
            ->values()
            ->all();

        foreach ($targetProducts as $product) {
            $product->forceFill([
                'supports_modifiers' => (bool) $sourceProduct->supports_modifiers,
                'requires_modifier_selection' => (bool) $sourceProduct->supports_modifiers
                    && (bool) $sourceProduct->requires_modifier_selection,
            ])->save();

            $this->syncModifierOptions($product, $modifierRows);
        }

        $this->auditLogService->log(
            event: 'product.bulk_modifiers_copied',
            module: 'products',
            auditable: $sourceProduct,
            description: "Preset topping dari {$sourceProduct->title} disalin ke {$targetProducts->count()} produk.",
            before: null,
            after: [
                'source_product_id' => $sourceProduct->id,
                'target_product_ids' => $targetProducts->pluck('id')->values()->all(),
                'modifier_count' => count($modifierRows),
            ],
        );

        return back()->with('success', "Topping dari {$sourceProduct->title} berhasil diterapkan ke {$targetProducts->count()} produk.");
    }

    public function bulkUpdateModifierStocks(Request $request): RedirectResponse
    {
        if ($this->isTenantOutletWorkspace($request)) {
            return $this->rejectStockOnlyUpdate();
        }

        $data = $request->validate([
            'target_product_ids' => ['nullable', 'array'],
            'target_product_ids.*' => ['integer', 'exists:products,id'],
            'apply_filtered_scope' => ['nullable', 'boolean'],
            'normalize_names' => ['nullable', 'boolean'],
            'filters' => ['nullable', 'array'],
            'filters.search' => ['nullable', 'string'],
            'filters.category_id' => ['nullable'],
            'filters.tenant_outlet_id' => ['nullable'],
            'filters.mapping_status' => ['nullable', 'string'],
            'filters.stock_status' => ['nullable', 'string'],
            'filters.sort' => ['nullable', 'string'],
            'filters.per_page' => ['nullable'],
            'modifier_stocks' => ['required', 'array', 'min:1'],
            'modifier_stocks.*.group_name' => ['required', 'string', 'max:120'],
            'modifier_stocks.*.name' => ['required', 'string', 'max:120'],
            'modifier_stocks.*.stock' => ['nullable', 'integer', 'min:0'],
        ]);

        $normalizeNames = (bool) ($data['normalize_names'] ?? false);
        $targetProductIds = $this->resolveBulkModifierTargetProductIds($request, $data);

        if (empty($targetProductIds)) {
            return back()->with('error', 'Pilih minimal satu produk target.');
        }

        $modifierRows = collect($data['modifier_stocks'])
            ->map(fn (array $row) => [
                'group_name' => trim((string) $row['group_name']),
                'name' => trim((string) $row['name']),
                'stock' => filled($row['stock']) ? max(0, (int) $row['stock']) : null,
            ])
            ->filter(fn (array $row) => $row['group_name'] !== '' && $row['name'] !== '')
            ->values();

        // Optimized: one UPDATE per modifier row across all target products (no N×M loop)
        $updatedCount = 0;
        foreach ($modifierRows as $row) {
            $isDefaultGroup = $row['group_name'] === 'Topping';
            $normalizedName = $this->normalizeModifierName($row['name']);

            $query = DB::table('product_modifier_options')
                ->whereIn('product_id', $targetProductIds)
                ->where(function ($q) use ($isDefaultGroup, $row) {
                    if ($isDefaultGroup) {
                        $q->whereNull('group_name')
                            ->orWhere('group_name', '')
                            ->orWhere('group_name', 'Topping');
                    } else {
                        $q->where('group_name', $row['group_name']);
                    }
                });

            if ($normalizeNames) {
                // Match by normalized name (ignores spaces, dashes, underscores, case)
                $query->whereRaw(self::NORMALIZED_MODIFIER_NAME_SQL.' = ?', [$normalizedName]);
            } else {
                // Exact match (case-insensitive via MySQL collation, but no symbol stripping)
                $query->whereRaw('LOWER(TRIM(name)) = ?', [strtolower(trim($row['name']))]);
            }

            $updatedCount += $query->update(['stock' => $row['stock']]);
        }

        if ($updatedCount === 0) {
            return back()->with('error', 'Tidak ada stok topping yang berubah. Pastikan nama topping dan grupnya memang cocok dengan data produk.');
        }

        $this->auditLogService->log(
            event: 'product.bulk_modifier_stocks_updated',
            module: 'products',
            auditable: Product::query()->whereKey($targetProductIds[0])->first(),
            description: 'Stok topping massal diperbarui untuk '.count($targetProductIds).' produk.',
            after: [
                'target_product_ids' => $targetProductIds,
                'modifier_count' => $modifierRows->count(),
                'updated_rows' => $updatedCount,
                'normalize_names' => $normalizeNames,
            ],
        );

        return back()->with('success', "Stok topping berhasil diperbarui untuk {$updatedCount} baris topping di ".count($targetProductIds).' produk.');
    }

    public function previewBulkModifierStocks(Request $request): JsonResponse
    {
        if ($this->isTenantOutletWorkspace($request)) {
            return response()->json([
                'message' => 'Perubahan katalog produk tidak diizinkan untuk workspace ini.',
            ], 403);
        }

        $data = $request->validate([
            'target_product_ids' => ['nullable', 'array'],
            'target_product_ids.*' => ['integer', 'exists:products,id'],
            'apply_filtered_scope' => ['nullable', 'boolean'],
            'filters' => ['nullable', 'array'],
            'filters.search' => ['nullable', 'string'],
            'filters.category_id' => ['nullable'],
            'filters.tenant_outlet_id' => ['nullable'],
            'filters.mapping_status' => ['nullable', 'string'],
            'filters.stock_status' => ['nullable', 'string'],
            'filters.sort' => ['nullable', 'string'],
            'filters.per_page' => ['nullable'],
        ]);

        $targetProducts = $this->resolveBulkModifierTargetProducts($request, $data);

        if ($targetProducts->isEmpty()) {
            return response()->json([
                'entries' => [],
                'target_count' => 0,
            ]);
        }

        $targetProductIds = $targetProducts->pluck('id')->values();

        $entries = DB::table('product_modifier_options')
            ->selectRaw("
                COALESCE(NULLIF(TRIM(group_name), ''), 'Topping') as normalized_group_name,
                MIN(name) as display_name,
                GROUP_CONCAT(DISTINCT name ORDER BY name SEPARATOR '||') as variant_names,
                COUNT(DISTINCT product_id) as product_count,
                COUNT(*) as option_count,
                COUNT(DISTINCT ".self::NORMALIZED_MODIFIER_NAME_SQL.') as variant_count,
                MIN(stock) as min_stock,
                MAX(stock) as max_stock
            ')
            ->whereIn('product_id', $targetProductIds)
            ->where('is_active', true)
            ->whereNotNull('name')
            ->whereRaw("TRIM(name) <> ''")
            ->groupByRaw('group_name, '.self::NORMALIZED_MODIFIER_NAME_SQL)
            ->orderByRaw('normalized_group_name asc')
            ->orderBy('display_name', 'asc')
            ->get()
            ->map(fn ($row) => [
                // use normalized values as the merge key
                '_merge_key' => $row->normalized_group_name.'::'.$this->normalizeModifierName($row->display_name),
                'group_name' => $row->normalized_group_name,
                'name' => $row->display_name,
                'product_count' => (int) $row->product_count,
                'option_count' => (int) $row->option_count,
                'variant_count' => (int) $row->variant_count,
                'variant_names' => collect(explode('||', (string) ($row->variant_names ?? '')))
                    ->filter()
                    ->values()
                    ->all(),
                'min_stock' => $row->min_stock !== null ? (int) $row->min_stock : null,
                'max_stock' => $row->max_stock !== null ? (int) $row->max_stock : null,
            ])
            // Merge rows that share the same normalized group+name (e.g. NULL vs 'Topping' group_name)
            ->groupBy('_merge_key')
            ->map(function ($group) {
                $first = $group->first();
                $allMin = $group->pluck('min_stock')->filter(fn ($v) => $v !== null);
                $allMax = $group->pluck('max_stock')->filter(fn ($v) => $v !== null);
                $minStock = $allMin->isNotEmpty() ? (int) $allMin->min() : null;
                $maxStock = $allMax->isNotEmpty() ? (int) $allMax->max() : null;
                $variantNames = $group->flatMap(fn ($r) => $r['variant_names'])->unique()->sort()->values()->all();

                return [
                    'key' => $first['_merge_key'],
                    'group_name' => $first['group_name'],
                    'name' => $first['name'],
                    'product_count' => (int) $group->sum('product_count'),
                    'option_count' => (int) $group->sum('option_count'),
                    'variant_count' => (int) $group->sum('variant_count'),
                    'variant_names' => $variantNames,
                    'stock' => $minStock !== null && $minStock === $maxStock ? $minStock : '',
                    'min_stock' => $minStock,
                    'max_stock' => $maxStock,
                    'has_mixed_stock' => $minStock !== null && $minStock !== $maxStock,
                ];
            })
            ->sortBy([
                fn ($a, $b) => strcmp(strtolower($a['group_name']), strtolower($b['group_name'])),
                fn ($a, $b) => strcmp(strtolower($a['name']), strtolower($b['name'])),
            ])
            ->values();

        return response()->json([
            'entries' => $entries,
            'target_count' => $targetProducts->count(),
        ]);
    }

    /**
     * Resolve target product IDs for bulk modifier stock operations.
     * Returns a plain array of int IDs (no Eloquent loading needed for bulk UPDATE).
     */
    private function resolveBulkModifierTargetProductIds(Request $request, array $data): array
    {
        $useFilteredScope = (bool) ($data['apply_filtered_scope'] ?? false);

        if ($useFilteredScope) {
            $rawFilters = is_array($data['filters'] ?? null) ? $data['filters'] : [];
            $filters = [
                'search' => trim((string) ($rawFilters['search'] ?? '')),
                'category_id' => (string) ($rawFilters['category_id'] ?? ''),
                'tenant_outlet_id' => (string) ($rawFilters['tenant_outlet_id'] ?? ''),
                'mapping_status' => (string) ($rawFilters['mapping_status'] ?? ''),
                'stock_status' => (string) ($rawFilters['stock_status'] ?? ''),
                'featured' => (string) ($rawFilters['featured'] ?? ''),
                'penalty_status' => (string) ($rawFilters['penalty_status'] ?? ''),
                'sort' => (string) ($rawFilters['sort'] ?? 'latest'),
                'per_page' => 10,
            ];

            $ids = $this->buildProductIndexQuery($request, $filters, 'products.stock')
                ->pluck('products.id')
                ->map(fn ($id) => (int) $id)
                ->filter()
                ->unique()
                ->values()
                ->all();
        } else {
            $ids = array_values(array_unique(array_map('intval', $data['target_product_ids'] ?? [])));
        }

        // Verify workspace access — filter to only IDs visible in current workspace
        if (! empty($ids)) {
            $ids = $this->applyWorkspaceProductScope(Product::query(), $request)
                ->whereIn('id', $ids)
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->values()
                ->all();
        }

        return $ids;
    }

    private function resolveBulkModifierTargetProducts(Request $request, array $data)
    {
        $useFilteredScope = (bool) ($data['apply_filtered_scope'] ?? false);
        $targetProductQuery = Product::query()->with('modifierOptions');

        if ($useFilteredScope) {
            $rawFilters = is_array($data['filters'] ?? null) ? $data['filters'] : [];
            $filters = [
                'search' => trim((string) ($rawFilters['search'] ?? '')),
                'category_id' => (string) ($rawFilters['category_id'] ?? ''),
                'tenant_outlet_id' => (string) ($rawFilters['tenant_outlet_id'] ?? ''),
                'mapping_status' => (string) ($rawFilters['mapping_status'] ?? ''),
                'stock_status' => (string) ($rawFilters['stock_status'] ?? ''),
                'featured' => (string) ($rawFilters['featured'] ?? ''),
                'penalty_status' => (string) ($rawFilters['penalty_status'] ?? ''),
                'sort' => (string) ($rawFilters['sort'] ?? 'latest'),
                'per_page' => 10,
            ];

            $targetProductQuery = $this->buildProductIndexQuery($request, $filters, 'products.stock');
        } else {
            $targetIds = array_values(array_unique(array_map('intval', $data['target_product_ids'] ?? [])));
            $targetProductQuery->whereIn('id', $targetIds);
        }

        $targetProducts = $targetProductQuery->get();

        foreach ($targetProducts as $product) {
            $this->resolveWorkspaceProduct($product, $request);
        }

        return $targetProducts->values();
    }

    private function normalizeModifierName(string $value): string
    {
        return Str::of($value)
            ->trim()
            ->lower()
            ->replaceMatches('/[\s\-_]+/', '')
            ->value();
    }

    /**
     * Show the form for creating a new resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function create()
    {
        $request = request();
        $activeOutlet = $this->outletResolver->resolve($request, $request->user());
        $isTenantWorkspace = $this->isTenantOutletWorkspace($request);

        // get categories
        $categories = $this->categoryOptionsQuery($request)
            ->when(
                $isTenantWorkspace && $activeOutlet?->id,
                fn ($query) => $query->where('tenant_outlet_id', $activeOutlet->id)
            )
            ->get(['id', 'name', 'tenant_outlet_id']);

        // return inertia
        return Inertia::render('Dashboard/Products/Create', [
            'categories' => $categories,
            'tenantOutlets' => ($isTenantWorkspace && $activeOutlet)
                ? collect([$activeOutlet])->map(fn (Outlet $outlet) => $outlet->only(['id', 'name', 'code', 'outlet_type']))->values()
                : $this->accessibleTenantOutlets($request),
            'autoKitchenStations' => $this->autoKitchenStationHints($request),
            'toppingMarkupSettings' => $this->modifierMarkupService->settingsPayload(),
            'workspace' => [
                'is_tenant' => $isTenantWorkspace,
                'active_outlet_id' => $activeOutlet?->id,
            ],
            'tenantDefaultMarkup' => self::TENANT_OWNER_DEFAULT_MARKUP,
        ]);
    }

    /**
     * Store a newly created resource in storage.
     *
     * @return \Illuminate\Http\Response
     */
    public function store(Request $request)
    {
        $activeOutlet = $this->outletResolver->resolve($request, $request->user());
        $activeOutletId = $activeOutlet?->id;
        $isTenantWorkspace = $this->isTenantOutletWorkspace($request);

        /**
         * validate
         */
        $validated = $request->validate([
            'image' => ['nullable', 'image', 'mimes:jpeg,jpg,png,webp', 'max:2048'],
            'barcode' => 'nullable|unique:products,barcode',
            'sku' => 'nullable|unique:products,sku',
            'title' => 'required',
            'description' => 'required',
            'category_id' => 'required',
            'tenant_outlet_id' => 'nullable|exists:outlets,id',
            'supports_modifiers' => 'nullable|boolean',
            'requires_modifier_selection' => 'nullable|boolean',
            'modifier_options' => 'nullable|array',
            'modifier_options.*.group_name' => 'nullable|string|max:120',
            'modifier_options.*.order_type_scope' => 'nullable|in:dine_in,take_away,both',
            'modifier_options.*.selection_mode' => 'nullable|in:single,multiple,optional',
            'modifier_options.*.min_select' => 'nullable|integer|min:0|max:50',
            'modifier_options.*.max_select' => 'nullable|integer|min:0|max:50',
            'modifier_options.*.name' => 'nullable|string|max:120',
            'modifier_options.*.price' => 'nullable|integer|min:0',
            'modifier_options.*.stock' => 'nullable|integer|min:0',
            'modifier_options.*.is_required' => 'nullable|boolean',
            'tenant_hpp_price' => 'nullable|integer|min:0',
            'buy_price' => 'required|integer|min:0',
            'sell_price' => 'required|integer|min:0',
            'stock' => 'required|integer|min:0',
        ]);

        $validated['barcode'] = $this->generateUniqueBarcode(
            $validated['barcode'] ?? null,
            $validated['sku'] ?? null,
            $validated['title'] ?? null,
        );
        $validated['sku'] = $this->generateUniqueSku(
            $validated['sku'] ?? null,
            $validated['barcode'],
            $validated['title'] ?? null,
        );
        $validated['tenant_outlet_id'] = $isTenantWorkspace
            ? ($activeOutletId ?: null)
            : ($request->integer('tenant_outlet_id') ?: null);
        $validated['category_id'] = $this->validateCategorySelection(
            (int) $validated['category_id'],
            $validated['tenant_outlet_id']
        );

        $tenantHppPrice = $request->filled('tenant_hpp_price')
            ? (int) $validated['tenant_hpp_price']
            : (int) $validated['buy_price'];

        if ($tenantHppPrice > (int) $validated['buy_price']) {
            return back()
                ->withErrors([
                    'tenant_hpp_price' => 'HPP tenant tidak boleh lebih besar dari harga beli owner dari tenant.',
                ])
                ->withInput();
        }

        if ($isTenantWorkspace) {
            $validated['sell_price'] = (int) $validated['buy_price'] + self::TENANT_OWNER_DEFAULT_MARKUP;
        }

        $storedImage = null;

        if ($request->hasFile('image')) {
            $storedImage = $this->imageUploadService->storePublicImage(
                $request->file('image'),
                'products',
                [
                    'max_width' => 1600,
                    'max_height' => 1600,
                    'thumb_width' => 480,
                    'thumb_height' => 480,
                ]
            );
        }

        // create product
        $canSelfApprove = $request->user()?->can('products-review');
        $product = Product::create([
            'image' => $storedImage['basename'] ?? 'default.jpg',
            'barcode' => $validated['barcode'],
            'sku' => $validated['sku'],
            'title' => $validated['title'],
            'description' => $validated['description'],
            'category_id' => $validated['category_id'],
            'tenant_outlet_id' => $validated['tenant_outlet_id'],
            'tenant_hpp_price' => $tenantHppPrice,
            'supports_modifiers' => $request->boolean('supports_modifiers'),
            'requires_modifier_selection' => $request->boolean('supports_modifiers') && $request->boolean('requires_modifier_selection'),
            'buy_price' => $validated['buy_price'],
            'sell_price' => $validated['sell_price'],
            'stock' => $validated['stock'],
            // Produk baru butuh review owner/main outlet sebelum tampil di publik & POS.
            'publish_status' => $canSelfApprove ? 'approved' : 'pending',
            'published_at' => $canSelfApprove ? now() : null,
        ]);

        $this->autoAssignKitchenStationMapping(
            product: $product,
            tenantOutletId: $validated['tenant_outlet_id'],
            activeOutletId: $activeOutletId,
            forceReplace: false,
        );
        $this->stockMutationService->recordInitialStock($product, $request->user()?->id);
        $this->syncModifierOptions($product, $request->input('modifier_options', []));
        $this->auditLogService->log(
            event: 'product.created',
            module: 'products',
            auditable: $product,
            description: 'Produk baru dibuat.',
            after: $this->productAuditPayload($product->fresh())
        );

        // redirect
        return to_route('products.index');
    }

    /**
     * Show the form for editing the specified resource.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function edit(Request $request, Product $product)
    {
        $product = $this->resolveWorkspaceProduct($product, $request);
        if ($this->isTenantOutletWorkspace($request) && ! $this->canManageTenantProductFields($request, $product)) {
            return $this->rejectStockOnlyUpdate();
        }
        $activeOutletId = $this->outletResolver->resolve($request)?->id;
        $tenantWorkspaceCatalogManager = $this->canManageTenantCatalog($request, $product, $activeOutletId);
        $canManageCatalog = $tenantWorkspaceCatalogManager
            || ((request()->user()?->can('products-edit') ?? false)
                && ! $this->isTenantOutletWorkspace($request));
        $canManageTenantDiscount = $this->canManageTenantDiscount($request, $product, $activeOutletId);
        $canManageTenantBasicFields = $this->canManageTenantBasicFields($request, $product, $activeOutletId);
        $canManageTenantSellPrice = $this->canManageTenantSellPrice($request, $product, $activeOutletId);
        $canManageOutletStock = $this->canManageOutletStock($request, $product, $activeOutletId);
        $canManageProductImage = $canManageCatalog || $canManageTenantBasicFields;

        // get categories
        $categories = $this->categoryOptionsQuery($request)->get(['id', 'name', 'tenant_outlet_id']);
        $product->load(['outletStocks.outlet', 'modifierOptions', 'tenantOutlet:id,name,code']);
        $productPayload = $product->toArray();

        if ($request->user()?->isKitchenWorkspace() && ! ($request->user()?->can('products-pricing-update') ?? false)) {
            $productPayload['sell_price'] = null;
        }

        $outletStocks = Outlet::active()
            ->ordered()
            ->when(
                ($request->user()?->isKitchenWorkspace() || $this->isTenantOutletWorkspace($request)) && $activeOutletId,
                fn ($query) => $query->where('id', $activeOutletId)
            )
            ->get(['id', 'name', 'code', 'outlet_type'])
            ->map(function (Outlet $outlet) use ($product) {
                /** @var ProductOutletStock|null $existingStock */
                $existingStock = $product->outletStocks->firstWhere('outlet_id', $outlet->id);
                $unifiedStock = (int) $product->stock;

                return [
                    'outlet_id' => $outlet->id,
                    'outlet_name' => $outlet->name,
                    'outlet_code' => $outlet->code,
                    'outlet_type' => $outlet->outlet_type,
                    'stock' => $unifiedStock,
                    'reorder_level' => $existingStock?->reorder_level !== null
                        ? (int) $existingStock->reorder_level
                        : 0,
                    'last_counted_at' => optional($existingStock?->last_counted_at)?->toIso8601String(),
                ];
            })
            ->values();

        return Inertia::render('Dashboard/Products/Edit', [
            'product' => $productPayload,
            'categories' => $categories,
            'tenantOutlets' => $request->user()?->isKitchenWorkspace()
                ? []
                : $this->accessibleTenantOutlets($request),
            'autoKitchenStations' => $this->autoKitchenStationHints($request),
            'outletStocks' => $outletStocks,
            'toppingMarkupSettings' => $this->modifierMarkupService->settingsPayload(),
            'activePricingRules' => $this->pricingService->describeProductRules(
                $product,
                null,
                null,
                $activeOutletId
            ),
            'workspace' => [
                'is_tenant' => $this->isTenantOutletWorkspace($request),
                'active_outlet_id' => $activeOutletId,
            ],
            'tenantDefaultMarkup' => self::TENANT_OWNER_DEFAULT_MARKUP,
            'capabilities' => [
                'can_manage_catalog' => $canManageCatalog,
                'can_manage_pricing' => (request()->user()?->can('products-pricing-update') ?? false)
                    && ! $this->isTenantOutletWorkspace($request),
                'can_manage_tenant_discount' => $canManageTenantDiscount,
                'can_manage_tenant_basic_fields' => $canManageTenantBasicFields,
                'can_manage_tenant_sell_price' => $canManageTenantSellPrice,
                'can_manage_outlet_stock' => $canManageOutletStock,
                'can_manage_product_image' => $canManageProductImage,
                'can_manage_publication' => $this->canManagePublicationFields($request),
            ],
        ]);
    }

    public function updateOutletStocks(Request $request, Product $product)
    {
        $product = $this->resolveWorkspaceProduct($product, $request);
        $activeOutletId = $this->outletResolver->resolve($request)?->id;
        $canManageOutletStock = $this->canManageOutletStock($request, $product, $activeOutletId);

        if (! $canManageOutletStock) {
            return $this->rejectStockOnlyUpdate();
        }

        $data = $request->validate([
            'notes' => ['nullable', 'string', 'max:255'],
            'outlet_stocks' => ['required', 'array', 'min:1'],
            'outlet_stocks.*.outlet_id' => ['required', 'integer', 'exists:outlets,id'],
            'outlet_stocks.*.stock' => ['required', 'integer', 'min:0'],
            'outlet_stocks.*.reorder_level' => ['nullable', 'integer', 'min:0'],
        ]);

        $submittedStocks = collect($data['outlet_stocks'])
            ->pluck('stock')
            ->map(fn ($stock) => (int) $stock)
            ->unique()
            ->values();

        if ($submittedStocks->count() > 1) {
            throw ValidationException::withMessages([
                'outlet_stocks' => 'Stok produk sekarang terpusat. Gunakan angka stok yang sama untuk semua outlet.',
            ]);
        }

        $unifiedTargetStock = (int) $submittedStocks->first();

        foreach ($data['outlet_stocks'] as $row) {
            $outletId = (int) $row['outlet_id'];

            if ($this->isTenantOutletWorkspace($request) && $activeOutletId && $outletId !== $activeOutletId) {
                abort(403, 'Tenant hanya dapat memperbarui stok outlet tenant aktif.');
            }

            if ($request->user()?->isKitchenWorkspace() && $activeOutletId && $outletId !== $activeOutletId) {
                abort(403, 'Akun dapur hanya dapat memperbarui stok outlet aktif.');
            }

            $reorderLevel = isset($row['reorder_level']) ? (int) $row['reorder_level'] : 0;

            $this->stockMutationService->setPhysicalStockForOutlet(
                product: $product,
                outletId: $outletId,
                stockAfter: $unifiedTargetStock,
                referenceType: 'product_admin_adjustment',
                referenceId: $product->id,
                notes: $data['notes'] ?: 'Adjustment stok outlet dari halaman edit produk.',
                userId: $request->user()?->id,
            );

            ProductOutletStock::query()->updateOrCreate(
                [
                    'outlet_id' => $outletId,
                    'product_id' => $product->id,
                ],
                [
                    'stock' => $unifiedTargetStock,
                    'reorder_level' => $reorderLevel,
                    'last_counted_at' => now(),
                ]
            );
        }

        return back()->with('success', 'Stok outlet produk berhasil diperbarui.');
    }

    public function updateDailyStock(Request $request, Product $product): RedirectResponse
    {
        $product = $this->resolveWorkspaceProduct($product, $request);
        $activeOutlet = $this->outletResolver->resolve($request, $request->user());

        if (! $activeOutlet) {
            return back()->with('error', 'Outlet aktif tidak ditemukan untuk pembaruan stok harian.');
        }

        $data = $request->validate([
            'stock' => ['required', 'integer', 'min:0'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $targetStock = (int) $data['stock'];
        $mutation = $this->stockMutationService->setPhysicalStockForOutlet(
            product: $product,
            outletId: (int) $activeOutlet->id,
            stockAfter: $targetStock,
            referenceType: 'product_daily_adjustment',
            referenceId: $product->id,
            notes: $data['notes'] ?: 'Adjustment stok harian dari daftar produk.',
            userId: $request->user()?->id,
        );

        $actualStock = (int) Product::query()->whereKey($product->id)->value('stock');

        if ($actualStock !== $targetStock) {
            return back()->with('error', 'Pembaruan stok harian gagal diterapkan. Silakan coba lagi.');
        }

        if (! $mutation) {
            return back()->with('info', 'Tidak ada perubahan stok harian yang disimpan.');
        }

        return back()->with('success', 'Stok harian produk berhasil diperbarui.');
    }

    public function bulkStockUpdate(Request $request): RedirectResponse
    {
        $user = $request->user();
        $activeOutlet = $this->outletResolver->resolve($request, $user);

        if (! $activeOutlet) {
            return back()->with('error', 'Outlet aktif tidak ditemukan.');
        }

        $data = $request->validate([
            'stocks' => ['required', 'array', 'min:1'],
            'stocks.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'stocks.*.stock' => ['required', 'integer', 'min:0'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $outletId = (int) $activeOutlet->id;
        $updated = 0;
        $normalizedEntries = collect($data['stocks'])
            ->keyBy(fn (array $entry) => (int) $entry['product_id']);

        $products = Product::query()
            ->whereIn('id', $normalizedEntries->keys()->all())
            ->get()
            ->keyBy('id');

        foreach ($normalizedEntries as $productId => $entry) {
            $product = $products->get((int) $productId);

            if (! $product) {
                continue;
            }

            $this->resolveWorkspaceProduct($product, $request);

            $targetStock = (int) $entry['stock'];
            $mutation = $this->stockMutationService->setPhysicalStockForOutlet(
                product: $product,
                outletId: $outletId,
                stockAfter: $targetStock,
                referenceType: 'product_bulk_adjustment',
                referenceId: $product->id,
                notes: $data['notes'] ?: 'Adjustment stok massal dari daftar produk.',
                userId: $user->id,
            );

            $actualStock = (int) Product::query()->whereKey($product->id)->value('stock');

            if ($actualStock !== $targetStock) {
                return back()->with('error', "Pembaruan stok massal gagal diterapkan untuk produk {$product->title}.");
            }

            if ($mutation) {
                $updated++;
            }
        }

        if ($updated === 0) {
            return back()->with('info', 'Tidak ada perubahan stok yang disimpan.');
        }

        return back()->with('success', "{$updated} produk berhasil diperbarui stoknya secara terpusat.");
    }

    /**
     * Update the specified resource in storage.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function update(Request $request, Product $product)
    {
        $product = $this->resolveWorkspaceProduct($product, $request);
        $beforeTenantOutletId = $product->tenant_outlet_id ? (int) $product->tenant_outlet_id : null;
        if ($this->isTenantOutletWorkspace($request) && ! $this->canManageTenantProductFields($request, $product)) {
            return $this->rejectStockOnlyUpdate();
        }
        $activeOutletId = $this->outletResolver->resolve($request)?->id;
        $tenantWorkspaceCatalogManager = $this->canManageTenantCatalog($request, $product, $activeOutletId);
        $canManageCatalog = $tenantWorkspaceCatalogManager
            || (($request->user()?->can('products-edit') ?? false)
                && ! $this->isTenantOutletWorkspace($request));
        $canManagePricing = $request->user()?->can('products-pricing-update') ?? false;
        $canManageTenantDiscount = $this->canManageTenantDiscount($request, $product, $activeOutletId);
        $canManageTenantBasicFields = $this->canManageTenantBasicFields($request, $product, $activeOutletId);
        $canManageTenantSellPrice = $this->canManageTenantSellPrice($request, $product, $activeOutletId);
        $canManageProductImage = $canManageCatalog || $canManageTenantBasicFields;

        if (! $canManageCatalog && ! $canManagePricing && ! $canManageTenantDiscount && ! $canManageTenantBasicFields && ! $canManageTenantSellPrice) {
            return $this->rejectStockOnlyUpdate();
        }

        $canManagePublicationFields = $this->canManagePublicationFields($request);

        $before = $this->productAuditPayload($product);

        /**
         * validate
         */
        $validated = $request->validate([
            'image' => ['nullable', 'image', 'mimes:jpeg,jpg,png,webp', 'max:2048'],
            'barcode' => 'nullable|unique:products,barcode,'.$product->id,
            'sku' => 'nullable|unique:products,sku,'.$product->id,
            'title' => 'required',
            'description' => 'required',
            'category_id' => 'required',
            'tenant_outlet_id' => 'nullable|exists:outlets,id',
            'supports_modifiers' => 'nullable|boolean',
            'requires_modifier_selection' => 'nullable|boolean',
            'modifier_options' => 'nullable|array',
            'modifier_options.*.group_name' => 'nullable|string|max:120',
            'modifier_options.*.order_type_scope' => 'nullable|in:dine_in,take_away,both',
            'modifier_options.*.selection_mode' => 'nullable|in:single,multiple,optional',
            'modifier_options.*.min_select' => 'nullable|integer|min:0|max:50',
            'modifier_options.*.max_select' => 'nullable|integer|min:0|max:50',
            'modifier_options.*.name' => 'nullable|string|max:120',
            'modifier_options.*.price' => 'nullable|integer|min:0',
            'modifier_options.*.stock' => 'nullable|integer|min:0',
            'modifier_options.*.is_required' => 'nullable|boolean',
            'tenant_hpp_price' => 'nullable|integer|min:0',
            'buy_price' => 'nullable|integer|min:0',
            'sell_price' => 'nullable|integer|min:0',
            'tenant_discount_price' => 'nullable|integer|min:0',
            'is_featured' => 'nullable|boolean',
            'shadow_banned_at' => 'nullable|date',
            'shadow_ban_reason' => 'nullable|string|max:255',
            'penalty_status' => 'nullable|string|in:under_review,accepted,rejected',
        ]);

        $validated['barcode'] = $this->generateUniqueBarcode(
            $validated['barcode'] ?? $product->barcode,
            $validated['sku'] ?? $product->sku,
            $validated['title'] ?? $product->title,
            $product->id
        );
        $validated['sku'] = $this->generateUniqueSku(
            $validated['sku'] ?? $product->sku,
            $validated['barcode'],
            $validated['title'] ?? $product->title,
            $product->id
        );

        if (! $canManageCatalog) {
            $validated['barcode'] = $product->barcode;
            $validated['sku'] = $product->sku;
            $validated['title'] = $canManageTenantBasicFields
                ? $validated['title']
                : $product->title;
            $validated['description'] = $product->description;
            $validated['category_id'] = $product->category_id;
            $validated['tenant_outlet_id'] = $product->tenant_outlet_id;
            $validated['supports_modifiers'] = $product->supports_modifiers;
            $validated['requires_modifier_selection'] = $product->requires_modifier_selection;
            $validated['modifier_options'] = $product->modifierOptions()
                ->orderBy('sort_order')
                ->get(['group_name', 'selection_mode', 'min_select', 'max_select', 'name', 'price', 'stock', 'is_required'])
                ->map(fn ($option) => [
                    'group_name' => $option->group_name,
                    'selection_mode' => $option->selection_mode ?: 'optional',
                    'min_select' => (int) ($option->min_select ?? 0),
                    'max_select' => $option->max_select !== null ? (int) $option->max_select : null,
                    'name' => $option->name,
                    'price' => (int) $option->price,
                    'stock' => $option->stock !== null ? (int) $option->stock : '',
                    'is_required' => (bool) $option->is_required,
                ])
                ->all();
        }

        $validated['tenant_outlet_id'] = $validated['tenant_outlet_id']
            ? (int) $validated['tenant_outlet_id']
            : null;
        $validated['category_id'] = $this->validateCategorySelection(
            (int) $validated['category_id'],
            $validated['tenant_outlet_id']
        );

        if ($tenantWorkspaceCatalogManager) {
            $existingOwnerMarkup = max(
                0,
                (int) ($product->sell_price ?? 0) - (int) ($product->buy_price ?? 0)
            );
            $validated['tenant_outlet_id'] = $activeOutletId;
            $validated['buy_price'] = (int) ($validated['buy_price'] ?? $product->buy_price ?? 0);
            $validated['sell_price'] = $validated['buy_price'] + $existingOwnerMarkup;
        } elseif (! $canManagePricing || ($this->isTenantOutletWorkspace($request) && ! $canManageCatalog)) {
            $validated['buy_price'] = ($canManagePricing || $canManageTenantSellPrice)
                ? ($validated['buy_price'] ?? $product->buy_price)
                : $product->buy_price;
            $validated['sell_price'] = $product->sell_price;
        }

        if (! $canManageCatalog && ! $canManageTenantSellPrice) {
            $validated['tenant_hpp_price'] = $product->tenant_hpp_price;
        }

        if (! $canManageTenantDiscount) {
            $validated['tenant_discount_price'] = $product->tenant_discount_price;
        }

        $tenantDiscountPrice = $validated['tenant_discount_price'] !== null && $validated['tenant_discount_price'] !== ''
            ? (int) $validated['tenant_discount_price']
            : null;
        $tenantDiscountBasePrice = (int) ($validated['buy_price'] ?? $product->buy_price ?? 0);
        $tenantHppPrice = $validated['tenant_hpp_price'] !== null && $validated['tenant_hpp_price'] !== ''
            ? (int) $validated['tenant_hpp_price']
            : (int) ($validated['buy_price'] ?? $product->buy_price ?? 0);

        if ($tenantHppPrice > $tenantDiscountBasePrice) {
            return back()
                ->withErrors([
                    'tenant_hpp_price' => 'HPP tenant tidak boleh lebih besar dari harga beli owner dari tenant.',
                ])
                ->withInput();
        }

        if ($tenantDiscountPrice !== null && $tenantDiscountPrice > $tenantDiscountBasePrice) {
            return back()
                ->withErrors([
                    'tenant_discount_price' => 'Harga diskon tenant tidak boleh lebih besar dari harga beli.',
                ])
                ->withInput();
        }

        $attributes = [
            'barcode' => $validated['barcode'],
            'sku' => $validated['sku'],
            'title' => $validated['title'],
            'description' => $validated['description'],
            'category_id' => $validated['category_id'],
            'tenant_outlet_id' => $validated['tenant_outlet_id'] ? (int) $validated['tenant_outlet_id'] : null,
            'tenant_hpp_price' => $tenantHppPrice,
            'supports_modifiers' => (bool) ($validated['supports_modifiers'] ?? false),
            'requires_modifier_selection' => (bool) ($validated['supports_modifiers'] ?? false)
                && (bool) ($validated['requires_modifier_selection'] ?? false),
            'buy_price' => $validated['buy_price'],
            'sell_price' => $validated['sell_price'],
            'tenant_discount_price' => $tenantDiscountPrice,
            'is_featured' => $canManagePublicationFields
                ? (bool) ($validated['is_featured'] ?? false)
                : (bool) ($product->is_featured ?? false),
            'shadow_banned_at' => $canManagePublicationFields
                ? ($validated['shadow_banned_at'] ?? null)
                : $product->shadow_banned_at,
            'shadow_ban_reason' => $canManagePublicationFields
                ? ($validated['shadow_ban_reason'] ?? null)
                : $product->shadow_ban_reason,
            'penalty_status' => $canManagePublicationFields
                ? ($validated['penalty_status'] ?? null)
                : $product->penalty_status,
        ];

        // check image update
        if ($request->hasFile('image') && $canManageProductImage) {

            // remove old image
            $this->imageUploadService->deletePublicImage(
                $product->getRawOriginal('image'),
                ['products']
            );

            // upload new image
            $storedImage = $this->imageUploadService->storePublicImage(
                $request->file('image'),
                'products',
                [
                    'max_width' => 1600,
                    'max_height' => 1600,
                    'thumb_width' => 480,
                    'thumb_height' => 480,
                ]
            );

            // update product with new image
            $product->update([
                ...$attributes,
                'image' => $storedImage['basename'],
            ]);

            $this->autoAssignKitchenStationMapping(
                product: $product->fresh('kitchenStationMappings'),
                tenantOutletId: $attributes['tenant_outlet_id'],
                activeOutletId: $activeOutletId,
                forceReplace: $beforeTenantOutletId !== $attributes['tenant_outlet_id'],
            );
            $this->logProductUpdate($product, $before);
            if ($canManageCatalog) {
                $this->syncModifierOptions($product, $validated['modifier_options'] ?? []);
            }
            $this->resubmitRejectedProduct($product, $request);

            return to_route('products.index');
        }

        // update product without image
        $product->update($attributes);

        if ($canManageCatalog) {
            $this->syncModifierOptions($product, $validated['modifier_options'] ?? []);
        }
        $this->autoAssignKitchenStationMapping(
            product: $product->fresh('kitchenStationMappings'),
            tenantOutletId: $attributes['tenant_outlet_id'],
            activeOutletId: $activeOutletId,
            forceReplace: $beforeTenantOutletId !== $attributes['tenant_outlet_id'],
        );
        $this->logProductUpdate($product, $before);
        $this->resubmitRejectedProduct($product, $request);

        // redirect
        return to_route('products.index');
    }

    public function toggleFeatured(Request $request, Product $product)
    {
        $product = $this->resolveWorkspaceProduct($product, $request);
        $featured = ! (bool) ($product->is_featured ?? false);
        $product->update(['is_featured' => $featured]);

        $this->auditLogService->log(
            event: 'product.featured_toggled',
            module: 'products',
            auditable: $product,
            description: $featured ? 'Produk dijadikan featured.' : 'Featured produk dihapus.',
            after: ['is_featured' => $featured]
        );

        return back()->with('success', $featured ? 'Produk berhasil dijadikan featured.' : 'Featured produk berhasil dihapus.');
    }

    public function applyShadowBan(Request $request, Product $product)
    {
        $product = $this->resolveWorkspaceProduct($product, $request);
        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $product->update([
            'shadow_banned_at' => now(),
            'shadow_ban_reason' => $validated['reason'] ?? 'Manual shadow ban',
            'penalty_status' => 'under_review',
        ]);

        $this->auditLogService->log(
            event: 'product.shadow_banned_manual',
            module: 'products',
            auditable: $product,
            description: 'Produk di-shadow-ban manual.',
            after: [
                'shadow_banned_at' => $product->shadow_banned_at?->toISOString(),
                'shadow_ban_reason' => $product->shadow_ban_reason,
                'penalty_status' => $product->penalty_status,
            ]
        );

        return back()->with('success', 'Produk berhasil di-shadow-ban.');
    }

    public function updatePenaltyStatus(Request $request, Product $product)
    {
        $product = $this->resolveWorkspaceProduct($product, $request);
        $validated = $request->validate([
            'status' => ['required', 'string', 'in:under_review,accepted,rejected'],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $before = [
            'shadow_banned_at' => $product->shadow_banned_at?->toISOString(),
            'shadow_ban_reason' => $product->shadow_ban_reason,
            'penalty_status' => $product->penalty_status,
        ];

        $data = [
            'penalty_status' => $validated['status'],
            'shadow_ban_reason' => $validated['reason'] ?? $product->shadow_ban_reason,
        ];

        if ($validated['status'] === 'accepted') {
            $data['shadow_banned_at'] = null;
        } elseif ($validated['status'] === 'rejected' && ! $product->shadow_banned_at) {
            $data['shadow_banned_at'] = now();
            $data['shadow_ban_reason'] = $validated['reason'] ?? 'Manual penalty rejected';
        }

        $product->update($data);

        $this->auditLogService->log(
            event: 'product.penalty_status_updated',
            module: 'products',
            auditable: $product,
            description: 'Status penalty produk diperbarui.',
            before: $before,
            after: [
                'shadow_banned_at' => $product->shadow_banned_at?->toISOString(),
                'shadow_ban_reason' => $product->shadow_ban_reason,
                'penalty_status' => $product->penalty_status,
            ]
        );

        return back()->with('success', 'Status penalty produk berhasil diperbarui.');
    }

    public function reviewQueue(Request $request)
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        $isTenantWorkspace = $outlet?->outlet_type === 'tenant';

        $query = Product::query()
            ->pendingReview()
            ->with([
                'category:id,name',
                'tenantOutlet:id,name,code',
            ])
            ->select(
                'id',
                'title',
                'description',
                'image',
                'barcode',
                'sku',
                'buy_price',
                'sell_price',
                'stock',
                'category_id',
                'tenant_outlet_id',
                'publish_status',
                'review_note',
                'created_at'
            )
            // Owner/main outlet melihat SEMUA produk tenant yang menunggu review;
            // tenant hanya melihat antrian milik outlet-nya sendiri.
            ->when($isTenantWorkspace, fn ($builder) => $builder->where('tenant_outlet_id', $outlet->id))
            ->orderByDesc('created_at');

        $pending = $request->input('search')
            ? (clone $query)->where('title', 'like', '%'.trim((string) $request->input('search')).'%')->paginate(20)
            : $query->paginate(20);

        return Inertia::render('Dashboard/Products/Review', [
            'pendingProducts' => $pending,
            'filters' => [
                'search' => (string) $request->input('search', ''),
            ],
        ]);
    }

    public function approve(Request $request, Product $product)
    {
        $product = $this->resolveWorkspaceProduct($product, $request);
        $before = ['publish_status' => $product->publish_status];
        $product->update([
            'publish_status' => 'approved',
            'published_at' => $product->published_at ?? now(),
            'reviewed_by' => $request->user()?->id,
            'reviewed_at' => now(),
            'review_note' => null,
        ]);

        $this->auditLogService->log(
            event: 'product.publish_approved',
            module: 'products',
            auditable: $product,
            description: 'Produk disetujui untuk tampil di publik.',
            before: $before,
            after: [
                'publish_status' => 'approved',
                'published_at' => $product->published_at?->toISOString(),
            ]
        );

        return back()->with('success', 'Produk berhasil disetujui dan kini tampil di publik.');
    }

    public function reject(Request $request, Product $product)
    {
        $product = $this->resolveWorkspaceProduct($product, $request);
        $validated = $request->validate([
            'review_note' => ['nullable', 'string', 'max:500'],
        ]);

        $before = ['publish_status' => $product->publish_status];
        $product->update([
            'publish_status' => 'rejected',
            'published_at' => null,
            'reviewed_by' => $request->user()?->id,
            'reviewed_at' => now(),
            'review_note' => trim((string) ($validated['review_note'] ?? '')),
        ]);

        $this->auditLogService->log(
            event: 'product.publish_rejected',
            module: 'products',
            auditable: $product,
            description: 'Produk ditolak untuk tampil di publik.',
            before: $before,
            after: [
                'publish_status' => 'rejected',
                'review_note' => $product->review_note,
            ]
        );

        return back()->with('success', 'Produk ditolak dan tidak akan tampil di publik.');
    }

    /**
     * Produk yang ditolak otomatis kembali ke antrian review (pending) saat
     * tenant memperbaiki dan menyimpan produknya, sehingga owner dapat
     * mereview ulang tanpa harus membuat produk baru.
     */
    private function resubmitRejectedProduct(Product $product, Request $request): void
    {
        if ($product->fresh()?->publish_status !== 'rejected') {
            return;
        }

        if (! $this->isTenantOutletWorkspace($request)) {
            return;
        }

        $product->update([
            'publish_status' => 'pending',
            'published_at' => null,
            'reviewed_by' => null,
            'reviewed_at' => null,
            'review_note' => null,
        ]);

        $this->auditLogService->log(
            event: 'product.publish_resubmitted',
            module: 'products',
            auditable: $product,
            description: 'Produk yang ditolak diperbaiki dan diajukan ulang untuk review.',
            after: ['publish_status' => 'pending'],
        );
    }

    private function generateUniqueSku(
        ?string $requestedSku,
        ?string $barcode,
        ?string $title,
        ?int $ignoreProductId = null
    ): string {
        $base = Str::of($requestedSku ?: $barcode ?: $title ?: 'SKU')
            ->upper()
            ->ascii()
            ->replaceMatches('/[^A-Z0-9]+/', '-')
            ->trim('-')
            ->substr(0, 40)
            ->value();

        if ($base === '') {
            $base = 'SKU';
        }

        $candidate = $base;
        $suffix = 1;

        while (
            Product::query()
                ->when($ignoreProductId, fn ($query) => $query->where('id', '!=', $ignoreProductId))
                ->where('sku', $candidate)
                ->exists()
        ) {
            $candidate = Str::limit($base, 36, '').'-'.$suffix;
            $suffix++;
        }

        return $candidate;
    }

    private function generateUniqueBarcode(
        ?string $requestedBarcode,
        ?string $sku,
        ?string $title,
        ?int $ignoreProductId = null
    ): string {
        $base = Str::of($requestedBarcode ?: $sku ?: $title ?: 'FC-PRODUCT')
            ->upper()
            ->ascii()
            ->replaceMatches('/[^A-Z0-9]+/', '-')
            ->trim('-')
            ->substr(0, 40)
            ->value();

        if ($base === '') {
            $base = 'FC-PRODUCT';
        }

        $candidate = $base;
        $suffix = 1;

        while (
            Product::query()
                ->when($ignoreProductId, fn ($query) => $query->where('id', '!=', $ignoreProductId))
                ->where('barcode', $candidate)
                ->exists()
        ) {
            $candidate = Str::limit($base, 36, '').'-'.$suffix;
            $suffix++;
        }

        return $candidate;
    }

    private function categoryOptionsQuery(Request $request)
    {
        $accessibleTenantOutletIds = $request->user()?->accessibleOutletsQuery()
            ->active()
            ->where('outlet_type', 'tenant')
            ->pluck('outlets.id')
            ->values();

        return Category::query()
            ->with('tenantOutlet:id,name,code')
            ->when(
                $accessibleTenantOutletIds && $accessibleTenantOutletIds->isNotEmpty() && ! $request->user()?->isSuperAdmin(),
                function ($query) use ($accessibleTenantOutletIds) {
                    $query->where(function ($nested) use ($accessibleTenantOutletIds) {
                        $nested->whereNull('tenant_outlet_id')
                            ->orWhereIn('tenant_outlet_id', $accessibleTenantOutletIds->all());
                    });
                }
            )
            ->orderByRaw('CASE WHEN tenant_outlet_id IS NULL THEN 0 ELSE 1 END')
            ->orderBy('tenant_outlet_id')
            ->orderBy('name');
    }

    private function validateCategorySelection(int $categoryId, ?int $tenantOutletId): int
    {
        $category = Category::query()->find($categoryId);

        if (! $category) {
            throw ValidationException::withMessages([
                'category_id' => 'Kategori tidak ditemukan.',
            ]);
        }

        $categoryTenantOutletId = $category->tenant_outlet_id ? (int) $category->tenant_outlet_id : null;

        if ($categoryTenantOutletId !== $tenantOutletId) {
            throw ValidationException::withMessages([
                'category_id' => $tenantOutletId
                    ? 'Kategori harus berasal dari tenant yang sama dengan produk.'
                    : 'Produk global hanya boleh memakai kategori global.',
            ]);
        }

        return (int) $category->id;
    }

    private function autoAssignKitchenStationMapping(
        Product $product,
        ?int $tenantOutletId,
        ?int $activeOutletId,
        bool $forceReplace = false
    ): void {
        $currentMapping = $product->kitchenStationMappings()
            ->where('is_active', true)
            ->first();

        if ($currentMapping && ! $forceReplace) {
            return;
        }

        $stationId = $this->resolveAutoKitchenStationId($product, $tenantOutletId, $activeOutletId);

        if (! $stationId) {
            return;
        }

        $product->kitchenStationMappings()->update(['is_active' => false]);

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
    }

    private function resolveAutoKitchenStationId(
        Product $product,
        ?int $tenantOutletId,
        ?int $activeOutletId
    ): ?int {
        if ($tenantOutletId) {
            $tenantStationId = KitchenStation::query()
                ->where('outlet_id', $tenantOutletId)
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->orderBy('name')
                ->value('id');

            if ($tenantStationId) {
                return (int) $tenantStationId;
            }

            $categoryScopedStationIds = ProductKitchenStationMapping::query()
                ->join('products', 'products.id', '=', 'product_kitchen_station_mappings.product_id')
                ->where('product_kitchen_station_mappings.is_active', true)
                ->where('products.tenant_outlet_id', $tenantOutletId)
                ->where('products.category_id', $product->category_id)
                ->where('products.id', '!=', $product->id)
                ->distinct()
                ->pluck('product_kitchen_station_mappings.kitchen_station_id')
                ->filter()
                ->values();

            if ($categoryScopedStationIds->count() === 1) {
                return (int) $categoryScopedStationIds->first();
            }

            $tenantScopedStationIds = ProductKitchenStationMapping::query()
                ->join('products', 'products.id', '=', 'product_kitchen_station_mappings.product_id')
                ->where('product_kitchen_station_mappings.is_active', true)
                ->where('products.tenant_outlet_id', $tenantOutletId)
                ->where('products.id', '!=', $product->id)
                ->distinct()
                ->pluck('product_kitchen_station_mappings.kitchen_station_id')
                ->filter()
                ->values();

            if ($tenantScopedStationIds->count() === 1) {
                return (int) $tenantScopedStationIds->first();
            }
        }

        if (! $activeOutletId) {
            return null;
        }

        $outletStationId = KitchenStation::query()
            ->where('outlet_id', $activeOutletId)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->value('id');

        return $outletStationId ? (int) $outletStationId : null;
    }

    private function autoKitchenStationHints(?Request $request = null): array
    {
        $accessibleOutletIds = $request?->user()?->accessibleOutletsQuery()
            ->active()
            ->pluck('outlets.id');

        return KitchenStation::query()
            ->with('outlet:id,name,code')
            ->where('is_active', true)
            ->when(
                $accessibleOutletIds && $accessibleOutletIds->isNotEmpty() && ! $request?->user()?->isSuperAdmin(),
                fn ($query) => $query->whereIn('outlet_id', $accessibleOutletIds->all())
            )
            ->orderBy('outlet_id')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->groupBy('outlet_id')
            ->map(function ($stations, $outletId) {
                /** @var KitchenStation|null $station */
                $station = $stations->first();

                if (! $station) {
                    return null;
                }

                return [
                    'outlet_id' => (int) $outletId,
                    'station_id' => (int) $station->id,
                    'station_name' => $station->name,
                    'station_code' => $station->code,
                    'outlet_name' => $station->outlet?->name,
                    'outlet_code' => $station->outlet?->code,
                ];
            })
            ->filter()
            ->values()
            ->all();
    }

    private function accessibleTenantOutlets(Request $request)
    {
        $user = $request->user();

        if (! $user) {
            return collect();
        }

        return $user->accessibleOutletsQuery()
            ->active()
            ->where('outlet_type', 'tenant')
            ->ordered()
            ->get(['outlets.id', 'outlets.name', 'outlets.code', 'outlets.outlet_type'])
            ->values();
    }

    private function accessibleKitchenStations(Request $request)
    {
        $accessibleOutletIds = $request->user()?->accessibleOutletsQuery()
            ->active()
            ->pluck('outlets.id')
            ->values();

        return KitchenStation::query()
            ->with('outlet:id,name,code')
            ->where('is_active', true)
            ->when(
                $accessibleOutletIds && $accessibleOutletIds->isNotEmpty() && ! $request->user()?->isSuperAdmin(),
                fn ($query) => $query->whereIn('outlet_id', $accessibleOutletIds->all())
            )
            ->orderBy('outlet_id')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'outlet_id', 'name', 'code']);
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function destroy($id)
    {
        abort_unless(request()->user()?->isSuperAdmin(), 403);

        // find by ID
        $product = Product::findOrFail($id);
        $this->resolveWorkspaceProduct($product, request());
        if ($this->isTenantOutletWorkspace(request())) {
            return $this->rejectStockOnlyUpdate();
        }
        $before = $this->productAuditPayload($product);

        // remove image
        $this->imageUploadService->deletePublicImage(
            $product->getRawOriginal('image'),
            ['products']
        );

        // delete
        $product->delete();

        $this->auditLogService->log(
            event: 'product.deleted',
            module: 'products',
            auditable: $product,
            description: 'Produk dihapus.',
            before: $before
        );

        // redirect
        return back();
    }

    private function logProductUpdate(Product $product, array $before): void
    {
        $after = $this->productAuditPayload($product->fresh());

        $this->auditLogService->log(
            event: 'product.updated',
            module: 'products',
            auditable: $product,
            description: 'Data produk diperbarui.',
            before: $before,
            after: $after
        );

        if (
            (int) ($before['tenant_hpp_price'] ?? 0) !== (int) ($after['tenant_hpp_price'] ?? 0)
            ||
            (int) $before['buy_price'] !== (int) $after['buy_price']
            || (int) $before['sell_price'] !== (int) $after['sell_price']
            || (int) ($before['tenant_discount_price'] ?? 0) !== (int) ($after['tenant_discount_price'] ?? 0)
        ) {
            $this->auditLogService->log(
                event: 'product.price_updated',
                module: 'products',
                auditable: $product,
                description: 'Harga produk diperbarui.',
                before: [
                    'tenant_hpp_price' => $before['tenant_hpp_price'] ?? null,
                    'buy_price' => $before['buy_price'],
                    'sell_price' => $before['sell_price'],
                    'tenant_discount_price' => $before['tenant_discount_price'] ?? null,
                ],
                after: [
                    'tenant_hpp_price' => $after['tenant_hpp_price'] ?? null,
                    'buy_price' => $after['buy_price'],
                    'sell_price' => $after['sell_price'],
                    'tenant_discount_price' => $after['tenant_discount_price'] ?? null,
                ]
            );
        }
    }

    private function productAuditPayload(Product $product): array
    {
        return $this->auditLogService->only($product->toArray(), [
            'title',
            'barcode',
            'sku',
            'tenant_hpp_price',
            'buy_price',
            'sell_price',
            'tenant_discount_price',
            'stock',
            'category_id',
            'tenant_outlet_id',
            'supports_modifiers',
            'requires_modifier_selection',
            'is_featured',
            'shadow_banned_at',
            'penalty_status',
        ]);
    }

    private function syncModifierOptions(Product $product, array $rows): void
    {
        $normalized = collect($rows)
            ->map(function ($row, $index) {
                $name = trim((string) data_get($row, 'name', ''));
                $groupName = trim((string) data_get($row, 'group_name', ''));
                $price = (int) data_get($row, 'price', 0);
                $stock = data_get($row, 'stock');
                $selectionMode = (string) data_get($row, 'selection_mode', 'optional');
                $minSelect = max(0, (int) data_get($row, 'min_select', 0));
                $maxSelect = data_get($row, 'max_select');

                if ($name === '') {
                    return null;
                }

                if (! in_array($selectionMode, ['single', 'multiple', 'optional'], true)) {
                    $selectionMode = 'optional';
                }

                if ($selectionMode === 'single') {
                    $minSelect = max(0, min(1, $minSelect > 0 ? 1 : 0));
                    $maxSelect = 1;
                } else {
                    $maxSelect = filled($maxSelect) ? max(0, (int) $maxSelect) : null;
                }

                if ($selectionMode !== 'single' && $maxSelect !== null && $maxSelect < $minSelect) {
                    $maxSelect = $minSelect;
                }

                return [
                    'group_name' => $groupName !== '' ? $groupName : 'Topping',
                    'order_type_scope' => $this->normalizeOrderTypeScope(data_get($row, 'order_type_scope')),
                    'name' => $name,
                    'price' => max(0, $price),
                    'stock' => filled($stock) ? max(0, (int) $stock) : null,
                    'is_active' => true,
                    'is_required' => (bool) data_get($row, 'is_required', false),
                    'selection_mode' => $selectionMode,
                    'min_select' => $minSelect,
                    'max_select' => $maxSelect,
                    'sort_order' => $index,
                    'group_sort_order' => (int) data_get($row, 'group_sort_order', $index),
                ];
            })
            ->filter()
            ->values();

        $product->modifierOptions()->delete();

        if ($normalized->isNotEmpty()) {
            $product->modifierOptions()->createMany($normalized->all());
        }
    }

    private function normalizeOrderTypeScope(mixed $value): ?string
    {
        $scope = trim((string) ($value ?? ''));

        if ($scope === '') {
            return null;
        }

        return in_array($scope, ['dine_in', 'take_away'], true) ? $scope : null;
    }

    private function rejectStockOnlyUpdate(): RedirectResponse
    {
        return back()->with('error', 'Perubahan katalog produk tidak diizinkan untuk workspace ini. Gunakan bagian stok outlet untuk menambah atau mengurangi stok.');
    }

    private function applyWorkspaceProductScope(Builder $query, Request $request): Builder
    {
        $user = $request->user();
        $activeOutlet = $this->outletResolver->resolve($request, $user);
        $activeOutletId = $activeOutlet?->id;

        if ($activeOutlet?->outlet_type === 'tenant' && $activeOutletId) {
            return $query->where('tenant_outlet_id', $activeOutletId);
        }

        if (! $user?->isKitchenWorkspace()) {
            return $query;
        }

        $preferredStationId = (int) ($user->preferred_kitchen_station_id ?? 0);

        if ($preferredStationId <= 0 && ! $activeOutletId) {
            return $query->whereRaw('1 = 0');
        }

        return $query->whereHas('kitchenStationMappings', function (Builder $mappingQuery) use ($preferredStationId, $activeOutletId) {
            $mappingQuery
                ->where('is_active', true)
                ->when(
                    $preferredStationId > 0,
                    fn (Builder $query) => $query->where('kitchen_station_id', $preferredStationId)
                )
                ->when(
                    $preferredStationId <= 0 && $activeOutletId,
                    fn (Builder $query) => $query->whereHas(
                        'kitchenStation',
                        fn (Builder $stationQuery) => $stationQuery
                            ->where('outlet_id', $activeOutletId)
                            ->where('is_active', true)
                    )
                );
        });
    }

    private function resolveWorkspaceProduct(Product $product, Request $request): Product
    {
        $isVisible = $this->applyWorkspaceProductScope(
            Product::query()->whereKey($product->id),
            $request
        )->exists();

        abort_unless($isVisible, 404);

        return $product;
    }

    private function productIndexPayload(
        Product $product,
        ?int $activeOutletId = null,
        bool $canViewOwnerSellPrice = true,
        ?array $pricing = null
    ): array {
        $outletStocks = $product->outletStocks
            ->map(fn ($stock) => [
                'id' => $stock->id,
                'outlet_id' => $stock->outlet_id,
                'outlet_code' => $stock->outlet?->code,
                'outlet_name' => $stock->outlet?->name,
                'stock' => (int) $stock->stock,
                'reorder_level' => $stock->reorder_level !== null ? (int) $stock->reorder_level : null,
            ])
            ->values();

        $activeOutletStock = $activeOutletId
            ? $outletStocks->firstWhere('outlet_id', $activeOutletId)
            : null;
        $displayStock = (int) $product->stock;
        $tenantDiscountPrice = $product->tenant_discount_price !== null
            ? (int) $product->tenant_discount_price
            : null;
        $tenantHasDiscount = $tenantDiscountPrice !== null && $tenantDiscountPrice < (int) $product->buy_price;
        $pricingBadge = $pricing && ! empty($pricing['pricing_rule']) ? [
            'label' => $pricing['pricing_rule']['label'],
            'promo_price' => $pricing['pricing_rule']['price_context']
                ? (int) $pricing['effective_unit_price']
                : null,
            'base_price' => (int) $pricing['base_unit_price'],
            'kind' => $pricing['pricing_rule']['kind'],
            'price_basis' => $pricing['pricing_rule']['price_basis'] ?? null,
        ] : null;

        $payload = [
            ...$product->toArray(),
            'stock' => $displayStock,
            'category' => $product->category
                ? [
                    'id' => $product->category->id,
                    'name' => $product->category->name,
                ]
                : null,
            'tenant_outlet' => $product->tenantOutlet
                ? [
                    'id' => $product->tenantOutlet->id,
                    'name' => $product->tenantOutlet->name,
                    'code' => $product->tenantOutlet->code,
                ]
                : null,
            'display_stock' => $displayStock,
            'display_stock_label' => sprintf('Stok terpusat: %d', $displayStock),
            'active_outlet_stock' => $displayStock,
            'active_outlet_stock_label' => $activeOutletStock
                ? sprintf('%s: %d', $activeOutletStock['outlet_code'] ?? 'Outlet aktif', $displayStock)
                : sprintf('Stok terpusat: %d', $displayStock),
            'tenant_has_discount' => $tenantHasDiscount,
            'tenant_hpp_price' => (int) ($product->tenant_hpp_price ?? $product->buy_price ?? 0),
            'tenant_margin_unit_price' => max(0, (int) ($product->buy_price ?? 0) - (int) ($product->tenant_hpp_price ?? $product->buy_price ?? 0)),
            'owner_markup_unit_price' => max(0, (int) ($product->sell_price ?? 0) - (int) ($product->buy_price ?? 0)),
            'tenant_discount_price' => $tenantDiscountPrice,
            'tenant_effective_price' => $tenantHasDiscount
                ? $tenantDiscountPrice
                : (int) $product->buy_price,
            'pricing_badge' => $pricingBadge,
            'total_outlet_stock' => $displayStock,
            'outlet_stock_count' => $outletStocks->count(),
            'outlet_stock_summary' => $outletStocks
                ->take(3)
                ->map(fn ($stock) => [
                    ...$stock,
                    'stock' => $displayStock,
                ])
                ->all(),
            'modifier_options' => $product->supports_modifiers
                ? $product->modifierOptions()
                    ->where('is_active', true)
                    ->orderBy('group_sort_order')
                    ->orderBy('sort_order')
                    ->get(['id', 'group_name', 'name', 'stock'])
                    ->map(fn ($option) => [
                        'id' => $option->id,
                        'group_name' => $option->group_name,
                        'name' => $option->name,
                        'stock' => $option->stock !== null ? (int) $option->stock : null,
                    ])
                    ->values()
                    ->all()
                : [],
        ];

        if (! $canViewOwnerSellPrice) {
            $payload['sell_price'] = null;
        }

        return $payload;
    }

    private function canManageTenantDiscount(Request $request, Product $product, ?int $activeOutletId): bool
    {
        $user = $request->user();

        if (! $user?->isKitchenWorkspace()) {
            return false;
        }

        if (! $user->can('products-edit')) {
            return false;
        }

        if (! $activeOutletId || ! $product->tenant_outlet_id) {
            return false;
        }

        return (int) $product->tenant_outlet_id === (int) $activeOutletId;
    }

    private function canManageTenantProductFields(Request $request, Product $product): bool
    {
        $activeOutletId = $this->outletResolver->resolve($request, $request->user())?->id;

        return $this->canManageTenantCatalog($request, $product, $activeOutletId)
            || $this->canManageTenantBasicFields($request, $product, $activeOutletId)
            || $this->canManageTenantSellPrice($request, $product, $activeOutletId);
    }

    /**
     * Hanya owner main outlet (atau admin sistem/super admin) yang boleh mengubah
     * field publikasi: featured, shadow ban, dan status penalty.
     */
    private function canManagePublicationFields(Request $request): bool
    {
        $user = $request->user();

        if (! $user) {
            return false;
        }

        if ($user->isSuperAdmin() || $user->hasRole('admin-sistem')) {
            return true;
        }

        if (! $user->hasRole(['admin-owner-outlet', 'outlet-owner'])) {
            return false;
        }

        $activeOutlet = $this->outletResolver->resolve($request, $user);

        return $activeOutlet?->outlet_type === 'main';
    }

    private function canManageTenantCatalog(Request $request, Product $product, ?int $activeOutletId): bool
    {
        $user = $request->user();

        if (! $this->isTenantOutletWorkspace($request)) {
            return false;
        }

        if (! $user?->can('products-edit')) {
            return false;
        }

        if (! $activeOutletId || ! $product->tenant_outlet_id) {
            return false;
        }

        return (int) $product->tenant_outlet_id === (int) $activeOutletId;
    }

    private function canManageTenantBasicFields(Request $request, Product $product, ?int $activeOutletId): bool
    {
        $user = $request->user();

        if (! $this->isTenantOutletWorkspace($request)) {
            return false;
        }

        if (! $user?->can('products-edit')) {
            return false;
        }

        if (! $activeOutletId || ! $product->tenant_outlet_id) {
            return false;
        }

        return (int) $product->tenant_outlet_id === (int) $activeOutletId;
    }

    private function canManageTenantSellPrice(Request $request, Product $product, ?int $activeOutletId): bool
    {
        return false;
    }

    private function canManageOutletStock(Request $request, Product $product, ?int $activeOutletId): bool
    {
        $user = $request->user();

        if (! $user?->can('products-stock-update')) {
            return false;
        }

        if ($this->isTenantOutletWorkspace($request)) {
            if (! $activeOutletId || ! $product->tenant_outlet_id) {
                return false;
            }

            return (int) $product->tenant_outlet_id === (int) $activeOutletId;
        }

        return true;
    }

    private function isTenantOutletWorkspace(Request $request): bool
    {
        return $this->outletResolver->resolve($request, $request->user())?->outlet_type === 'tenant';
    }
}
