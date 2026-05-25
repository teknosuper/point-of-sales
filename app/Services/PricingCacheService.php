<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;

class PricingCacheService
{
    private const ACTIVE_RULES_VERSION_KEY = 'pricing-rules:active:version';

    public function activeRulesVersion(): int
    {
        return max(1, (int) Cache::get(self::ACTIVE_RULES_VERSION_KEY, 1));
    }

    public function bustActiveRules(): int
    {
        $current = $this->activeRulesVersion();
        $next = $current + 1;

        Cache::forever(self::ACTIVE_RULES_VERSION_KEY, $next);

        return $next;
    }
}
