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
use App\Services\StockMutationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class ProductController extends Controller
{
    public function __construct(
        private readonly StockMutationService $stockMutationService,
        private readonly AuditLogService $auditLogService,
        private readonly OutletResolver $outletResolver
    ) {}

    /**
     * Display a listing of the resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function index(Request $request)
    {
        $activeOutletId = $this->outletResolver->resolve($request)?->id;

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

        $products = Product::query()
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

        $products = $products
            ->paginate($filters['per_page'])
            ->withQueryString()
            ->through(fn (Product $product) => $this->productIndexPayload($product, $activeOutletId));

        $tenantOutlets = Outlet::active()->ordered()->get(['id', 'name', 'code', 'outlet_type']);
        $tenantOutletIds = $tenantOutlets
            ->where('outlet_type', 'tenant')
            ->pluck('id');

        $setupStatus = [
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

        $setupStatus['needs_tenant_mapping'] = $setupStatus['tenant_outlets_count'] > 0
            && $setupStatus['products_without_tenant_count'] > 0;
        $setupStatus['needs_station_mapping'] = $setupStatus['products_without_station_mapping_count'] > 0;

        return Inertia::render('Dashboard/Products/Index', [
            'products' => $products,
            'filters' => $filters,
            'setupStatus' => $setupStatus,
            'meta' => [
                'per_page_options' => $allowedPerPage,
                'categories' => Category::query()->orderBy('name')->get(['id', 'name']),
                'tenantOutlets' => $tenantOutlets,
                'kitchenStations' => KitchenStation::query()
                    ->with('outlet:id,name,code')
                    ->where('is_active', true)
                    ->orderBy('outlet_id')
                    ->orderBy('sort_order')
                    ->orderBy('name')
                    ->get(['id', 'outlet_id', 'name', 'code']),
            ],
        ]);
    }

    public function bulkMapping(Request $request)
    {
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
        // get categories
        $categories = Category::all();

        // return inertia
        return Inertia::render('Dashboard/Products/Create', [
            'categories' => $categories,
            'tenantOutlets' => Outlet::active()->ordered()->get(['id', 'name', 'code']),
        ]);
    }

    /**
     * Store a newly created resource in storage.
     *
     * @return \Illuminate\Http\Response
     */
    public function store(Request $request)
    {
        /**
         * validate
         */
        $request->validate([
            'barcode' => 'required|unique:products,barcode',
            'sku' => 'required|unique:products,sku',
            'title' => 'required',
            'description' => 'required',
            'category_id' => 'required',
            'tenant_outlet_id' => 'nullable|exists:outlets,id',
            'supports_modifiers' => 'nullable|boolean',
            'modifier_options' => 'nullable|array',
            'modifier_options.*.name' => 'nullable|string|max:120',
            'modifier_options.*.price' => 'nullable|integer|min:0',
            'buy_price' => 'required',
            'sell_price' => 'required',
            'stock' => 'required|integer|min:0',
        ]);
        // upload image
        $image = $request->file('image');
        $image->storeAs('public/products', $image->hashName());

        // create product
        $product = Product::create([
            'image' => $image->hashName(),
            'barcode' => $request->barcode,
            'sku' => $request->sku,
            'title' => $request->title,
            'description' => $request->description,
            'category_id' => $request->category_id,
            'tenant_outlet_id' => $request->integer('tenant_outlet_id') ?: null,
            'supports_modifiers' => $request->boolean('supports_modifiers'),
            'buy_price' => $request->buy_price,
            'sell_price' => $request->sell_price,
            'stock' => $request->stock,
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
    public function edit(Product $product)
    {
        // get categories
        $categories = Category::all();
        $product->load(['outletStocks.outlet', 'modifierOptions']);

        $outletStocks = Outlet::active()
            ->ordered()
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
            'product' => $product,
            'categories' => $categories,
            'tenantOutlets' => Outlet::active()->ordered()->get(['id', 'name', 'code']),
            'outletStocks' => $outletStocks,
        ]);
    }

    public function updateOutletStocks(Request $request, Product $product)
    {
        $data = $request->validate([
            'notes' => ['nullable', 'string', 'max:255'],
            'outlet_stocks' => ['required', 'array', 'min:1'],
            'outlet_stocks.*.outlet_id' => ['required', 'integer', 'exists:outlets,id'],
            'outlet_stocks.*.stock' => ['required', 'integer', 'min:0'],
            'outlet_stocks.*.reorder_level' => ['nullable', 'integer', 'min:0'],
        ]);

        foreach ($data['outlet_stocks'] as $row) {
            $outletId = (int) $row['outlet_id'];
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

    /**
     * Update the specified resource in storage.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function update(Request $request, Product $product)
    {
        $before = $this->productAuditPayload($product);

        /**
         * validate
         */
        $request->validate([
            'barcode' => 'required|unique:products,barcode,'.$product->id,
            'sku' => 'required|unique:products,sku,'.$product->id,
            'title' => 'required',
            'description' => 'required',
            'category_id' => 'required',
            'tenant_outlet_id' => 'nullable|exists:outlets,id',
            'supports_modifiers' => 'nullable|boolean',
            'modifier_options' => 'nullable|array',
            'modifier_options.*.name' => 'nullable|string|max:120',
            'modifier_options.*.price' => 'nullable|integer|min:0',
            'buy_price' => 'required',
            'sell_price' => 'required',
        ]);

        // check image update
        if ($request->file('image')) {

            // remove old image
            Storage::disk('local')->delete('public/products/'.basename($product->image));

            // upload new image
            $image = $request->file('image');
            $image->storeAs('public/products', $image->hashName());

            // update product with new image
            $product->update([
                'image' => $image->hashName(),
                'barcode' => $request->barcode,
                'sku' => $request->sku,
                'title' => $request->title,
                'description' => $request->description,
                'category_id' => $request->category_id,
                'tenant_outlet_id' => $request->integer('tenant_outlet_id') ?: null,
                'supports_modifiers' => $request->boolean('supports_modifiers'),
                'buy_price' => $request->buy_price,
                'sell_price' => $request->sell_price,
            ]);

            $this->logProductUpdate($product, $before);
            $this->syncModifierOptions($product, $request->input('modifier_options', []));

            return to_route('products.index');
        }

        // update product without image
        $product->update([
            'barcode' => $request->barcode,
            'sku' => $request->sku,
            'title' => $request->title,
            'description' => $request->description,
            'category_id' => $request->category_id,
            'tenant_outlet_id' => $request->integer('tenant_outlet_id') ?: null,
            'supports_modifiers' => $request->boolean('supports_modifiers'),
            'buy_price' => $request->buy_price,
            'sell_price' => $request->sell_price,
        ]);

        $this->syncModifierOptions($product, $request->input('modifier_options', []));
        $this->logProductUpdate($product, $before);

        // redirect
        return to_route('products.index');
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
            (int) $before['buy_price'] !== (int) $after['buy_price']
            || (int) $before['sell_price'] !== (int) $after['sell_price']
        ) {
            $this->auditLogService->log(
                event: 'product.price_updated',
                module: 'products',
                auditable: $product,
                description: 'Harga produk diperbarui.',
                before: [
                    'buy_price' => $before['buy_price'],
                    'sell_price' => $before['sell_price'],
                ],
                after: [
                    'buy_price' => $after['buy_price'],
                    'sell_price' => $after['sell_price'],
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
            'buy_price',
            'sell_price',
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

    private function productIndexPayload(Product $product, ?int $activeOutletId = null): array
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

        return [
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
            'total_outlet_stock' => (int) $outletStocks->sum('stock'),
            'outlet_stock_count' => $outletStocks->count(),
            'outlet_stock_summary' => $outletStocks->take(3)->all(),
        ];
    }
}
