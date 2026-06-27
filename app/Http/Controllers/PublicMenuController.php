<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Outlet;
use App\Models\PricingRule;
use App\Models\Product;
use App\Models\ProductOutletStock;
use App\Models\TransactionDetail;
use App\Services\ProductCatalogService;
use App\Services\PricingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class PublicMenuController extends Controller
{
    public function __construct(
        private readonly PricingService $pricingService,
        private readonly ProductCatalogService $productCatalogService,
    ) {}

    public function index(Request $request)
    {
        $outlet = $this->resolveOutlet($request);
        $outletId = $outlet?->id;

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

        $rules = $this->pricingService->getActiveRules(outletId: $outletId);

        $promoSummary = [
            'active_rules_count' => $rules->count(),
            'rule_kinds' => $rules->pluck('kind')->unique()->values()->all(),
            'counts_by_kind' => $rules->groupBy('kind')->map->count()->all(),
        ];

        $storeName = config('app.name', 'Toko');
        if ($outlet) {
            $storeName = $outlet->name ?? $storeName;
        }

        $tenants = Outlet::whereIn('id', Product::whereNotNull('tenant_outlet_id')->distinct()->pluck('tenant_outlet_id'))
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'name', 'sort_order']);

        return inertia('Public/MenuCatalog', [
            'categories' => $categories,
            'promoSummary' => $promoSummary,
            'outlet' => $outlet ? [
                'id' => $outlet->id,
                'name' => $outlet->name,
                'code' => $outlet->code,
                'sort_order' => (int) $outlet->sort_order,
            ] : null,
            'store' => [
                'name' => $storeName,
                'logo' => null,
            ],
            'tenants' => $tenants,
        ]);
    }

    public function products(Request $request)
    {
        $outlet = $this->resolveOutlet($request);
        $outletId = $outlet?->id;

        $query = Product::query()
            ->with([
                'category:id,name,description,image',
                'tenantOutlet:id,code,slug,name,sort_order',
                'modifierOptions',
            ])
            ->select([
                'id', 'image', 'barcode', 'sku', 'title', 'description',
                'buy_price', 'sell_price', 'stock', 'category_id',
                'tenant_outlet_id', 'supports_modifiers', 'requires_modifier_selection', 'created_at',
            ])
            ->when($request->filled('search'), fn ($b) => $b->where(fn ($q) => $q
                ->where('title', 'like', '%'.trim((string) $request->input('search')).'%')
                ->orWhere('sku', 'like', '%'.trim((string) $request->input('search')).'%')
                ->orWhere('barcode', 'like', '%'.trim((string) $request->input('search')).'%')
            ))
            ->when($request->filled('category_id'), fn ($b) => $b->where('category_id', (int) $request->input('category_id')))
            ->when($request->filled('tenant_outlet_id'), fn ($b) => $b->where('tenant_outlet_id', (int) $request->input('tenant_outlet_id')))
            ->orderBy('title');

        if ($request->has('include_out_of_stock') && !$request->boolean('include_out_of_stock')) {
            $query->where('stock', '>', 0);
        }

        $products = $query->get()->map(function (Product $p) {
            $p->setAttribute('stock', (int) ($p->stock ?? 0));
            return $p;
        })->values();

        $soldQtyByProduct = TransactionDetail::query()
            ->selectRaw('product_id, SUM(qty) as sold_qty')
            ->whereNotNull('product_id')
            ->when(
                Schema::hasColumn('transaction_details', 'is_promo_reward'),
                fn ($builder) => $builder->where('is_promo_reward', false)
            )
            ->whereHas('transaction', fn ($builder) => $builder
                ->when($outletId, fn ($query) => $query->where('outlet_id', $outletId)))
            ->groupBy('product_id')
            ->pluck('sold_qty', 'product_id');

        $mapped = $this->productCatalogService
            ->mapProductsForPosGrid($products, null, $outletId, [
                'soldQtyByProduct' => $soldQtyByProduct,
            ])
            ->map(fn (array $product) => [
                ...$product,
                'created_at' => optional(
                    $products->firstWhere('id', $product['id'])?->created_at
                )->toISOString(),
            ])
            ->values();

        if ($request->boolean('promo_only')) {
            $mapped = $mapped->filter(fn (array $p) => $p['pricing_badge'] !== null)->values();
        }

        $sort = $request->string('sort')->toString();
        $mapped = match ($sort) {
            'price_low' => $mapped->sortBy('effective_price')->values(),
            'price_high' => $mapped->sortByDesc('effective_price')->values(),
            'latest' => $mapped->sortByDesc('created_at')->values(),
            'promo_first' => $mapped->sortByDesc(fn (array $p) => $p['pricing_badge'] !== null)->values(),
            default => $mapped->sortBy('title')->values(),
        };

        return response()->json([
            'data' => $mapped->values()->all(),
            'meta' => ['total' => $mapped->count(), 'has_promos' => $mapped->contains(fn (array $p) => $p['pricing_badge'] !== null)],
        ]);
    }

    public function promos(Request $request)
    {
        $outlet = $this->resolveOutlet($request);
        $rules = $this->pricingService->getActiveRules(outletId: $outlet?->id);

        $payload = $rules->map(fn (PricingRule $r) => [
            'id' => $r->id,
            'name' => $r->name,
            'kind' => $r->kind,
            'discount_type' => $r->discount_type,
            'discount_value' => $r->discount_value !== null ? (float) $r->discount_value : null,
            'starts_at' => optional($r->starts_at)->toISOString(),
            'ends_at' => optional($r->ends_at)->toISOString(),
            'badge' => match ($r->kind) {
                PricingRule::KIND_BUY_X_GET_Y => ['text' => 'Buy X Get Y', 'tone' => 'success'],
                PricingRule::KIND_BUNDLE_PRICE => ['text' => 'Bundle', 'tone' => 'accent'],
                PricingRule::KIND_QTY_BREAK => ['text' => 'Grosir', 'tone' => 'warning'],
                default => ['text' => 'Promo', 'tone' => 'danger'],
            },
            'hero_image' => $r->product?->image,
            'hero_product' => $r->product ? ['id' => $r->product->id, 'title' => $r->product->title, 'sell_price' => (int) $r->product->sell_price, 'image' => $r->product->image] : null,
        ])->values();

        return response()->json(['data' => $payload, 'meta' => ['total' => $payload->count()]]);
    }

    private function resolveOutlet(Request $request): ?Outlet
    {
        $code = $request->string('outlet_code')->toString();
        if ($code) {
            return Outlet::where('code', $code)->active()->first();
        }
        return Outlet::where('outlet_type', '!=', 'tenant')->active()->orderBy('name')->first();
    }

    private function hasOutletStockTable(): bool
    {
        return Schema::hasTable('product_outlet_stocks');
    }
}
