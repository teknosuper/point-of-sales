<?php

namespace Database\Seeders;

use App\Models\Outlet;
use App\Models\PricingRule;
use App\Models\PricingRuleBuyGetItem;
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
            ->with('tenantOutlet:id,name,code')
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
            ->whereIn('email', ['admin.outlet@gmail.com', 'arya@gmail.com'])
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

            $tenantName = $items->first()->tenantOutlet?->name ?? 'Tenant';
            $tenantOutletId = (int) ($items->first()->tenant_outlet_id ?? 0);

            foreach ($items->chunk(4) as $chunkIndex => $chunk) {
                $productOne = $chunk->get(0);
                $productTwo = $chunk->get(1);
                $productThree = $chunk->get(2);
                $productFour = $chunk->get(3);
                $chunkLabel = $items->count() > 4 ? ' Batch '.($chunkIndex + 1) : '';

                if ($productOne) {
                    PricingRule::query()->updateOrCreate(
                        ['outlet_id' => $tenantOutletId, 'name' => 'DEMO Promo '.$tenantName.$chunkLabel.' - '.$productOne->title],
                        [
                            'kind' => PricingRule::KIND_STANDARD_DISCOUNT,
                            'is_active' => true,
                            'priority' => 220,
                            'target_type' => PricingRule::TARGET_PRODUCT,
                            'product_id' => $productOne->id,
                            'category_id' => null,
                            'customer_scope' => PricingRule::SCOPE_ALL,
                            'discount_type' => PricingRule::TYPE_PERCENTAGE,
                            'discount_value' => 15,
                            'price_basis' => PricingRule::PRICE_BASIS_BUY_PRICE,
                            'starts_at' => now()->subDays(2),
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
                            'notes' => 'Promo persentase demo untuk '.$tenantName.'.',
                            'created_by' => $creatorId,
                        ]
                    );
                }

                if ($productTwo) {
                    PricingRule::query()->updateOrCreate(
                        ['outlet_id' => $tenantOutletId, 'name' => 'DEMO Hemat '.$tenantName.$chunkLabel.' - '.$productTwo->title],
                        [
                            'kind' => PricingRule::KIND_STANDARD_DISCOUNT,
                            'is_active' => true,
                            'priority' => 215,
                            'target_type' => PricingRule::TARGET_PRODUCT,
                            'product_id' => $productTwo->id,
                            'category_id' => null,
                            'customer_scope' => PricingRule::SCOPE_ALL,
                            'discount_type' => PricingRule::TYPE_FIXED_AMOUNT,
                            'discount_value' => min(2000, max(1000, (int) $productTwo->sell_price - 1000)),
                            'price_basis' => PricingRule::PRICE_BASIS_BUY_PRICE,
                            'starts_at' => now()->subDays(2),
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
                            'notes' => 'Promo potongan nominal demo untuk '.$tenantName.'.',
                            'created_by' => $creatorId,
                        ]
                    );
                }

                if ($productThree) {
                    $qtyBreakRule = PricingRule::query()->updateOrCreate(
                        ['outlet_id' => $tenantOutletId, 'name' => 'DEMO Grosir '.$tenantName.$chunkLabel.' - '.$productThree->title],
                        [
                            'kind' => PricingRule::KIND_QTY_BREAK,
                            'is_active' => true,
                            'priority' => 210,
                            'target_type' => PricingRule::TARGET_PRODUCT,
                            'product_id' => $productThree->id,
                            'category_id' => null,
                            'customer_scope' => PricingRule::SCOPE_ALL,
                            'discount_type' => PricingRule::TYPE_PERCENTAGE,
                            'discount_value' => 0,
                            'price_basis' => PricingRule::PRICE_BASIS_BUY_PRICE,
                            'starts_at' => now()->subDays(2),
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
                        ['min_qty' => 2, 'discount_type' => PricingRule::TYPE_PERCENTAGE, 'discount_value' => 10, 'sort_order' => 1],
                        ['min_qty' => 3, 'discount_type' => PricingRule::TYPE_PERCENTAGE, 'discount_value' => 15, 'sort_order' => 2],
                    ]);
                }

                if ($productFour) {
                    PricingRule::query()->updateOrCreate(
                        ['outlet_id' => $tenantOutletId, 'name' => 'DEMO Harga Spesial '.$tenantName.$chunkLabel.' - '.$productFour->title],
                        [
                            'kind' => PricingRule::KIND_STANDARD_DISCOUNT,
                            'is_active' => true,
                            'priority' => 205,
                            'target_type' => PricingRule::TARGET_PRODUCT,
                            'product_id' => $productFour->id,
                            'category_id' => null,
                            'customer_scope' => PricingRule::SCOPE_ALL,
                            'discount_type' => PricingRule::TYPE_FIXED_PRICE,
                            'discount_value' => max(1000, (int) $productFour->sell_price - 2000),
                            'price_basis' => PricingRule::PRICE_BASIS_BUY_PRICE,
                            'starts_at' => now()->subDays(2),
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
                            'notes' => 'Harga spesial demo untuk '.$tenantName.'.',
                            'created_by' => $creatorId,
                        ]
                    );
                }

                if ($productOne && $productTwo) {
                    $bundleRule = PricingRule::query()->updateOrCreate(
                        ['outlet_id' => $tenantOutletId, 'name' => 'DEMO Paket '.$tenantName.$chunkLabel.' Berdua'],
                        [
                            'kind' => PricingRule::KIND_BUNDLE_PRICE,
                            'is_active' => true,
                            'priority' => 200,
                            'target_type' => PricingRule::TARGET_PRODUCT,
                            'product_id' => $productOne->id,
                            'category_id' => null,
                            'customer_scope' => PricingRule::SCOPE_ALL,
                            'discount_type' => PricingRule::TYPE_FIXED_PRICE,
                            'discount_value' => max(1000, ((int) $productOne->sell_price + (int) $productTwo->sell_price) - 3000),
                            'price_basis' => PricingRule::PRICE_BASIS_BUY_PRICE,
                            'starts_at' => now()->subDays(2),
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
                            'notes' => 'Bundle demo untuk '.$tenantName.'.',
                            'created_by' => $creatorId,
                        ]
                    );
                    $bundleRule->bundleItems()->delete();
                    $bundleRule->bundleItems()->createMany([
                        ['product_id' => $productOne->id, 'quantity' => 1, 'sort_order' => 1],
                        ['product_id' => $productTwo->id, 'quantity' => 1, 'sort_order' => 2],
                    ]);
                }
            }
        }

        $this->command?->info('Clean demo pricing rules seeded for all tenant kitchens.');
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
