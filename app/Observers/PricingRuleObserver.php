<?php

namespace App\Observers;

use App\Models\PricingRule;
use App\Services\PricingCacheService;

class PricingRuleObserver
{
    public function __construct(
        private readonly PricingCacheService $pricingCacheService
    ) {}

    public function saved(PricingRule $pricingRule): void
    {
        $this->pricingCacheService->bustActiveRules();
    }

    public function deleted(PricingRule $pricingRule): void
    {
        $this->pricingCacheService->bustActiveRules();
    }

    public function restored(PricingRule $pricingRule): void
    {
        $this->pricingCacheService->bustActiveRules();
    }

    public function forceDeleted(PricingRule $pricingRule): void
    {
        $this->pricingCacheService->bustActiveRules();
    }
}
