<?php

namespace App\Observers;

use App\Models\Product;
use App\Services\PricingCacheService;

class ProductObserver
{
    public function __construct(
        private readonly PricingCacheService $pricingCacheService
    ) {}

    public function created(Product $product): void
    {
        $this->pricingCacheService->bustActiveRules();
    }

    public function updated(Product $product): void
    {
        if ($product->wasChanged([
            'title',
            'image',
            'tenant_hpp_price',
            'buy_price',
            'sell_price',
            'tenant_discount_price',
            'category_id',
        ])) {
            $this->pricingCacheService->bustActiveRules();
        }
    }

    public function deleted(Product $product): void
    {
        $this->pricingCacheService->bustActiveRules();
    }

    public function restored(Product $product): void
    {
        $this->pricingCacheService->bustActiveRules();
    }

    public function forceDeleted(Product $product): void
    {
        $this->pricingCacheService->bustActiveRules();
    }
}
