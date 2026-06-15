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
use App\Services\OutletResolver;
use App\Services\PricingService;
use App\Services\StockMutationService;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class ProductController extends Controller
{
    public function __construct(
        private readonly StockMutationService $stockMutationService,
        private readonly AuditLogService $auditLogService,
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
            'sort' => $request->input('sort', 'latest'),
            'per_page' => (int) $request->input('per_page', 10),
        ];

        $allowedPerPage = [10, 25, 50, 100];
        if (! in_array($filters['per_page'], $allowedPerPage, true)) {
            $filters['per_page'] = 10;
        }

        $products = $this->applyWorkspaceProductScope(Product::query(), $request)
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
            ->when($filters['search'] !== '', function ($query) use ($filters) {
                $search = $filters['search'];

                $query->where(function ($innerQuery) use ($search) {
                    $innerQuery
                        ->where('title', 'like', '%'.$search.'%')
                        ->orWhere('barcode', 'like', '%'.$search.'%')
                        ->orWhere('sku', 'like', '%'.$search.'%')
                        ->orWhere('description', 'like', '%'.$search.'%');
                });
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
            ->when($filters['stock_status'] !== '', function ($query) use ($filters) {
                return match ($filters['stock_status']) {
                    'out' => $query->where('stock', '<=', 0),
                    'low' => $query->where('stock', '>', 0)->where('stock', '<=', 5),
                    'ready' => $query->where('stock', '>', 5),
                    default => $query,
                };
            });

        $products = match ($filters['sort']) {
            'title_asc' => $products->orderBy('title'),
            'title_desc' => $products->orderByDesc('title'),
            'price_low' => $products->orderBy('sell_price'),
            'price_high' => $products->orderByDesc('sell_price'),
            'stock_low' => $products->orderBy('stock'),
            'stock_high' => $products->orderByDesc('stock'),
            'oldest' => $products->oldest(),
            default => $products->latest(),
        };

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
            : Outlet::active()->ordered()->get(['id', 'name', 'code', 'outlet_type']);
        $tenantOutletIds = $tenantOutlets
            ->where('outlet_type', 'tenant')
            ->pluck('id');

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
                'categories' => $this->categoryOptionsQuery()->get(['id', 'name', 'tenant_outlet_id']),
                'tenantOutlets' => $tenantOutlets,
                'kitchenStations' => ($isKitchenWorkspace || $isTenantOutlet)
                    ? []
                    : KitchenStation::query()
                        ->with('outlet:id,name,code')
                        ->where('is_active', true)
                        ->orderBy('outlet_id')
                        ->orderBy('sort_order')
                        ->orderBy('name')
                        ->get(['id', 'outlet_id', 'name', 'code']),
            ],
        ]);
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
            ->map(function (Category $category) {
                return [
                    'id' => $category->id,
                    'name' => $category->name,
                    'description' => $category->description,
                    'products' => $category->products->map(function (Product $product) {
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
                            'modifier_options' => $product->modifierOptions->map(fn ($option) => [
                                'id' => $option->id,
                                'name' => $option->name,
                                'price' => (int) $option->price,
                            ])->values()->all(),
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

    /**
     * Show the form for creating a new resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function create()
    {
        if ($this->isTenantOutletWorkspace(request())) {
            return $this->rejectStockOnlyUpdate();
        }

        // get categories
        $categories = $this->categoryOptionsQuery()->get(['id', 'name', 'tenant_outlet_id']);

        // return inertia
        return Inertia::render('Dashboard/Products/Create', [
            'categories' => $categories,
            'tenantOutlets' => Outlet::active()->ordered()->get(['id', 'name', 'code', 'outlet_type']),
        ]);
    }

    /**
     * Store a newly created resource in storage.
     *
     * @return \Illuminate\Http\Response
     */
    public function store(Request $request)
    {
        if ($this->isTenantOutletWorkspace($request)) {
            return $this->rejectStockOnlyUpdate();
        }

        /**
         * validate
         */
        $validated = $request->validate([
            'barcode' => 'required|unique:products,barcode',
            'sku' => 'nullable|unique:products,sku',
            'title' => 'required',
            'description' => 'required',
            'category_id' => 'required',
            'tenant_outlet_id' => 'nullable|exists:outlets,id',
            'supports_modifiers' => 'nullable|boolean',
            'modifier_options' => 'nullable|array',
            'modifier_options.*.name' => 'nullable|string|max:120',
            'modifier_options.*.price' => 'nullable|integer|min:0',
            'tenant_hpp_price' => 'nullable|integer|min:0',
            'buy_price' => 'required|integer|min:0',
            'sell_price' => 'required|integer|min:0',
            'stock' => 'required|integer|min:0',
        ]);

        $validated['sku'] = $this->generateUniqueSku(
            $validated['sku'] ?? null,
            $validated['barcode'] ?? null,
            $validated['title'] ?? null,
        );
        $validated['tenant_outlet_id'] = $request->integer('tenant_outlet_id') ?: null;
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

        // upload image
        $image = $request->file('image');
        $image->storeAs('public/products', $image->hashName());

        // create product
        $product = Product::create([
            'image' => $image->hashName(),
            'barcode' => $validated['barcode'],
            'sku' => $validated['sku'],
            'title' => $validated['title'],
            'description' => $validated['description'],
            'category_id' => $validated['category_id'],
            'tenant_outlet_id' => $validated['tenant_outlet_id'],
            'tenant_hpp_price' => $tenantHppPrice,
            'supports_modifiers' => $request->boolean('supports_modifiers'),
            'buy_price' => $validated['buy_price'],
            'sell_price' => $validated['sell_price'],
            'stock' => $validated['stock'],
        ]);

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
        $canManageCatalog = (request()->user()?->can('products-create') ?? false)
            && ! $this->isTenantOutletWorkspace($request);
        $canManageTenantDiscount = $this->canManageTenantDiscount($request, $product, $activeOutletId);
        $canManageTenantBasicFields = $this->canManageTenantBasicFields($request, $product, $activeOutletId);
        $canManageTenantSellPrice = $this->canManageTenantSellPrice($request, $product, $activeOutletId);
        $canManageOutletStock = $this->canManageOutletStock($request, $product, $activeOutletId);
        $canManageProductImage = $canManageCatalog || $canManageTenantBasicFields;

        // get categories
        $categories = $this->categoryOptionsQuery()->get(['id', 'name', 'tenant_outlet_id']);
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

                return [
                    'outlet_id' => $outlet->id,
                    'outlet_name' => $outlet->name,
                    'outlet_code' => $outlet->code,
                    'outlet_type' => $outlet->outlet_type,
                    'stock' => $existingStock ? (int) $existingStock->stock : (int) $product->stock,
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
                : Outlet::active()->ordered()->get(['id', 'name', 'code', 'outlet_type']),
            'outletStocks' => $outletStocks,
            'activePricingRules' => $this->pricingService->describeProductRules(
                $product,
                null,
                null,
                $activeOutletId
            ),
            'capabilities' => [
                'can_manage_catalog' => $canManageCatalog,
                'can_manage_pricing' => (request()->user()?->can('products-pricing-update') ?? false)
                    && ! $this->isTenantOutletWorkspace($request),
                'can_manage_tenant_discount' => $canManageTenantDiscount,
                'can_manage_tenant_basic_fields' => $canManageTenantBasicFields,
                'can_manage_tenant_sell_price' => $canManageTenantSellPrice,
                'can_manage_outlet_stock' => $canManageOutletStock,
                'can_manage_product_image' => $canManageProductImage,
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

        foreach ($data['outlet_stocks'] as $row) {
            $outletId = (int) $row['outlet_id'];

            if ($this->isTenantOutletWorkspace($request) && $activeOutletId && $outletId !== $activeOutletId) {
                abort(403, 'Tenant hanya dapat memperbarui stok outlet tenant aktif.');
            }

            if ($request->user()?->isKitchenWorkspace() && $activeOutletId && $outletId !== $activeOutletId) {
                abort(403, 'Akun dapur hanya dapat memperbarui stok outlet aktif.');
            }

            $targetStock = (int) $row['stock'];
            $reorderLevel = isset($row['reorder_level']) ? (int) $row['reorder_level'] : 0;

            $this->stockMutationService->setPhysicalStockForOutlet(
                product: $product,
                outletId: $outletId,
                stockAfter: $targetStock,
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
                    'stock' => $targetStock,
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

        $existingStock = ProductOutletStock::query()->firstWhere([
            'outlet_id' => $activeOutlet->id,
            'product_id' => $product->id,
        ]);

        $this->stockMutationService->setPhysicalStockForOutlet(
            product: $product,
            outletId: (int) $activeOutlet->id,
            stockAfter: (int) $data['stock'],
            referenceType: 'product_daily_adjustment',
            referenceId: $product->id,
            notes: $data['notes'] ?: 'Adjustment stok harian dari daftar produk.',
            userId: $request->user()?->id,
        );

        ProductOutletStock::query()->updateOrCreate(
            [
                'outlet_id' => $activeOutlet->id,
                'product_id' => $product->id,
            ],
            [
                'stock' => (int) $data['stock'],
                'reorder_level' => $existingStock?->reorder_level !== null
                    ? (int) $existingStock->reorder_level
                    : 0,
                'last_counted_at' => now(),
            ]
        );

        return back()->with('success', 'Stok harian produk berhasil diperbarui.');
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
        if ($this->isTenantOutletWorkspace($request) && ! $this->canManageTenantProductFields($request, $product)) {
            return $this->rejectStockOnlyUpdate();
        }
        $canManageCatalog = ($request->user()?->can('products-create') ?? false)
            && ! $this->isTenantOutletWorkspace($request);
        $canManagePricing = $request->user()?->can('products-pricing-update') ?? false;
        $activeOutletId = $this->outletResolver->resolve($request)?->id;
        $canManageTenantDiscount = $this->canManageTenantDiscount($request, $product, $activeOutletId);
        $canManageTenantBasicFields = $this->canManageTenantBasicFields($request, $product, $activeOutletId);
        $canManageTenantSellPrice = $this->canManageTenantSellPrice($request, $product, $activeOutletId);
        $canManageProductImage = $canManageCatalog || $canManageTenantBasicFields;

        if (! $canManageCatalog && ! $canManagePricing && ! $canManageTenantDiscount && ! $canManageTenantBasicFields && ! $canManageTenantSellPrice) {
            return $this->rejectStockOnlyUpdate();
        }

        $before = $this->productAuditPayload($product);

        /**
         * validate
         */
        $validated = $request->validate([
            'image' => 'nullable|mimes:jpg,jpeg,png,webp|max:5120',
            'barcode' => 'required|unique:products,barcode,'.$product->id,
            'sku' => 'nullable|unique:products,sku,'.$product->id,
            'title' => 'required',
            'description' => 'required',
            'category_id' => 'required',
            'tenant_outlet_id' => 'nullable|exists:outlets,id',
            'supports_modifiers' => 'nullable|boolean',
            'modifier_options' => 'nullable|array',
            'modifier_options.*.name' => 'nullable|string|max:120',
            'modifier_options.*.price' => 'nullable|integer|min:0',
            'tenant_hpp_price' => 'nullable|integer|min:0',
            'buy_price' => 'nullable|integer|min:0',
            'sell_price' => 'nullable|integer|min:0',
            'tenant_discount_price' => 'nullable|integer|min:0',
        ]);

        $validated['sku'] = $this->generateUniqueSku(
            $validated['sku'] ?? $product->sku,
            $validated['barcode'] ?? $product->barcode,
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
            $validated['modifier_options'] = $product->modifierOptions()
                ->orderBy('sort_order')
                ->get(['name', 'price'])
                ->map(fn ($option) => [
                    'name' => $option->name,
                    'price' => (int) $option->price,
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

        if (! $canManagePricing || ($this->isTenantOutletWorkspace($request) && ! $canManageCatalog)) {
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
            'buy_price' => $validated['buy_price'],
            'sell_price' => $validated['sell_price'],
            'tenant_discount_price' => $tenantDiscountPrice,
        ];

        // check image update
        if ($request->hasFile('image') && $canManageProductImage) {

            // remove old image
            Storage::disk('local')->delete('public/products/'.basename($product->image));

            // upload new image
            $image = $request->file('image');
            $image->storeAs('public/products', $image->hashName());

            // update product with new image
            $product->update([
                ...$attributes,
                'image' => $image->hashName(),
            ]);

            $this->logProductUpdate($product, $before);
            if ($canManageCatalog) {
                $this->syncModifierOptions($product, $validated['modifier_options'] ?? []);
            }

            return to_route('products.index');
        }

        // update product without image
        $product->update($attributes);

        if ($canManageCatalog) {
            $this->syncModifierOptions($product, $validated['modifier_options'] ?? []);
        }
        $this->logProductUpdate($product, $before);

        // redirect
        return to_route('products.index');
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

    private function categoryOptionsQuery()
    {
        return Category::query()
            ->with('tenantOutlet:id,name,code')
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

    /**
     * Remove the specified resource from storage.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function destroy($id)
    {
        // find by ID
        $product = Product::findOrFail($id);
        $this->resolveWorkspaceProduct($product, request());
        if ($this->isTenantOutletWorkspace(request())) {
            return $this->rejectStockOnlyUpdate();
        }
        $before = $this->productAuditPayload($product);

        // remove image
        Storage::disk('local')->delete('public/products/'.basename($product->image));

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
        ]);
    }

    private function syncModifierOptions(Product $product, array $rows): void
    {
        $normalized = collect($rows)
            ->map(function ($row, $index) {
                $name = trim((string) data_get($row, 'name', ''));
                $price = (int) data_get($row, 'price', 0);

                if ($name === '') {
                    return null;
                }

                return [
                    'name' => $name,
                    'price' => max(0, $price),
                    'is_active' => true,
                    'sort_order' => $index,
                ];
            })
            ->filter()
            ->values();

        $product->modifierOptions()->delete();

        if ($normalized->isNotEmpty()) {
            $product->modifierOptions()->createMany($normalized->all());
        }
    }

    private function rejectStockOnlyUpdate(): RedirectResponse
    {
        return back()->with('error', 'Perubahan katalog dan harga produk hanya boleh dilakukan admin. Gunakan bagian stok outlet untuk menambah atau mengurangi stok.');
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
    ): array
    {
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
            'active_outlet_stock' => $activeOutletStock ? (int) $activeOutletStock['stock'] : null,
            'active_outlet_stock_label' => $activeOutletStock
                ? sprintf('%s: %d', $activeOutletStock['outlet_code'] ?? 'Outlet aktif', $activeOutletStock['stock'])
                : null,
            'tenant_has_discount' => $tenantHasDiscount,
            'tenant_hpp_price' => (int) ($product->tenant_hpp_price ?? $product->buy_price ?? 0),
            'tenant_margin_unit_price' => max(0, (int) ($product->buy_price ?? 0) - (int) ($product->tenant_hpp_price ?? $product->buy_price ?? 0)),
            'owner_markup_unit_price' => max(0, (int) ($product->sell_price ?? 0) - (int) ($product->buy_price ?? 0)),
            'tenant_discount_price' => $tenantDiscountPrice,
            'tenant_effective_price' => $tenantHasDiscount
                ? $tenantDiscountPrice
                : (int) $product->buy_price,
            'pricing_badge' => $pricingBadge,
            'total_outlet_stock' => (int) $outletStocks->sum('stock'),
            'outlet_stock_count' => $outletStocks->count(),
            'outlet_stock_summary' => $outletStocks->take(3)->all(),
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

        return $this->canManageTenantBasicFields($request, $product, $activeOutletId)
            || $this->canManageTenantSellPrice($request, $product, $activeOutletId);
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
        $user = $request->user();

        if (! $this->isTenantOutletWorkspace($request)) {
            return false;
        }

        if (! $user?->can('products-pricing-update')) {
            return false;
        }

        if (! $activeOutletId || ! $product->tenant_outlet_id) {
            return false;
        }

        return (int) $product->tenant_outlet_id === (int) $activeOutletId;
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
