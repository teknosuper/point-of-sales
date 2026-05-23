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

        $mainOutlet = Outlet::query()
            ->where('is_default', true)
            ->orWhere('outlet_type', 'main')
            ->ordered()
            ->first();

        if (! $mainOutlet) {
            $this->command?->warn('Skipping DemoPricingRuleSeeder because main outlet is missing.');

            return;
        }

        $products = Product::query()
            ->whereIn('barcode', [
                'FC-MIN-001', 'FC-MIN-002', 'FC-MIN-003', 'FC-MIN-004',
                'FC-MIE-001', 'FC-MIE-002', 'FC-MIE-003', 'FC-MIE-004',
                'FC-AYM-001', 'FC-AYM-002', 'FC-AYM-003', 'FC-AYM-004',
                'FC-RMN-001', 'FC-RMN-002', 'FC-RMN-003', 'FC-RMN-004',
                'FC-STK-001', 'FC-STK-002', 'FC-STK-003', 'FC-STK-004',
                'FC-DRN-001', 'FC-DRN-002', 'FC-DRN-003', 'FC-DRN-004',
                'FC-NSG-001', 'FC-NSG-002', 'FC-NSG-003', 'FC-NSG-004',
                'FC-BUH-001', 'FC-BUH-002', 'FC-BUH-003', 'FC-BUH-004',
            ])
            ->get()
            ->keyBy('barcode');

        if ($products->isEmpty()) {
            $this->command?->warn('Skipping DemoPricingRuleSeeder because demo products are missing.');

            return;
        }

        $creatorId = User::query()
            ->whereIn('email', ['admin.demo@gmail.com', 'arya@gmail.com'])
            ->value('id');

        $rules = [
            [
                'name' => 'DEMO Promo Minuman 25% - Es Teh Tarik',
                'kind' => PricingRule::KIND_STANDARD_DISCOUNT,
                'target_type' => PricingRule::TARGET_PRODUCT,
                'product_barcode' => 'FC-MIN-001',
                'discount_type' => PricingRule::TYPE_PERCENTAGE,
                'discount_value' => 25,
                'priority' => 220,
                'notes' => 'Promo demo minuman. FC-MIN-002 sampai FC-MIN-004 tetap tanpa promo langsung sebagai pembanding.',
            ],
            [
                'name' => 'DEMO Harga Spesial Minuman - Kopi Susu Aren',
                'kind' => PricingRule::KIND_STANDARD_DISCOUNT,
                'target_type' => PricingRule::TARGET_PRODUCT,
                'product_barcode' => 'FC-MIN-002',
                'discount_type' => PricingRule::TYPE_FIXED_PRICE,
                'discount_value' => 15000,
                'priority' => 215,
                'notes' => 'Fixed price untuk uji harga coret di kasir dan self order.',
            ],
            [
                'name' => 'DEMO Grosir Mie Goreng Jawa',
                'kind' => PricingRule::KIND_QTY_BREAK,
                'target_type' => PricingRule::TARGET_PRODUCT,
                'product_barcode' => 'FC-MIE-001',
                'discount_type' => PricingRule::TYPE_PERCENTAGE,
                'discount_value' => 0,
                'priority' => 210,
                'preview_quantity_multiplier' => 3,
                'qty_breaks' => [
                    ['min_qty' => 2, 'discount_type' => PricingRule::TYPE_PERCENTAGE, 'discount_value' => 10, 'sort_order' => 1],
                    ['min_qty' => 3, 'discount_type' => PricingRule::TYPE_PERCENTAGE, 'discount_value' => 15, 'sort_order' => 2],
                ],
                'notes' => 'Uji qty break. Tambah qty 2 atau 3 di keranjang agar promo aktif.',
            ],
            [
                'name' => 'DEMO Hemat Mie Nyemek Spesial',
                'kind' => PricingRule::KIND_STANDARD_DISCOUNT,
                'target_type' => PricingRule::TARGET_PRODUCT,
                'product_barcode' => 'FC-MIE-002',
                'discount_type' => PricingRule::TYPE_FIXED_AMOUNT,
                'discount_value' => 4000,
                'priority' => 205,
                'notes' => 'Uji potongan nominal per item.',
            ],
            [
                'name' => 'DEMO Buy 1 Get 1 Ayam Geprek Original',
                'kind' => PricingRule::KIND_BUY_X_GET_Y,
                'target_type' => PricingRule::TARGET_PRODUCT,
                'product_barcode' => 'FC-AYM-001',
                'discount_type' => PricingRule::TYPE_FIXED_AMOUNT,
                'discount_value' => 0,
                'priority' => 230,
                'buy_get_items' => [
                    ['product_barcode' => 'FC-AYM-001', 'role' => PricingRuleBuyGetItem::ROLE_BUY, 'quantity' => 1, 'sort_order' => 1],
                    ['product_barcode' => 'FC-AYM-001', 'role' => PricingRuleBuyGetItem::ROLE_GET, 'quantity' => 1, 'sort_order' => 2],
                ],
                'notes' => 'Uji BOGO. Tambah qty 2 Ayam Geprek Original agar satu item gratis.',
            ],
            [
                'name' => 'DEMO Paket Ramen Berdua',
                'kind' => PricingRule::KIND_BUNDLE_PRICE,
                'target_type' => PricingRule::TARGET_PRODUCT,
                'product_barcode' => 'FC-RMN-001',
                'discount_type' => PricingRule::TYPE_FIXED_PRICE,
                'discount_value' => 65000,
                'priority' => 225,
                'bundle_items' => [
                    ['product_barcode' => 'FC-RMN-001', 'quantity' => 1, 'sort_order' => 1],
                    ['product_barcode' => 'FC-RMN-002', 'quantity' => 1, 'sort_order' => 2],
                ],
                'notes' => 'Uji bundle price. Tambah Ramen Original + Spicy Tori Ramen bersamaan.',
            ],
            [
                'name' => 'DEMO Diskon Steak Crispy',
                'kind' => PricingRule::KIND_STANDARD_DISCOUNT,
                'target_type' => PricingRule::TARGET_PRODUCT,
                'product_barcode' => 'FC-STK-001',
                'discount_type' => PricingRule::TYPE_FIXED_AMOUNT,
                'discount_value' => 6000,
                'priority' => 200,
                'notes' => 'Promo nominal tetap untuk uji struk dan breakdown harga.',
            ],
            [
                'name' => 'DEMO Qty Break Sirloin Steak',
                'kind' => PricingRule::KIND_QTY_BREAK,
                'target_type' => PricingRule::TARGET_PRODUCT,
                'product_barcode' => 'FC-STK-002',
                'discount_type' => PricingRule::TYPE_PERCENTAGE,
                'discount_value' => 0,
                'priority' => 198,
                'preview_quantity_multiplier' => 2,
                'qty_breaks' => [
                    ['min_qty' => 2, 'discount_type' => PricingRule::TYPE_PERCENTAGE, 'discount_value' => 12, 'sort_order' => 1],
                ],
                'notes' => 'Uji diskon grosir item premium.',
            ],
            [
                'name' => 'DEMO Harga Promo Es Durian Original',
                'kind' => PricingRule::KIND_STANDARD_DISCOUNT,
                'target_type' => PricingRule::TARGET_PRODUCT,
                'product_barcode' => 'FC-DRN-001',
                'discount_type' => PricingRule::TYPE_FIXED_PRICE,
                'discount_value' => 26000,
                'priority' => 195,
                'notes' => 'Uji harga tetap untuk dessert durian.',
            ],
            [
                'name' => 'DEMO Buy Durian Box Get Cheese Cup',
                'kind' => PricingRule::KIND_BUY_X_GET_Y,
                'target_type' => PricingRule::TARGET_PRODUCT,
                'product_barcode' => 'FC-DRN-003',
                'discount_type' => PricingRule::TYPE_FIXED_AMOUNT,
                'discount_value' => 0,
                'priority' => 194,
                'buy_get_items' => [
                    ['product_barcode' => 'FC-DRN-003', 'role' => PricingRuleBuyGetItem::ROLE_BUY, 'quantity' => 1, 'sort_order' => 1],
                    ['product_barcode' => 'FC-DRN-004', 'role' => PricingRuleBuyGetItem::ROLE_GET, 'quantity' => 1, 'sort_order' => 2],
                ],
                'notes' => 'Uji buy-get lintas produk dalam dapur durian.',
            ],
            [
                'name' => 'DEMO Promo Nasgor Biasa 20%',
                'kind' => PricingRule::KIND_STANDARD_DISCOUNT,
                'target_type' => PricingRule::TARGET_PRODUCT,
                'product_barcode' => 'FC-NSG-001',
                'discount_type' => PricingRule::TYPE_PERCENTAGE,
                'discount_value' => 20,
                'priority' => 190,
                'notes' => 'Promo standar persentase di dapur nasgor.',
            ],
            [
                'name' => 'DEMO Paket Nasgor Ayam + Spesial',
                'kind' => PricingRule::KIND_BUNDLE_PRICE,
                'target_type' => PricingRule::TARGET_PRODUCT,
                'product_barcode' => 'FC-NSG-002',
                'discount_type' => PricingRule::TYPE_FIXED_PRICE,
                'discount_value' => 52000,
                'priority' => 189,
                'bundle_items' => [
                    ['product_barcode' => 'FC-NSG-002', 'quantity' => 1, 'sort_order' => 1],
                    ['product_barcode' => 'FC-NSG-003', 'quantity' => 1, 'sort_order' => 2],
                ],
                'notes' => 'Uji bundle di dapur nasgor.',
            ],
            [
                'name' => 'DEMO Promo Salad Buah Premium',
                'kind' => PricingRule::KIND_STANDARD_DISCOUNT,
                'target_type' => PricingRule::TARGET_PRODUCT,
                'product_barcode' => 'FC-BUH-001',
                'discount_type' => PricingRule::TYPE_PERCENTAGE,
                'discount_value' => 15,
                'priority' => 188,
                'notes' => 'Promo ringan untuk dapur buah.',
            ],
            [
                'name' => 'DEMO Harga Spesial Jus Alpukat',
                'kind' => PricingRule::KIND_STANDARD_DISCOUNT,
                'target_type' => PricingRule::TARGET_PRODUCT,
                'product_barcode' => 'FC-BUH-002',
                'discount_type' => PricingRule::TYPE_FIXED_AMOUNT,
                'discount_value' => 3000,
                'priority' => 187,
                'notes' => 'Uji diskon nominal untuk minuman buah.',
            ],
        ];

        foreach ($rules as $ruleData) {
            $product = isset($ruleData['product_barcode'])
                ? $products->get($ruleData['product_barcode'])
                : null;

            $rule = PricingRule::query()->updateOrCreate(
                [
                    'outlet_id' => $mainOutlet->id,
                    'name' => $ruleData['name'],
                ],
                [
                    'kind' => $ruleData['kind'],
                    'is_active' => true,
                    'priority' => $ruleData['priority'],
                    'target_type' => $ruleData['target_type'],
                    'product_id' => $product?->id,
                    'category_id' => null,
                    'customer_scope' => PricingRule::SCOPE_ALL,
                    'discount_type' => $ruleData['discount_type'],
                    'discount_value' => $ruleData['discount_value'],
                    'price_basis' => PricingRule::PRICE_BASIS_SELL_PRICE,
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
                    'preview_quantity_multiplier' => $ruleData['preview_quantity_multiplier'] ?? 1,
                    'notes' => $ruleData['notes'] ?? null,
                    'created_by' => $creatorId,
                ]
            );

            $rule->qtyBreaks()->delete();
            $rule->bundleItems()->delete();
            $rule->buyGetItems()->delete();

            foreach ($ruleData['qty_breaks'] ?? [] as $breakRow) {
                $rule->qtyBreaks()->create($breakRow);
            }

            foreach ($ruleData['bundle_items'] ?? [] as $bundleRow) {
                $bundleProduct = $products->get($bundleRow['product_barcode']);
                if (! $bundleProduct) {
                    continue;
                }

                $rule->bundleItems()->create([
                    'product_id' => $bundleProduct->id,
                    'quantity' => $bundleRow['quantity'],
                    'sort_order' => $bundleRow['sort_order'] ?? 0,
                ]);
            }

            foreach ($ruleData['buy_get_items'] ?? [] as $buyGetRow) {
                $buyGetProduct = $products->get($buyGetRow['product_barcode']);
                if (! $buyGetProduct) {
                    continue;
                }

                $rule->buyGetItems()->create([
                    'product_id' => $buyGetProduct->id,
                    'role' => $buyGetRow['role'],
                    'quantity' => $buyGetRow['quantity'],
                    'sort_order' => $buyGetRow['sort_order'] ?? 0,
                ]);
            }
        }

        $this->command?->info('Demo pricing rules seeded for cashier and self-order testing.');
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
