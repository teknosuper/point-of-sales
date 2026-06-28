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
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class ProductController extends Controller
{
    private const TENANT_OWNER_DEFAULT_MARKUP = 3000;

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
            'sort' => $request->input('sort', 'latest'),
            'per_page' => (int) $request->input('per_page', 10),
        ];

        $allowedPerPage = [10, 25, 50, 100];
        if (! in_array($filters['per_page'], $allowedPerPage, true)) {
            $filters['per_page'] = 10;
        }

        $resolvedStockExpression = 'products.stock';

        $products = $this->applyWorkspaceProductScope(Product::query(), $request)
            ->select('products.*')
            ->selectRaw("{$resolvedStockExpression} as resolved_stock")
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
            ->when($filters['stock_status'] !== '', function ($query) use ($filters, $resolvedStockExpression) {
                return match ($filters['stock_status']) {
                    'out' => $query->whereRaw("{$resolvedStockExpression} <= 0"),
                    'low' => $query->whereRaw("{$resolvedStockExpression} > 0 AND {$resolvedStockExpression} <= 5"),
                    'ready' => $query->whereRaw("{$resolvedStockExpression} > 5"),
                    default => $query,
                };
            });

        $products = match ($filters['sort']) {
            'title_asc' => $products->orderBy('title'),
            'title_desc' => $products->orderByDesc('title'),
            'price_low' => $products->orderBy('sell_price'),
            'price_high' => $products->orderByDesc('sell_price'),
            'stock_low' => $products->orderByRaw("{$resolvedStockExpression} asc"),
            'stock_high' => $products->orderByRaw("{$resolvedStockExpression} desc"),
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
            || ((request()->user()?->can('products-create') ?? false)
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
            || (($request->user()?->can('products-create') ?? false)
                && ! $this->isTenantOutletWorkspace($request));
        $canManagePricing = $request->user()?->can('products-pricing-update') ?? false;
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
