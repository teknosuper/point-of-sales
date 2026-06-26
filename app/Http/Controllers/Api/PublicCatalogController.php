<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Outlet;
use App\Models\PricingRule;
use App\Models\Product;
use App\Models\ProductOutletStock;
use App\Services\ModifierMarkupService;
use App\Services\PricingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;

class PublicCatalogController extends Controller
{
    public function __construct(
        private readonly PricingService $pricingService,
        private readonly ModifierMarkupService $modifierMarkupService
    ) {}

    public function meta(Request $request): JsonResponse
    {
        $outlet = $this->resolveOutlet($request);
        $rules = $this->pricingService->getActiveRules(outletId: $outlet?->id);

        $categories = Category::query()
            ->select('id', 'name', 'description', 'image')
            ->orderBy('name')
            ->get()
            ->map(fn (Category $category) => [
                'id' => $category->id,
                'name' => $category->name,
                'description' => $category->description,
                'image' => $category->image,
            ])
            ->values();

        return response()->json([
            'data' => [
                'outlet' => $this->outletPayload($outlet),
                'categories' => $categories,
                'promo_summary' => [
                    'active_rules_count' => $rules->count(),
                    'rule_kinds' => $rules->pluck('kind')->unique()->values()->all(),
                    'counts_by_kind' => $rules->groupBy('kind')->map->count()->all(),
                ],
                'filters' => [
                    'supports' => [
                        'search',
                        'category_id',
                        'promo_only',
                        'include_out_of_stock',
                        'sort',
                    ],
                    'sorts' => [
                        'title',
                        'price_low',
                        'price_high',
                        'latest',
                        'promo_first',
                    ],
                    'promo_kinds' => [
                        PricingRule::KIND_STANDARD_DISCOUNT,
                        PricingRule::KIND_QTY_BREAK,
                        PricingRule::KIND_BUNDLE_PRICE,
                        PricingRule::KIND_BUY_X_GET_Y,
                    ],
                ],
            ],
        ]);
    }

    public function products(Request $request): JsonResponse
    {
        $outlet = $this->resolveOutlet($request);
        $products = $this->catalogProducts($request, $outlet);
        $mapped = $this->mapProductsWithPricing($products, $outlet?->id);

        if ($request->boolean('promo_only')) {
            $mapped = $mapped->filter(fn (array $product) => $product['pricing_badge'] !== null)->values();
        }

        $sorted = $this->sortProducts($mapped, $request->string('sort')->toString());
        $paginated = $this->paginateCollection($sorted, $request);

        return response()->json([
            'data' => $paginated->items(),
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
                'per_page' => $paginated->perPage(),
                'total' => $paginated->total(),
                'from' => $paginated->firstItem(),
                'to' => $paginated->lastItem(),
                'has_more_pages' => $paginated->hasMorePages(),
            ],
            'filters' => [
                'search' => $request->string('search')->toString(),
                'category_id' => $request->integer('category_id') ?: null,
                'promo_only' => $request->boolean('promo_only'),
                'include_out_of_stock' => $request->boolean('include_out_of_stock'),
                'sort' => $request->string('sort')->toString() ?: 'title',
            ],
            'context' => [
                'outlet' => $this->outletPayload($outlet),
            ],
        ]);
    }

    public function show(Request $request, Product $product): JsonResponse
    {
        $outlet = $this->resolveOutlet($request);
        $hydratedProduct = Product::query()
            ->with([
                'category:id,name,description,image',
                'tenantOutlet:id,code,slug,name',
                'modifierOptions',
                'kitchenStationMappings.kitchenStation:id,name,code',
                'outletStocks' => fn ($query) => $outlet
                    ? $query->where('outlet_id', $outlet->id)
                    : $query->limit(5),
            ])
            ->findOrFail($product->id);

        $payload = $this->mapProductsWithPricing(collect([$hydratedProduct]), $outlet?->id)->first();

        return response()->json([
            'data' => $payload,
            'context' => [
                'outlet' => $this->outletPayload($outlet),
            ],
        ]);
    }

    public function promos(Request $request): JsonResponse
    {
        $outlet = $this->resolveOutlet($request);
        $rules = $this->pricingService->getActiveRules(outletId: $outlet?->id);
        $rules = $this->filterPromoRules($rules, $request);

        $payload = $rules->map(fn (PricingRule $rule) => $this->promoRulePayload($rule, $outlet?->id))->values();

        return response()->json([
            'data' => $payload,
            'meta' => [
                'total' => $payload->count(),
                'counts_by_kind' => $payload->groupBy('kind')->map->count()->all(),
                'available_kinds' => $payload->pluck('kind')->unique()->values()->all(),
            ],
            'groups' => [
                'standard_discount' => $payload->where('kind', PricingRule::KIND_STANDARD_DISCOUNT)->values()->all(),
                'qty_break' => $payload->where('kind', PricingRule::KIND_QTY_BREAK)->values()->all(),
                'bundle_price' => $payload->where('kind', PricingRule::KIND_BUNDLE_PRICE)->values()->all(),
                'buy_x_get_y' => $payload->where('kind', PricingRule::KIND_BUY_X_GET_Y)->values()->all(),
            ],
            'filters' => [
                'kind' => $request->string('kind')->toString() ?: null,
                'target_type' => $request->string('target_type')->toString() ?: null,
            ],
            'context' => [
                'outlet' => $this->outletPayload($outlet),
            ],
        ]);
    }

    public function displayFeed(Request $request): JsonResponse
    {
        $outlet = $this->resolveOutlet($request);
        $promos = $this->filterPromoRules(
            $this->pricingService->getActiveRules(outletId: $outlet?->id),
            $request
        )
            ->map(fn (PricingRule $rule) => $this->promoRulePayload($rule, $outlet?->id))
            ->sortBy([
                ['priority', 'desc'],
                ['id', 'desc'],
            ])
            ->values();

        $source = 'promos';
        $slides = $promos;

        if ($slides->isEmpty()) {
            $source = 'products';
            $slides = $this->sortProducts(
                $this->mapProductsWithPricing($this->catalogProducts($request, $outlet), $outlet?->id),
                'promo_first'
            )->values();
        }

        return response()->json([
            'data' => [
                'source' => $source,
                'slides' => $slides->values()->all(),
            ],
            'meta' => [
                'total' => $slides->count(),
                'promo_count' => $promos->count(),
                'product_fallback_count' => $source === 'products' ? $slides->count() : 0,
            ],
            'context' => [
                'outlet' => $this->outletPayload($outlet),
            ],
        ]);
    }

    public function highlights(Request $request): JsonResponse
    {
        $outlet = $this->resolveOutlet($request);
        $products = $this->catalogProducts($request, $outlet);
        $mapped = $this->mapProductsWithPricing($products, $outlet?->id);

        $promoProducts = $mapped
            ->filter(fn (array $product) => $product['pricing_badge'] !== null)
            ->sortByDesc('promo_discount_total')
            ->sortBy('title')
            ->take((int) min(20, max(1, $request->integer('promo_limit', 8))))
            ->values();

        $lowStockProducts = $mapped
            ->filter(fn (array $product) => (int) $product['stock'] > 0 && (int) $product['stock'] <= 5)
            ->sortBy('stock')
            ->take((int) min(20, max(1, $request->integer('low_stock_limit', 8))))
            ->values();

        return response()->json([
            'data' => [
                'promo_products' => $promoProducts,
                'low_stock_products' => $lowStockProducts,
            ],
            'context' => [
                'outlet' => $this->outletPayload($outlet),
            ],
        ]);
    }

    public function promoBanners(Request $request): JsonResponse
    {
        $outlet = $this->resolveOutlet($request);
        $rules = $this->filterPromoRules(
            $this->pricingService->getActiveRules(outletId: $outlet?->id),
            $request
        );

        $limit = (int) min(20, max(1, $request->integer('limit', 6)));
        $banners = $rules
            ->map(fn (PricingRule $rule) => $this->promoBannerPayload($rule, $outlet?->id))
            ->take($limit)
            ->values();

        return response()->json([
            'data' => $banners,
            'meta' => [
                'total' => $banners->count(),
            ],
            'context' => [
                'outlet' => $this->outletPayload($outlet),
            ],
        ]);
    }

    public function homeSections(Request $request): JsonResponse
    {
        $outlet = $this->resolveOutlet($request);
        $products = $this->catalogProducts($request, $outlet);
        $mappedProducts = $this->mapProductsWithPricing($products, $outlet?->id);
        $rules = $this->filterPromoRules(
            $this->pricingService->getActiveRules(outletId: $outlet?->id),
            $request
        );
        $promos = $rules->map(fn (PricingRule $rule) => $this->promoRulePayload($rule, $outlet?->id))->values();

        $featuredPromos = $promos->take((int) min(12, max(1, $request->integer('featured_limit', 6))))->values();
        $bundlePromos = $promos->where('kind', PricingRule::KIND_BUNDLE_PRICE)->values();
        $buyGetPromos = $promos->where('kind', PricingRule::KIND_BUY_X_GET_Y)->values();
        $qtyBreakPromos = $promos->where('kind', PricingRule::KIND_QTY_BREAK)->values();
        $promoProducts = $mappedProducts
            ->filter(fn (array $product) => $product['pricing_badge'] !== null)
            ->sortByDesc('promo_discount_total')
            ->take((int) min(20, max(1, $request->integer('promo_product_limit', 8))))
            ->values();
        $newArrivals = $mappedProducts
            ->sortByDesc('created_at')
            ->take((int) min(20, max(1, $request->integer('new_limit', 8))))
            ->values();
        $lowStock = $mappedProducts
            ->filter(fn (array $product) => (int) $product['stock'] > 0 && (int) $product['stock'] <= 5)
            ->sortBy('stock')
            ->take((int) min(20, max(1, $request->integer('low_stock_limit', 8))))
            ->values();

        return response()->json([
            'data' => [
                'hero_banners' => $featuredPromos
                    ->map(fn (array $promo) => $this->promoCardSectionPayload($promo, 'hero'))
                    ->values()
                    ->all(),
                'featured_promos' => $featuredPromos
                    ->map(fn (array $promo) => $this->promoCardSectionPayload($promo, 'featured'))
                    ->values()
                    ->all(),
                'bundle_promos' => $bundlePromos
                    ->map(fn (array $promo) => $this->promoCardSectionPayload($promo, 'bundle'))
                    ->values()
                    ->all(),
                'buy_get_promos' => $buyGetPromos
                    ->map(fn (array $promo) => $this->promoCardSectionPayload($promo, 'buy_get'))
                    ->values()
                    ->all(),
                'qty_break_promos' => $qtyBreakPromos
                    ->map(fn (array $promo) => $this->promoCardSectionPayload($promo, 'qty_break'))
                    ->values()
                    ->all(),
                'promo_products' => $promoProducts->all(),
                'new_arrivals' => $newArrivals->all(),
                'low_stock_products' => $lowStock->all(),
            ],
            'meta' => [
                'promo_count' => $promos->count(),
                'product_count' => $mappedProducts->count(),
            ],
            'context' => [
                'outlet' => $this->outletPayload($outlet),
            ],
        ]);
    }

    private function catalogProducts(Request $request, ?Outlet $outlet): Collection
    {
        $query = Product::query()
            ->with([
                'category:id,name,description,image',
                'tenantOutlet:id,code,slug,name',
                'modifierOptions',
                'kitchenStationMappings.kitchenStation:id,name,code',
            ])
            ->select([
                'id',
                'image',
                'barcode',
                'sku',
                'title',
                'description',
                'buy_price',
                'sell_price',
                'stock',
                'category_id',
                'tenant_outlet_id',
                'supports_modifiers',
                'requires_modifier_selection',
                'created_at',
            ])
            ->when(
                $request->filled('search'),
                fn ($builder) => $builder->where(function ($searchQuery) use ($request) {
                    $keyword = trim((string) $request->input('search'));
                    $searchQuery
                        ->where('title', 'like', '%'.$keyword.'%')
                        ->orWhere('sku', 'like', '%'.$keyword.'%')
                        ->orWhere('barcode', 'like', '%'.$keyword.'%');
                })
            )
            ->when(
                $request->filled('category_id'),
                fn ($builder) => $builder->where('category_id', (int) $request->input('category_id'))
            )
            ->orderBy('title');

        if (! $request->boolean('include_out_of_stock')) {
            $query->where('stock', '>', 0);
        }

        return $query->get()->map(function (Product $product) {
            $product->setAttribute('stock', (int) ($product->stock ?? 0));

            return $product;
        })->values();
    }

    private function mapProductsWithPricing(Collection $products, ?int $outletId): Collection
    {
        $pricing = $this->pricingService->previewProducts($products, outletId: $outletId);

        return $products->map(function (Product $product) use ($pricing, $outletId) {
            $pricePreview = $pricing->get($product->id);
            $rule = $pricePreview['pricing_rule'] ?? null;

            return [
                'id' => $product->id,
                'title' => $product->title,
                'description' => $product->description,
                'image' => $product->image,
                'barcode' => $product->barcode,
                'sku' => $product->sku,
                'sell_price' => (int) $product->sell_price,
                'buy_price' => (int) $product->buy_price,
                'stock' => (int) $product->stock,
                'effective_price' => (int) ($pricePreview['effective_unit_price'] ?? $product->sell_price),
                'promo_discount_total' => (int) ($pricePreview['line_discount_total'] ?? 0),
                'supports_modifiers' => (bool) $product->supports_modifiers,
                'requires_modifier_selection' => (bool) $product->requires_modifier_selection,
                'category' => $product->category ? [
                    'id' => $product->category->id,
                    'name' => $product->category->name,
                    'description' => $product->category->description,
                    'image' => $product->category->image,
                ] : null,
                'tenant_outlet' => $product->tenantOutlet ? [
                    'id' => $product->tenantOutlet->id,
                    'code' => $product->tenantOutlet->code,
                    'slug' => $product->tenantOutlet->slug,
                    'name' => $product->tenantOutlet->name,
                ] : null,
                'modifier_options' => $product->modifierOptions
                    ->where('is_active', true)
                    ->map(fn ($option) => $this->modifierMarkupService->payloadForOption($option, $outletId))
                    ->values()
                    ->all(),
                'kitchen_stations' => $product->kitchenStationMappings
                    ->where('is_active', true)
                    ->sortBy('priority')
                    ->map(fn ($mapping) => [
                        'id' => $mapping->kitchenStation?->id,
                        'name' => $mapping->kitchenStation?->name,
                        'code' => $mapping->kitchenStation?->code,
                    ])
                    ->filter(fn (array $station) => filled($station['name']))
                    ->values()
                    ->all(),
                'pricing_badge' => $rule ? [
                    'id' => $rule['id'],
                    'name' => $rule['name'],
                    'kind' => $rule['kind'],
                    'label' => $rule['label'],
                    'detail' => $rule['detail'] ?? null,
                    'customer_scope' => $rule['customer_scope'] ?? null,
                    'price_basis' => $rule['price_basis'] ?? PricingRule::PRICE_BASIS_SELL_PRICE,
                    'base_price' => (int) ($pricePreview['base_unit_price'] ?? $product->sell_price),
                    'promo_price' => $rule['price_context'] ?? false
                        ? (int) ($pricePreview['effective_unit_price'] ?? $product->sell_price)
                        : null,
                ] : null,
                'outlet_stock' => [
                    'outlet_id' => $outletId,
                    'stock' => (int) $product->stock,
                ],
                'created_at' => optional($product->created_at)->toISOString(),
            ];
        })->values();
    }

    private function sortProducts(Collection $products, string $sort): Collection
    {
        return match ($sort) {
            'price_low' => $products->sortBy('effective_price')->values(),
            'price_high' => $products->sortByDesc('effective_price')->values(),
            'latest' => $products->sortByDesc('created_at')->values(),
            'promo_first' => $products->sortByDesc(fn (array $product) => $product['pricing_badge'] !== null)->values(),
            default => $products->sortBy('title')->values(),
        };
    }

    private function paginateCollection(Collection $items, Request $request): LengthAwarePaginator
    {
        $perPage = (int) min(100, max(1, $request->integer('per_page', 24)));
        $page = (int) max(1, $request->integer('page', 1));
        $slice = $items->forPage($page, $perPage)->values();

        return new LengthAwarePaginator(
            $slice,
            $items->count(),
            $perPage,
            $page,
            [
                'path' => $request->url(),
                'query' => $request->query(),
            ]
        );
    }

    private function promoRulePayload(PricingRule $rule, ?int $outletId): array
    {
        $buyGetItems = $rule->buyGetItems
            ->map(fn ($item) => $this->promoRuleItemPayload($item->product, $outletId, [
                'id' => $item->id,
                'role' => $item->role,
                'quantity' => (int) $item->quantity,
                'sort_order' => (int) $item->sort_order,
            ]))
            ->values();
        $bundleItems = $rule->bundleItems
            ->map(fn ($item) => $this->promoRuleItemPayload($item->product, $outletId, [
                'id' => $item->id,
                'quantity' => (int) $item->quantity,
                'sort_order' => (int) $item->sort_order,
            ]))
            ->values();

        $highlightProducts = $this->promoHighlightProducts($rule, $outletId);
        $heroProduct = collect($highlightProducts)->first();
        $pricing = $this->promoPricingPayload($rule, $outletId, $bundleItems, $buyGetItems);

        return [
            'id' => $rule->id,
            'name' => $rule->name,
            'kind' => $rule->kind,
            'priority' => (int) $rule->priority,
            'is_active' => (bool) $rule->is_active,
            'status' => $rule->currentStatusLabel(),
            'status_label' => $this->promoStatusLabel($rule),
            'target_type' => $rule->target_type,
            'customer_scope' => $rule->customer_scope,
            'eligible_loyalty_tiers' => $rule->eligible_loyalty_tiers ?? [],
            'discount_type' => $rule->discount_type,
            'discount_value' => $rule->discount_value !== null ? (float) $rule->discount_value : null,
            'price_basis' => $rule->price_basis ?: PricingRule::PRICE_BASIS_SELL_PRICE,
            'starts_at' => optional($rule->starts_at)->toISOString(),
            'ends_at' => optional($rule->ends_at)->toISOString(),
            'active_days' => $rule->active_days ?? [],
            'daily_start_time' => $rule->daily_start_time,
            'daily_end_time' => $rule->daily_end_time,
            'schedule' => [
                'is_scheduled' => $rule->isScheduled(),
                'is_expired' => $rule->isExpired(),
                'starts_at' => optional($rule->starts_at)->toISOString(),
                'ends_at' => optional($rule->ends_at)->toISOString(),
                'active_days' => $rule->active_days ?? [],
                'daily_start_time' => $rule->daily_start_time,
                'daily_end_time' => $rule->daily_end_time,
                'label' => $this->promoScheduleLabel($rule),
            ],
            'target' => [
                'product' => $rule->product ? $this->promoRuleProductPayload($rule->product, $outletId) : null,
                'category' => $rule->category ? [
                    'id' => $rule->category->id,
                    'name' => $rule->category->name,
                    'description' => $rule->category->description,
                    'image' => $rule->category->image,
                ] : null,
                'outlet' => $rule->outlet ? [
                    'id' => $rule->outlet->id,
                    'code' => $rule->outlet->code,
                    'slug' => $rule->outlet->slug,
                    'name' => $rule->outlet->name,
                ] : $this->outletPayload($outletId ? Outlet::find($outletId) : null),
            ],
            'qty_breaks' => $rule->qtyBreaks->map(fn ($break) => [
                'id' => $break->id,
                'min_qty' => (int) $break->min_qty,
                'discount_type' => $break->discount_type,
                'discount_value' => (float) $break->discount_value,
                'sort_order' => (int) $break->sort_order,
            ])->values()->all(),
            'bundle_items' => $bundleItems->all(),
            'buy_get_items' => $buyGetItems->all(),
            'buy_items' => $buyGetItems->where('role', 'buy')->values()->all(),
            'get_items' => $buyGetItems->where('role', 'get')->values()->all(),
            'pricing' => $pricing,
            'visual' => $this->promoVisualPayload($rule, $outletId, $bundleItems, $buyGetItems),
            'highlight_products' => $highlightProducts,
            'hero_image' => $heroProduct['image'] ?? null,
            'hero_product' => $heroProduct,
            'badge' => $this->promoBadgePayload($rule),
            'theme' => $this->promoThemePayload($rule),
            'cta' => [
                'label' => $this->promoCtaLabel($rule),
                'path' => '/promos/'.$rule->id,
            ],
            'catalog' => [
                'product_count' => count($highlightProducts),
                'has_visual_products' => count($highlightProducts) > 0,
                'supports_grid_card' => true,
                'supports_hero_banner' => true,
                'supports_carousel' => count($highlightProducts) > 1,
            ],
        ];
    }

    private function promoBannerPayload(PricingRule $rule, ?int $outletId): array
    {
        $promo = $this->promoRulePayload($rule, $outletId);

        return [
            'id' => $promo['id'],
            'name' => $promo['name'],
            'kind' => $promo['kind'],
            'headline' => $promo['visual']['headline'] ?? $promo['name'],
            'subheadline' => $promo['visual']['subheadline'] ?? null,
            'badge' => $promo['badge'],
            'theme' => $promo['theme'],
            'hero_image' => $promo['hero_image'],
            'hero_product' => $promo['hero_product'],
            'cta' => $promo['cta'],
            'schedule' => $promo['schedule'],
            'highlight_products' => $promo['highlight_products'],
        ];
    }

    private function promoCardSectionPayload(array $promo, string $section): array
    {
        return [
            'section' => $section,
            'id' => $promo['id'],
            'name' => $promo['name'],
            'kind' => $promo['kind'],
            'headline' => $promo['visual']['headline'] ?? $promo['name'],
            'subheadline' => $promo['visual']['subheadline'] ?? null,
            'badge' => $promo['badge'],
            'theme' => $promo['theme'],
            'hero_image' => $promo['hero_image'],
            'cta' => $promo['cta'],
            'visual' => $promo['visual'],
            'hero_product' => $promo['hero_product'],
            'highlight_products' => $promo['highlight_products'],
            'catalog' => $promo['catalog'],
        ];
    }

    private function promoVisualPayload(PricingRule $rule, ?int $outletId, Collection $bundleItems, Collection $buyGetItems): array
    {
        $buyItems = $buyGetItems->where('role', 'buy')->values();
        $getItems = $buyGetItems->where('role', 'get')->values();

        return match ($rule->kind) {
            PricingRule::KIND_BUY_X_GET_Y => [
                'type' => 'buy_get',
                'headline' => $rule->name,
                'subheadline' => $this->buildBuyGetHeadline($buyItems, $getItems),
                'buy_items' => $buyItems->all(),
                'get_items' => $getItems->all(),
                'display_price' => null,
                'display_discount' => null,
                'pill' => 'Buy X Get Y',
            ],
            PricingRule::KIND_BUNDLE_PRICE => [
                'type' => 'bundle',
                'headline' => $rule->name,
                'subheadline' => 'Bundle price Rp '.number_format((float) $rule->discount_value, 0, ',', '.'),
                'bundle_items' => $bundleItems->all(),
                'display_price' => (int) round((float) $rule->discount_value),
                'display_discount' => null,
                'pill' => 'Bundle',
            ],
            PricingRule::KIND_QTY_BREAK => [
                'type' => 'qty_break',
                'headline' => $rule->name,
                'subheadline' => $rule->qtyBreaks->map(fn ($break) => 'Min '.$break->min_qty)->implode(', '),
                'target_product' => $rule->product ? $this->promoRuleProductPayload($rule->product, $outletId) : null,
                'display_price' => null,
                'display_discount' => $rule->qtyBreaks->map(fn ($break) => [
                    'min_qty' => (int) $break->min_qty,
                    'discount_type' => $break->discount_type,
                    'discount_value' => (float) $break->discount_value,
                ])->values()->all(),
                'pill' => 'Qty Break',
            ],
            default => [
                'type' => 'standard_discount',
                'headline' => $rule->name,
                'subheadline' => $rule->target_type === PricingRule::TARGET_PRODUCT && $rule->product
                    ? $rule->product->title
                    : ($rule->category?->name ?? 'Promo produk'),
                'target_product' => $rule->product ? $this->promoRuleProductPayload($rule->product, $outletId) : null,
                'display_price' => $rule->discount_type === PricingRule::TYPE_FIXED_PRICE
                    ? (int) round((float) $rule->discount_value)
                    : null,
                'display_discount' => [
                    'discount_type' => $rule->discount_type,
                    'discount_value' => $rule->discount_value !== null ? (float) $rule->discount_value : null,
                ],
                'pill' => 'Promo',
            ],
        };
    }

    private function promoHighlightProducts(PricingRule $rule, ?int $outletId): array
    {
        $products = collect();

        if ($rule->product) {
            $products->push($rule->product);
        }

        if ($rule->target_type === PricingRule::TARGET_CATEGORY && $rule->category_id) {
            $products = $products->merge(
                Product::query()
                    ->where('category_id', $rule->category_id)
                    ->orderBy('title')
                    ->limit(6)
                    ->get(['id', 'title', 'sell_price', 'stock', 'category_id', 'image'])
            );
        }

        $products = $products
            ->merge($rule->bundleItems->pluck('product'))
            ->merge($rule->buyGetItems->pluck('product'))
            ->filter()
            ->unique('id')
            ->values();

        return $this->mapProductsWithPricing($products, $outletId)
            ->take(6)
            ->values()
            ->all();
    }

    private function promoRuleItemPayload(?Product $product, ?int $outletId, array $extra = []): ?array
    {
        if (! $product) {
            return null;
        }

        return array_merge(
            $extra,
            $this->promoRuleProductPayload($product, $outletId)
        );
    }

    private function promoRuleProductPayload(Product $product, ?int $outletId): array
    {
        $product->setAttribute('stock', $this->resolveProductStock($product, $outletId));

        return [
            'id' => $product->id,
            'title' => $product->title,
            'image' => $product->image,
            'sell_price' => (int) ($product->sell_price ?? 0),
            'buy_price' => (int) ($product->buy_price ?? 0),
            'original_price' => (int) ($product->sell_price ?? 0),
            'stock' => (int) ($product->stock ?? 0),
            'category_id' => (int) ($product->category_id ?? 0),
        ];
    }

    private function promoPricingPayload(
        PricingRule $rule,
        ?int $outletId,
        Collection $bundleItems,
        Collection $buyGetItems
    ): array {
        $priceBasis = $rule->price_basis ?: PricingRule::PRICE_BASIS_SELL_PRICE;

        return match ($rule->kind) {
            PricingRule::KIND_BUNDLE_PRICE => $this->bundlePromoPricingPayload($rule, $bundleItems, $priceBasis),
            PricingRule::KIND_BUY_X_GET_Y => $this->buyGetPromoPricingPayload($buyGetItems, $priceBasis),
            PricingRule::KIND_QTY_BREAK => $this->qtyBreakPromoPricingPayload($rule, $outletId, $priceBasis),
            default => $this->standardPromoPricingPayload($rule, $outletId, $priceBasis),
        };
    }

    private function standardPromoPricingPayload(PricingRule $rule, ?int $outletId, string $priceBasis): array
    {
        $product = $rule->product;
        if (! $product) {
            return $this->emptyPromoPricingPayload($priceBasis);
        }

        $pricing = $this->pricingService->calculateProductPrice(
            $product,
            1,
            rules: collect([$rule]),
            outletId: $outletId
        );

        $originalPrice = (int) ($pricing['base_unit_price'] ?? $this->resolvePromoBasePrice($product, $priceBasis));
        $promoPrice = (int) ($pricing['effective_unit_price'] ?? $originalPrice);
        $savingsAmount = max(0, $originalPrice - $promoPrice);

        return [
            'currency' => 'IDR',
            'price_basis' => $priceBasis,
            'quantity_context' => 1,
            'original_price' => $originalPrice,
            'promo_price' => $promoPrice,
            'savings_amount' => $savingsAmount,
            'savings_percentage' => $this->calculateSavingsPercentage($originalPrice, $savingsAmount),
            'discount_type' => $rule->discount_type,
            'discount_value' => $rule->discount_value !== null ? (float) $rule->discount_value : null,
            'tiers' => [],
        ];
    }

    private function qtyBreakPromoPricingPayload(PricingRule $rule, ?int $outletId, string $priceBasis): array
    {
        $product = $rule->product;
        if (! $product) {
            return $this->emptyPromoPricingPayload($priceBasis);
        }

        $tiers = $rule->qtyBreaks
            ->map(function ($break) use ($rule, $product, $outletId, $priceBasis) {
                $quantity = max(1, (int) $break->min_qty);
                $pricing = $this->pricingService->calculateProductPrice(
                    $product,
                    $quantity,
                    rules: collect([$rule]),
                    outletId: $outletId
                );
                $originalUnitPrice = (int) ($pricing['base_unit_price'] ?? $this->resolvePromoBasePrice($product, $priceBasis));
                $promoUnitPrice = (int) ($pricing['effective_unit_price'] ?? $originalUnitPrice);
                $originalTotal = $originalUnitPrice * $quantity;
                $promoTotal = (int) ($pricing['line_total'] ?? ($promoUnitPrice * $quantity));
                $savingsAmount = max(0, $originalTotal - $promoTotal);

                return [
                    'min_qty' => $quantity,
                    'original_unit_price' => $originalUnitPrice,
                    'promo_unit_price' => $promoUnitPrice,
                    'original_total' => $originalTotal,
                    'promo_total' => $promoTotal,
                    'savings_amount' => $savingsAmount,
                    'savings_percentage' => $this->calculateSavingsPercentage($originalTotal, $savingsAmount),
                    'discount_type' => $break->discount_type,
                    'discount_value' => (float) $break->discount_value,
                ];
            })
            ->values();

        $bestTier = $tiers->sortByDesc('savings_amount')->first();

        return [
            'currency' => 'IDR',
            'price_basis' => $priceBasis,
            'quantity_context' => $bestTier['min_qty'] ?? 1,
            'original_price' => $bestTier['original_total'] ?? null,
            'promo_price' => $bestTier['promo_total'] ?? null,
            'savings_amount' => $bestTier['savings_amount'] ?? 0,
            'savings_percentage' => $bestTier['savings_percentage'] ?? 0,
            'discount_type' => $rule->discount_type,
            'discount_value' => $rule->discount_value !== null ? (float) $rule->discount_value : null,
            'tiers' => $tiers->all(),
        ];
    }

    private function bundlePromoPricingPayload(PricingRule $rule, Collection $bundleItems, string $priceBasis): array
    {
        $originalPrice = (int) $bundleItems->sum(function (array $item) use ($priceBasis) {
            $unitPrice = $priceBasis === PricingRule::PRICE_BASIS_BUY_PRICE
                ? (int) ($item['buy_price'] ?? 0)
                : (int) ($item['sell_price'] ?? 0);

            return $unitPrice * max(1, (int) ($item['quantity'] ?? 1));
        });
        $promoPrice = max(0, (int) round((float) $rule->discount_value));
        $savingsAmount = max(0, $originalPrice - $promoPrice);

        return [
            'currency' => 'IDR',
            'price_basis' => $priceBasis,
            'quantity_context' => (int) $bundleItems->sum('quantity'),
            'original_price' => $originalPrice,
            'promo_price' => $promoPrice,
            'savings_amount' => $savingsAmount,
            'savings_percentage' => $this->calculateSavingsPercentage($originalPrice, $savingsAmount),
            'discount_type' => $rule->discount_type,
            'discount_value' => $rule->discount_value !== null ? (float) $rule->discount_value : null,
            'tiers' => [],
        ];
    }

    private function buyGetPromoPricingPayload(Collection $buyGetItems, string $priceBasis): array
    {
        $originalPrice = (int) $buyGetItems->sum(function (array $item) use ($priceBasis) {
            $unitPrice = $priceBasis === PricingRule::PRICE_BASIS_BUY_PRICE
                ? (int) ($item['buy_price'] ?? 0)
                : (int) ($item['sell_price'] ?? 0);

            return $unitPrice * max(1, (int) ($item['quantity'] ?? 1));
        });
        $buyTotal = (int) $buyGetItems
            ->where('role', 'buy')
            ->sum(function (array $item) use ($priceBasis) {
                $unitPrice = $priceBasis === PricingRule::PRICE_BASIS_BUY_PRICE
                    ? (int) ($item['buy_price'] ?? 0)
                    : (int) ($item['sell_price'] ?? 0);

                return $unitPrice * max(1, (int) ($item['quantity'] ?? 1));
            });
        $savingsAmount = max(0, $originalPrice - $buyTotal);

        return [
            'currency' => 'IDR',
            'price_basis' => $priceBasis,
            'quantity_context' => (int) $buyGetItems->sum('quantity'),
            'original_price' => $originalPrice,
            'promo_price' => $buyTotal,
            'savings_amount' => $savingsAmount,
            'savings_percentage' => $this->calculateSavingsPercentage($originalPrice, $savingsAmount),
            'discount_type' => PricingRule::TYPE_FIXED_AMOUNT,
            'discount_value' => (float) $savingsAmount,
            'tiers' => [],
        ];
    }

    private function emptyPromoPricingPayload(string $priceBasis): array
    {
        return [
            'currency' => 'IDR',
            'price_basis' => $priceBasis,
            'quantity_context' => 1,
            'original_price' => null,
            'promo_price' => null,
            'savings_amount' => 0,
            'savings_percentage' => 0,
            'discount_type' => null,
            'discount_value' => null,
            'tiers' => [],
        ];
    }

    private function resolvePromoBasePrice(Product $product, string $priceBasis): int
    {
        return match ($priceBasis) {
            PricingRule::PRICE_BASIS_BUY_PRICE => (int) ($product->buy_price ?? 0),
            default => (int) ($product->sell_price ?? 0),
        };
    }

    private function calculateSavingsPercentage(?int $originalPrice, int $savingsAmount): float
    {
        if (! $originalPrice || $originalPrice <= 0 || $savingsAmount <= 0) {
            return 0;
        }

        return round(($savingsAmount / $originalPrice) * 100, 2);
    }

    private function buildBuyGetHeadline(Collection $buyItems, Collection $getItems): string
    {
        $buyLabel = $buyItems->map(fn (array $item) => $item['quantity'].'x '.$item['title'])->implode(' + ');
        $getLabel = $getItems->map(fn (array $item) => $item['quantity'].'x '.$item['title'])->implode(' + ');

        if ($buyLabel === '' || $getLabel === '') {
            return 'Buy X Get Y';
        }

        return 'Beli '.$buyLabel.', gratis '.$getLabel;
    }

    private function filterPromoRules(Collection $rules, Request $request): Collection
    {
        return $rules
            ->when(
                $request->filled('kind'),
                fn (Collection $collection) => $collection->where('kind', $request->string('kind')->toString())
            )
            ->when(
                $request->filled('target_type'),
                fn (Collection $collection) => $collection->where('target_type', $request->string('target_type')->toString())
            )
            ->values();
    }

    private function promoBadgePayload(PricingRule $rule): array
    {
        return match ($rule->kind) {
            PricingRule::KIND_BUY_X_GET_Y => ['text' => 'Buy X Get Y', 'tone' => 'success'],
            PricingRule::KIND_BUNDLE_PRICE => ['text' => 'Bundle', 'tone' => 'accent'],
            PricingRule::KIND_QTY_BREAK => ['text' => 'Grosir', 'tone' => 'warning'],
            default => ['text' => 'Promo', 'tone' => 'danger'],
        };
    }

    private function promoThemePayload(PricingRule $rule): array
    {
        return match ($rule->kind) {
            PricingRule::KIND_BUY_X_GET_Y => ['key' => 'emerald', 'background' => 'linear-gradient(135deg, #065f46, #10b981)', 'text' => '#ecfdf5'],
            PricingRule::KIND_BUNDLE_PRICE => ['key' => 'amber', 'background' => 'linear-gradient(135deg, #92400e, #f59e0b)', 'text' => '#fff7ed'],
            PricingRule::KIND_QTY_BREAK => ['key' => 'sky', 'background' => 'linear-gradient(135deg, #0c4a6e, #38bdf8)', 'text' => '#f0f9ff'],
            default => ['key' => 'rose', 'background' => 'linear-gradient(135deg, #9f1239, #fb7185)', 'text' => '#fff1f2'],
        };
    }

    private function promoCtaLabel(PricingRule $rule): string
    {
        return match ($rule->kind) {
            PricingRule::KIND_BUY_X_GET_Y => 'Lihat Buy/Get',
            PricingRule::KIND_BUNDLE_PRICE => 'Lihat Bundle',
            PricingRule::KIND_QTY_BREAK => 'Lihat Harga Grosir',
            default => 'Lihat Promo',
        };
    }

    private function promoStatusLabel(PricingRule $rule): string
    {
        return match ($rule->currentStatusLabel()) {
            'scheduled' => 'Scheduled',
            'expired' => 'Expired',
            'inactive' => 'Inactive',
            default => 'Active',
        };
    }

    private function promoScheduleLabel(PricingRule $rule): string
    {
        $parts = [];

        if ($rule->starts_at || $rule->ends_at) {
            $start = optional($rule->starts_at)?->format('Y-m-d H:i');
            $end = optional($rule->ends_at)?->format('Y-m-d H:i');
            $parts[] = trim(($start ? 'Mulai '.$start : '').($end ? ' s/d '.$end : ''));
        }

        if (! empty($rule->active_days)) {
            $parts[] = 'Hari: '.implode(', ', $rule->active_days);
        }

        if ($rule->daily_start_time || $rule->daily_end_time) {
            $parts[] = 'Jam: '.trim(($rule->daily_start_time ?: '--:--:--').' - '.($rule->daily_end_time ?: '--:--:--'));
        }

        return $parts !== [] ? implode(' | ', $parts) : 'Selalu aktif selama rule aktif';
    }

    private function resolveOutlet(Request $request): ?Outlet
    {
        if ($request->filled('outlet_id')) {
            return Outlet::query()->active()->find((int) $request->input('outlet_id'));
        }

        if ($request->filled('outlet_code')) {
            return Outlet::query()->active()->where('code', $request->string('outlet_code')->toString())->first();
        }

        if ($request->filled('outlet_slug')) {
            return Outlet::query()->active()->where('slug', $request->string('outlet_slug')->toString())->first();
        }

        return Outlet::query()
            ->active()
            ->orderByDesc('is_default')
            ->orderBy('sort_order')
            ->first();
    }

    private function resolveProductStock(Product $product, ?int $outletId): int
    {
        return (int) ($product->stock ?? 0);
    }

    private function outletPayload(?Outlet $outlet): ?array
    {
        return $outlet?->profilePayload();
    }

    private function hasOutletStockTable(): bool
    {
        return Schema::hasTable('product_outlet_stocks');
    }
}
