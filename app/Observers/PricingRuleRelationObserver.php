<?php

namespace App\Observers;

use App\Models\PricingRuleBundleItem;
use App\Models\PricingRuleBuyGetItem;
use App\Models\PricingRuleQtyBreak;
use App\Services\PricingCacheService;

class PricingRuleRelationObserver
{
    public function __construct(
        private readonly PricingCacheService $pricingCacheService
    ) {}

    public function saved(PricingRuleQtyBreak|PricingRuleBundleItem|PricingRuleBuyGetItem $model): void
    {
        $this->pricingCacheService->bustActiveRules();
    }

    public function deleted(PricingRuleQtyBreak|PricingRuleBundleItem|PricingRuleBuyGetItem $model): void
    {
        $this->pricingCacheService->bustActiveRules();
    }

    public function restored(PricingRuleQtyBreak|PricingRuleBundleItem|PricingRuleBuyGetItem $model): void
    {
        $this->pricingCacheService->bustActiveRules();
    }

    public function forceDeleted(PricingRuleQtyBreak|PricingRuleBundleItem|PricingRuleBuyGetItem $model): void
    {
        $this->pricingCacheService->bustActiveRules();
    }
}
