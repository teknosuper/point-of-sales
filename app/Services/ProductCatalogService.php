<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Product;
use Illuminate\Support\Collection;

class ProductCatalogService
{
    public function __construct(
        private readonly PricingService $pricingService
    ) {}

    public function mapProductsForPosGrid(
        Collection $products,
        ?Customer $customer = null,
        ?int $outletId = null,
        array $options = []
    ): Collection {
        $pricingBadges = $this->pricingService->previewProducts(
            $products,
            $customer,
            outletId: $outletId
        );
        $soldQtyByProduct = collect($options['soldQtyByProduct'] ?? []);
        $includeKitchenStations = (bool) ($options['includeKitchenStations'] ?? false);

        return $products->map(function (Product $product) use ($pricingBadges, $soldQtyByProduct, $includeKitchenStations) {
            $pricing = $pricingBadges->get($product->id);
            $pricingRule = $pricing['pricing_rule'] ?? null;

            $payload = [
                'id' => $product->id,
                'title' => $product->title,
                'description' => $product->description,
                'image' => $product->image,
                'barcode' => $product->barcode,
                'sku' => $product->sku,
                'buy_price' => (int) ($product->buy_price ?? 0),
                'sell_price' => (int) ($product->sell_price ?? 0),
                'stock' => (int) ($product->stock ?? 0),
                'category_id' => $product->category_id,
                'tenant_outlet_id' => $product->tenant_outlet_id,
                'supports_modifiers' => (bool) $product->supports_modifiers,
                'sold_qty' => (int) ($soldQtyByProduct[$product->id] ?? 0),
                'effective_price' => (int) ($pricing['effective_unit_price'] ?? $product->sell_price),
                'promo_discount_total' => (int) ($pricing['line_discount_total'] ?? 0),
                'category' => $product->category ? [
                    'id' => $product->category->id,
                    'name' => $product->category->name,
                    'description' => $product->category->description,
                    'image' => $product->category->image,
                ] : null,
                'tenant_outlet' => $product->tenantOutlet ? [
                    'id' => $product->tenantOutlet->id,
                    'name' => $product->tenantOutlet->name,
                    'code' => $product->tenantOutlet->code,
                    'slug' => $product->tenantOutlet->slug,
                    'sort_order' => (int) ($product->tenantOutlet->sort_order ?? 0),
                ] : null,
                'modifier_options' => $product->modifierOptions
                    ->where('is_active', true)
                    ->map(fn ($option) => [
                        'id' => $option->id,
                        'name' => $option->name,
                        'price' => (int) $option->price,
                    ])
                    ->values()
                    ->all(),
                'pricing_badge' => $pricing && $pricingRule ? [
                    'id' => $pricingRule['id'] ?? null,
                    'name' => $pricingRule['name'] ?? null,
                    'kind' => $pricingRule['kind'] ?? null,
                    'label' => $pricingRule['label'] ?? null,
                    'detail' => $pricingRule['detail'] ?? null,
                    'rule_name' => $pricingRule['name'] ?? null,
                    'pricing_rule' => $pricingRule,
                    'customer_scope' => $pricingRule['customer_scope'] ?? null,
                    'price_basis' => $pricingRule['price_basis'] ?? null,
                    'base_price' => (int) ($pricing['base_unit_price'] ?? $product->sell_price),
                    'promo_price' => ($pricingRule['price_context'] ?? false)
                        ? (int) ($pricing['effective_unit_price'] ?? $product->sell_price)
                        : null,
                ] : null,
            ];

            if ($includeKitchenStations) {
                $payload['kitchen_stations'] = $product->kitchenStationMappings
                    ->where('is_active', true)
                    ->sortBy('priority')
                    ->map(fn ($mapping) => [
                        'id' => $mapping->kitchenStation?->id,
                        'name' => $mapping->kitchenStation?->name,
                        'code' => $mapping->kitchenStation?->code,
                    ])
                    ->filter(fn (array $station) => filled($station['name']))
                    ->values()
                    ->all();
            }

            return $payload;
        })->values();
    }
}
