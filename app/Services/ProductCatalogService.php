<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Product;
use App\Models\Setting;
use Illuminate\Support\Collection;

class ProductCatalogService
{
    public function __construct(
        private readonly PricingService $pricingService,
        private readonly ModifierMarkupService $modifierMarkupService
    ) {}

    /**
     * Resolve the operational status of an outlet.
     * Returns null if the outlet is open and within operating hours.
     * Returns a reason string if closed or outside hours.
     */
    public function resolveOutletClosedReason(int $outletId): ?string
    {
        $isOpen = Setting::getBool('daily_store_open', true, $outletId);

        if (! $isOpen) {
            return 'store_closed';
        }

        $openTime  = Setting::get('daily_store_open_time', '', $outletId);
        $closeTime = Setting::get('daily_store_close_time', '', $outletId);

        if (filled($openTime) && filled($closeTime)) {
            $now       = now()->format('H:i');
            $isWithin  = $now >= $openTime && $now <= $closeTime;

            if (! $isWithin) {
                return 'outside_hours';
            }
        }

        return null;
    }

    /**
     * Batch-resolve closed reasons for a list of tenant outlet IDs.
     * Returns a map of [outlet_id => reason|null].
     */
    public function batchResolveClosedReasons(Collection $tenantOutletIds): array
    {
        $reasons = [];
        foreach ($tenantOutletIds->unique()->filter() as $id) {
            $reasons[(int) $id] = $this->resolveOutletClosedReason((int) $id);
        }

        return $reasons;
    }

    public function mapProductsForPosGrid(
        Collection $products,
        ?Customer $customer = null,
        ?int $outletId = null,
        array $options = []
    ): Collection {
        $includePricingBadges = (bool) ($options['includePricingBadges'] ?? true);
        $pricingBadges = $includePricingBadges
            ? $this->pricingService->previewProducts(
                $products,
                $customer,
                outletId: $outletId
            )
            : collect();
        $soldQtyByProduct = collect($options['soldQtyByProduct'] ?? []);
        $includeKitchenStations = (bool) ($options['includeKitchenStations'] ?? false);

        // Batch-resolve operational status per tenant outlet (avoid N+1)
        $tenantOutletIds = $products->pluck('tenant_outlet_id')->filter()->unique();
        $closedReasonsByTenant = $this->batchResolveClosedReasons($tenantOutletIds);

        return $products->map(function (Product $product) use ($pricingBadges, $soldQtyByProduct, $includeKitchenStations, $outletId, $closedReasonsByTenant) {
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
                'requires_modifier_selection' => (bool) $product->requires_modifier_selection,
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
                    ->map(fn ($option) => $this->modifierMarkupService->payloadForOption($option, $outletId))
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
                // null = open/available, 'store_closed' = tutup hari ini, 'outside_hours' = di luar jam operasional
                'store_closed_reason' => $product->tenant_outlet_id
                    ? ($closedReasonsByTenant[(int) $product->tenant_outlet_id] ?? null)
                    : null,
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
