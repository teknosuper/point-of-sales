<?php

namespace App\Providers;

use App\Models\PricingRule;
use App\Models\PricingRuleBundleItem;
use App\Models\PricingRuleBuyGetItem;
use App\Models\PricingRuleQtyBreak;
use App\Models\Product;
use App\Observers\PricingRuleObserver;
use App\Observers\PricingRuleRelationObserver;
use App\Observers\ProductObserver;
use App\Support\ProductionSecurityBaseline;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Product::observe(ProductObserver::class);
        PricingRule::observe(PricingRuleObserver::class);
        PricingRuleQtyBreak::observe(PricingRuleRelationObserver::class);
        PricingRuleBundleItem::observe(PricingRuleRelationObserver::class);
        PricingRuleBuyGetItem::observe(PricingRuleRelationObserver::class);

        $issues = ProductionSecurityBaseline::issues();

        if ($issues !== []) {
            Log::warning('Production security baseline check failed.', [
                'issues' => $issues,
            ]);
        }
    }
}
