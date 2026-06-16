<?php

namespace Database\Seeders;

use App\Models\PricingRule;
use App\Models\Product;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Schema;

class DemoPricingRuleSeeder extends Seeder
{
    public function run(): void
    {
        if (! $this->requiredTablesReady()) {
            $this->command?->warn('Skipping DemoPricingRuleSeeder because pricing tables are not ready.');

            return;
        }

        $products = Product::query()
            ->with('tenantOutlet:id,name')
            ->where('barcode', 'like', 'FC-%')
            ->whereNotNull('tenant_outlet_id')
            ->orderBy('tenant_outlet_id')
            ->orderBy('barcode')
            ->get()
            ->groupBy('tenant_outlet_id');

        if ($products->isEmpty()) {
            $this->command?->warn('Skipping DemoPricingRuleSeeder because demo products are missing.');

            return;
        }

        $creatorId = User::query()
            ->whereIn('email', ['saifulbahri@gtc-center.my.id', 'admin.outlet@gtc-center.my.id'])
            ->value('id');

        PricingRule::query()
            ->where('name', 'like', 'DEMO %')
            ->get()
            ->each(function (PricingRule $rule) {
                $rule->qtyBreaks()->delete();
                $rule->bundleItems()->delete();
                $rule->buyGetItems()->delete();
                $rule->delete();
            });

        foreach ($products as $tenantProducts) {
            $items = $tenantProducts->values();
            if ($items->isEmpty()) {
                continue;
            }

            $tenantOutletId = (int) ($items->first()->tenant_outlet_id ?? 0);
            $tenantName = $items->first()->tenantOutlet?->name ?? 'Tenant';
            $featuredProduct = $items->get(0);
            $qtyBreakProduct = $items->get(1) ?? $featuredProduct;

            if ($featuredProduct) {
                PricingRule::query()->updateOrCreate(
                    [
                        'outlet_id' => $tenantOutletId,
                        'name' => 'DEMO Promo '.$tenantName.' - Featured',
                    ],
                    [
                        'kind' => PricingRule::KIND_STANDARD_DISCOUNT,
                        'is_active' => true,
                        'priority' => 220,
                        'target_type' => PricingRule::TARGET_PRODUCT,
                        'product_id' => $featuredProduct->id,
                        'category_id' => null,
                        'customer_scope' => PricingRule::SCOPE_ALL,
                        'discount_type' => PricingRule::TYPE_PERCENTAGE,
                        'discount_value' => 10,
                        'price_basis' => PricingRule::PRICE_BASIS_SELL_PRICE,
                        'starts_at' => now()->subDay(),
                        'ends_at' => now()->addMonths(3),
                        'active_days' => [
                            PricingRule::DAY_SUNDAY,
                            PricingRule::DAY_MONDAY,
                            PricingRule::DAY_TUESDAY,
                            PricingRule::DAY_WEDNESDAY,
                            PricingRule::DAY_THURSDAY,
                            PricingRule::DAY_FRIDAY,
                            PricingRule::DAY_SATURDAY,
                        ],
                        'daily_start_time' => '00:00:00',
                        'daily_end_time' => '23:59:00',
                        'preview_quantity_multiplier' => 1,
                        'notes' => 'Promo demo featured untuk '.$tenantName.'.',
                        'created_by' => $creatorId,
                    ]
                );
            }

            if ($qtyBreakProduct) {
                $qtyBreakRule = PricingRule::query()->updateOrCreate(
                    [
                        'outlet_id' => $tenantOutletId,
                        'name' => 'DEMO Grosir '.$tenantName.' - Qty Break',
                    ],
                    [
                        'kind' => PricingRule::KIND_QTY_BREAK,
                        'is_active' => true,
                        'priority' => 210,
                        'target_type' => PricingRule::TARGET_PRODUCT,
                        'product_id' => $qtyBreakProduct->id,
                        'category_id' => null,
                        'customer_scope' => PricingRule::SCOPE_ALL,
                        'discount_type' => PricingRule::TYPE_PERCENTAGE,
                        'discount_value' => 0,
                        'price_basis' => PricingRule::PRICE_BASIS_SELL_PRICE,
                        'starts_at' => now()->subDay(),
                        'ends_at' => now()->addMonths(3),
                        'active_days' => [
                            PricingRule::DAY_SUNDAY,
                            PricingRule::DAY_MONDAY,
                            PricingRule::DAY_TUESDAY,
                            PricingRule::DAY_WEDNESDAY,
                            PricingRule::DAY_THURSDAY,
                            PricingRule::DAY_FRIDAY,
                            PricingRule::DAY_SATURDAY,
                        ],
                        'daily_start_time' => '00:00:00',
                        'daily_end_time' => '23:59:00',
                        'preview_quantity_multiplier' => 3,
                        'notes' => 'Promo qty break demo untuk '.$tenantName.'.',
                        'created_by' => $creatorId,
                    ]
                );

                $qtyBreakRule->qtyBreaks()->delete();
                $qtyBreakRule->qtyBreaks()->createMany([
                    [
                        'min_qty' => 2,
                        'discount_type' => PricingRule::TYPE_PERCENTAGE,
                        'discount_value' => 5,
                        'sort_order' => 1,
                    ],
                    [
                        'min_qty' => 3,
                        'discount_type' => PricingRule::TYPE_PERCENTAGE,
                        'discount_value' => 10,
                        'sort_order' => 2,
                    ],
                ]);
            }
        }

        $this->command?->info('Two demo pricing rules seeded for each tenant kitchen.');
    }

    private function requiredTablesReady(): bool
    {
        return Schema::hasTable('pricing_rules')
            && Schema::hasTable('pricing_rule_qty_breaks')
            && Schema::hasTable('pricing_rule_bundle_items')
            && Schema::hasTable('pricing_rule_buy_get_items')
            && Schema::hasColumn('pricing_rules', 'kind')
            && Schema::hasColumn('pricing_rules', 'outlet_id')
            && Schema::hasColumn('pricing_rules', 'price_basis');
    }
}
