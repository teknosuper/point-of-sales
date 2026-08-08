<?php

namespace Tests\Feature\Pricing;

use App\Models\Cart;
use App\Models\Category;
use App\Models\Customer;
use App\Models\CustomerOutletMetric;
use App\Models\Outlet;
use App\Models\PricingRule;
use App\Models\Product;
use App\Models\Transaction;
use App\Models\User;
use App\Services\LoyaltyService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class PricingRuleTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'pricing-rules-access',
            'pricing-rules-create',
            'pricing-rules-update',
            'pricing-rules-delete',
            'transactions-access',
            'cashier-shifts-access',
            'cashier-shifts-open',
            'cashier-shifts-close',
        ] as $permission) {
            Permission::firstOrCreate([
                'name' => $permission,
                'guard_name' => 'web',
            ]);
        }
    }

    public function test_authorized_user_can_create_pricing_rule(): void
    {
        $user = $this->createUserWithPermissions([
            'pricing-rules-access',
            'pricing-rules-create',
        ]);
        $category = Category::create([
            'name' => 'Minuman',
            'description' => 'Kategori uji',
            'image' => 'category.png',
        ]);

        $response = $this
            ->actingAs($user)
            ->post(route('pricing-rules.store'), [
                'name' => 'Promo Minuman Pagi',
                'kind' => PricingRule::KIND_STANDARD_DISCOUNT,
                'is_active' => true,
                'priority' => 120,
                'target_type' => 'category',
                'category_id' => $category->id,
                'customer_scope' => 'all',
                'discount_type' => 'percentage',
                'discount_value' => 10,
                'starts_at' => now()->subHour()->format('Y-m-d\TH:i'),
                'ends_at' => now()->addHour()->format('Y-m-d\TH:i'),
                'notes' => 'Promo aktif pagi ini',
            ]);

        $response->assertRedirect(route('pricing-rules.index'));
        $this->assertDatabaseHas('pricing_rules', [
            'name' => 'Promo Minuman Pagi',
            'target_type' => 'category',
            'category_id' => $category->id,
            'discount_type' => 'percentage',
            'customer_scope' => 'all',
            'created_by' => $user->id,
        ]);
    }

    public function test_authorized_user_can_create_qty_break_rule_without_top_level_discount_value(): void
    {
        $user = $this->createUserWithPermissions([
            'pricing-rules-access',
            'pricing-rules-create',
        ]);
        $product = $this->createProduct('Produk Grosir');

        $response = $this
            ->actingAs($user)
            ->post(route('pricing-rules.store'), [
                'name' => 'Promo Grosir',
                'kind' => PricingRule::KIND_QTY_BREAK,
                'is_active' => true,
                'priority' => 110,
                'target_type' => 'product',
                'product_id' => $product->id,
                'customer_scope' => 'all',
                'discount_type' => '',
                'discount_value' => '',
                'qty_breaks' => [
                    [
                        'min_qty' => 3,
                        'discount_type' => PricingRule::TYPE_FIXED_PRICE,
                        'discount_value' => 50000,
                        'sort_order' => 0,
                    ],
                ],
            ]);

        $response->assertRedirect(route('pricing-rules.index'));
        $this->assertDatabaseHas('pricing_rules', [
            'name' => 'Promo Grosir',
            'kind' => PricingRule::KIND_QTY_BREAK,
            'discount_type' => PricingRule::TYPE_FIXED_PRICE,
            'discount_value' => 50000,
        ]);
        $this->assertDatabaseHas('pricing_rule_qty_breaks', [
            'pricing_rule_id' => PricingRule::where('name', 'Promo Grosir')->value('id'),
            'min_qty' => 3,
            'discount_type' => PricingRule::TYPE_FIXED_PRICE,
            'discount_value' => 50000,
        ]);
    }

    public function test_authorized_user_can_create_buy_x_get_y_rule_without_discount_value(): void
    {
        $user = $this->createUserWithPermissions([
            'pricing-rules-access',
            'pricing-rules-create',
        ]);
        $buyProduct = $this->createProduct('Produk Buy Baru');
        $getProduct = $this->createProduct('Produk Get Baru');

        $response = $this
            ->actingAs($user)
            ->post(route('pricing-rules.store'), [
                'name' => 'Buy Get Baru',
                'kind' => PricingRule::KIND_BUY_X_GET_Y,
                'is_active' => true,
                'priority' => 200,
                'target_type' => 'all',
                'customer_scope' => 'all',
                'discount_type' => '',
                'discount_value' => '',
                'buy_get_items' => [
                    ['product_id' => $buyProduct->id, 'role' => 'buy', 'quantity' => 1, 'sort_order' => 0],
                    ['product_id' => $getProduct->id, 'role' => 'get', 'quantity' => 1, 'sort_order' => 1],
                ],
            ]);

        $response->assertRedirect(route('pricing-rules.index'));
        $this->assertDatabaseHas('pricing_rules', [
            'name' => 'Buy Get Baru',
            'kind' => PricingRule::KIND_BUY_X_GET_Y,
            'discount_type' => PricingRule::TYPE_FIXED_AMOUNT,
            'discount_value' => 0,
        ]);
    }

    public function test_authorized_user_can_update_buy_x_get_y_rule_without_discount_value(): void
    {
        $user = $this->createUserWithPermissions([
            'pricing-rules-access',
            'pricing-rules-update',
        ]);
        $buyProduct = $this->createProduct('Produk Buy Update');
        $getProduct = $this->createProduct('Produk Get Update');
        $pricingRule = PricingRule::create([
            'name' => 'Buy 1 Get 1 Lama',
            'kind' => PricingRule::KIND_BUY_X_GET_Y,
            'is_active' => true,
            'priority' => 100,
            'target_type' => 'all',
            'customer_scope' => 'all',
            'discount_type' => PricingRule::TYPE_FIXED_AMOUNT,
            'discount_value' => 0,
            'created_by' => $user->id,
        ]);
        $pricingRule->buyGetItems()->createMany([
            ['product_id' => $buyProduct->id, 'role' => 'buy', 'quantity' => 1, 'sort_order' => 0],
            ['product_id' => $getProduct->id, 'role' => 'get', 'quantity' => 1, 'sort_order' => 1],
        ]);

        $response = $this
            ->actingAs($user)
            ->put(route('pricing-rules.update', $pricingRule), [
                'name' => 'Buy 2 Get 1 Baru',
                'kind' => PricingRule::KIND_BUY_X_GET_Y,
                'is_active' => true,
                'priority' => 150,
                'target_type' => 'all',
                'customer_scope' => 'all',
                'discount_type' => PricingRule::TYPE_FIXED_AMOUNT,
                'discount_value' => '',
                'buy_get_items' => [
                    ['product_id' => $buyProduct->id, 'role' => 'buy', 'quantity' => 2, 'sort_order' => 0],
                    ['product_id' => $getProduct->id, 'role' => 'get', 'quantity' => 1, 'sort_order' => 1],
                ],
            ]);

        $response->assertRedirect(route('pricing-rules.index'));
        $this->assertDatabaseHas('pricing_rules', [
            'id' => $pricingRule->id,
            'name' => 'Buy 2 Get 1 Baru',
            'priority' => 150,
            'discount_type' => PricingRule::TYPE_FIXED_AMOUNT,
            'discount_value' => 0,
        ]);
        $this->assertDatabaseHas('pricing_rule_buy_get_items', [
            'pricing_rule_id' => $pricingRule->id,
            'product_id' => $buyProduct->id,
            'role' => 'buy',
            'quantity' => 2,
        ]);
    }

    public function test_authorized_user_can_update_bundle_price_rule(): void
    {
        $user = $this->createUserWithPermissions([
            'pricing-rules-access',
            'pricing-rules-update',
        ]);
        $productA = $this->createProduct('Bundle A');
        $productB = $this->createProduct('Bundle B');
        $pricingRule = PricingRule::create([
            'name' => 'Bundle Lama',
            'kind' => PricingRule::KIND_BUNDLE_PRICE,
            'is_active' => true,
            'priority' => 100,
            'target_type' => 'product',
            'product_id' => $productA->id,
            'customer_scope' => 'all',
            'discount_type' => PricingRule::TYPE_FIXED_PRICE,
            'discount_value' => 70000,
            'created_by' => $user->id,
        ]);
        $pricingRule->bundleItems()->createMany([
            ['product_id' => $productA->id, 'quantity' => 1, 'sort_order' => 0],
            ['product_id' => $productB->id, 'quantity' => 1, 'sort_order' => 1],
        ]);

        $response = $this
            ->actingAs($user)
            ->put(route('pricing-rules.update', $pricingRule), [
                'name' => 'Bundle Baru',
                'kind' => PricingRule::KIND_BUNDLE_PRICE,
                'is_active' => true,
                'priority' => 180,
                'target_type' => 'product',
                'product_id' => $productA->id,
                'customer_scope' => 'all',
                'discount_type' => PricingRule::TYPE_FIXED_PRICE,
                'discount_value' => 65000,
                'bundle_items' => [
                    ['product_id' => $productA->id, 'quantity' => 1, 'sort_order' => 0],
                    ['product_id' => $productB->id, 'quantity' => 2, 'sort_order' => 1],
                ],
            ]);

        $response->assertRedirect(route('pricing-rules.index'));
        $this->assertDatabaseHas('pricing_rules', [
            'id' => $pricingRule->id,
            'name' => 'Bundle Baru',
            'priority' => 180,
            'discount_type' => PricingRule::TYPE_FIXED_PRICE,
            'discount_value' => 65000,
        ]);
        $this->assertDatabaseHas('pricing_rule_bundle_items', [
            'pricing_rule_id' => $pricingRule->id,
            'product_id' => $productB->id,
            'quantity' => 2,
        ]);
    }

    public function test_bundle_price_preview_uses_all_bundle_items_and_applies_discount(): void
    {
        $user = $this->createUserWithPermissions([
            'pricing-rules-access',
        ]);
        $productA = $this->createProduct('Preview Bundle A');
        $productB = $this->createProduct('Preview Bundle B');

        $response = $this
            ->actingAs($user)
            ->postJson(route('pricing-rules.preview'), [
                'name' => 'Bundle Preview',
                'kind' => PricingRule::KIND_BUNDLE_PRICE,
                'is_active' => true,
                'priority' => 150,
                'target_type' => 'product',
                'product_id' => $productA->id,
                'customer_scope' => 'all',
                'discount_type' => PricingRule::TYPE_FIXED_PRICE,
                'discount_value' => 65000,
                'bundle_items' => [
                    ['product_id' => $productA->id, 'quantity' => 1, 'sort_order' => 0],
                    ['product_id' => $productB->id, 'quantity' => 1, 'sort_order' => 1],
                ],
            ]);

        $response->assertOk();
        $this->assertSame(
            120000,
            data_get($response->json(), 'data.summary.base_subtotal')
        );
        $this->assertSame(
            55000,
            data_get($response->json(), 'data.summary.promo_discount_total')
        );
        $this->assertCount(2, data_get($response->json(), 'data.items', []));
        $this->assertCount(1, data_get($response->json(), 'data.applied_groups', []));
    }

    public function test_qty_break_preview_uses_break_rows_and_applies_discount(): void
    {
        $user = $this->createUserWithPermissions([
            'pricing-rules-access',
        ]);
        $product = $this->createProduct('Preview Qty Break');

        $response = $this
            ->actingAs($user)
            ->postJson(route('pricing-rules.preview'), [
                'name' => 'Qty Break Preview',
                'kind' => PricingRule::KIND_QTY_BREAK,
                'is_active' => true,
                'priority' => 120,
                'target_type' => 'product',
                'product_id' => $product->id,
                'customer_scope' => 'all',
                'discount_type' => '',
                'discount_value' => '',
                'qty_breaks' => [
                    [
                        'min_qty' => 3,
                        'discount_type' => PricingRule::TYPE_FIXED_PRICE,
                        'discount_value' => 50000,
                        'sort_order' => 0,
                    ],
                ],
            ]);

        $response->assertOk();
        $this->assertSame(
            180000,
            data_get($response->json(), 'data.summary.base_subtotal')
        );
        $this->assertSame(
            30000,
            data_get($response->json(), 'data.summary.promo_discount_total')
        );
        $this->assertCount(1, data_get($response->json(), 'data.items', []));
    }

    public function test_buy_x_get_y_preview_uses_buy_and_get_rows(): void
    {
        $user = $this->createUserWithPermissions([
            'pricing-rules-access',
        ]);
        $buyProduct = $this->createProduct('Preview Buy Item');
        $getProduct = $this->createProduct('Preview Get Item');

        $response = $this
            ->actingAs($user)
            ->postJson(route('pricing-rules.preview'), [
                'name' => 'Buy Get Preview',
                'kind' => PricingRule::KIND_BUY_X_GET_Y,
                'is_active' => true,
                'priority' => 200,
                'target_type' => 'all',
                'customer_scope' => 'all',
                'discount_type' => '',
                'discount_value' => '',
                'buy_get_items' => [
                    ['product_id' => $buyProduct->id, 'role' => 'buy', 'quantity' => 1, 'sort_order' => 0],
                    ['product_id' => $getProduct->id, 'role' => 'get', 'quantity' => 1, 'sort_order' => 1],
                ],
            ]);

        $response->assertOk();
        $this->assertSame(
            120000,
            data_get($response->json(), 'data.summary.base_subtotal')
        );
        $this->assertSame(
            60000,
            data_get($response->json(), 'data.summary.promo_discount_total')
        );
        $this->assertCount(2, data_get($response->json(), 'data.items', []));
        $this->assertCount(1, data_get($response->json(), 'data.applied_groups', []));
    }

    public function test_buy_x_get_y_preview_same_product_only_discounts_reward_once(): void
    {
        $user = $this->createUserWithPermissions([
            'pricing-rules-access',
        ]);
        $product = $this->createProduct('Preview BxGy Sama Produk');

        $response = $this
            ->actingAs($user)
            ->postJson(route('pricing-rules.preview'), [
                'name' => 'Buy 1 Get 1 Sama Produk',
                'kind' => PricingRule::KIND_BUY_X_GET_Y,
                'is_active' => true,
                'priority' => 210,
                'target_type' => 'all',
                'customer_scope' => 'all',
                'discount_type' => '',
                'discount_value' => '',
                'buy_get_items' => [
                    ['product_id' => $product->id, 'role' => 'buy', 'quantity' => 1, 'sort_order' => 0],
                    ['product_id' => $product->id, 'role' => 'get', 'quantity' => 1, 'sort_order' => 1],
                ],
            ]);

        $response->assertOk();
        $this->assertSame(
            120000,
            data_get($response->json(), 'data.summary.base_subtotal')
        );
        $this->assertSame(
            60000,
            data_get($response->json(), 'data.summary.promo_discount_total')
        );
        $this->assertSame(
            60000,
            data_get($response->json(), 'data.summary.subtotal_after_promo')
        );
        $this->assertCount(2, data_get($response->json(), 'data.items', []));
        $this->assertFalse((bool) data_get($response->json(), 'data.items.0.is_promo_reward'));
        $this->assertTrue((bool) data_get($response->json(), 'data.items.1.is_promo_reward'));
        $this->assertSame(60000, data_get($response->json(), 'data.items.0.line_total'));
        $this->assertSame(0, data_get($response->json(), 'data.items.1.line_total'));
        $this->assertCount(1, data_get($response->json(), 'data.applied_groups', []));
    }

    public function test_buy_price_basis_discount_only_cuts_tenant_portion_in_preview(): void
    {
        $user = $this->createUserWithPermissions([
            'pricing-rules-access',
        ]);
        $product = $this->createProduct('Preview Buy Basis');

        $response = $this
            ->actingAs($user)
            ->postJson(route('pricing-rules.preview'), [
                'name' => 'Promo Tenant Preview',
                'kind' => PricingRule::KIND_STANDARD_DISCOUNT,
                'is_active' => true,
                'priority' => 100,
                'target_type' => 'product',
                'product_id' => $product->id,
                'customer_scope' => 'all',
                'discount_type' => PricingRule::TYPE_FIXED_PRICE,
                'discount_value' => 40000,
                'price_basis' => PricingRule::PRICE_BASIS_BUY_PRICE,
            ]);

        $response->assertOk();
        $this->assertSame(60000, data_get($response->json(), 'data.summary.base_subtotal'));
        $this->assertSame(5000, data_get($response->json(), 'data.summary.promo_discount_total'));
        $this->assertSame(5000, data_get($response->json(), 'data.summary.tenant_discount_total'));
        $this->assertSame(0, data_get($response->json(), 'data.summary.owner_discount_total'));
        $this->assertSame(55000, data_get($response->json(), 'data.summary.subtotal_after_promo'));
    }

    public function test_sell_price_basis_discount_is_borne_by_tenant_and_preserves_owner_markup(): void
    {
        $user = $this->createUserWithPermissions([
            'pricing-rules-access',
        ]);
        $product = $this->createProduct('Preview Sell Basis');

        $response = $this
            ->actingAs($user)
            ->postJson(route('pricing-rules.preview'), [
                'name' => 'Promo Owner Preview',
                'kind' => PricingRule::KIND_STANDARD_DISCOUNT,
                'is_active' => true,
                'priority' => 100,
                'target_type' => 'product',
                'product_id' => $product->id,
                'customer_scope' => 'all',
                'discount_type' => PricingRule::TYPE_FIXED_AMOUNT,
                'discount_value' => 10000,
                'price_basis' => PricingRule::PRICE_BASIS_SELL_PRICE,
            ]);

        $response->assertOk();
        $this->assertSame(60000, data_get($response->json(), 'data.summary.base_subtotal'));
        $this->assertSame(10000, data_get($response->json(), 'data.summary.promo_discount_total'));
        // Diskon ditanggung tenant seluruhnya; markup owner (sell - buy) tetap utuh.
        $this->assertSame(10000, data_get($response->json(), 'data.summary.tenant_discount_total'));
        $this->assertSame(0, data_get($response->json(), 'data.summary.owner_discount_total'));
        $this->assertSame(50000, data_get($response->json(), 'data.summary.subtotal_after_promo'));
    }

    public function test_authorized_user_can_delete_pricing_rule(): void
    {
        $user = $this->createUserWithPermissions([
            'pricing-rules-access',
            'pricing-rules-delete',
        ]);
        $pricingRule = PricingRule::create([
            'name' => 'Rule Hapus',
            'kind' => PricingRule::KIND_STANDARD_DISCOUNT,
            'is_active' => true,
            'priority' => 50,
            'target_type' => 'all',
            'customer_scope' => 'all',
            'discount_type' => PricingRule::TYPE_FIXED_AMOUNT,
            'discount_value' => 5000,
            'created_by' => $user->id,
        ]);

        $response = $this
            ->actingAs($user)
            ->delete(route('pricing-rules.destroy', $pricingRule));

        $response->assertSessionHas('success', 'Rule promo berhasil dihapus.');
        $this->assertDatabaseMissing('pricing_rules', [
            'id' => $pricingRule->id,
        ]);
    }

    public function test_pricing_preview_respects_customer_scope(): void
    {
        $cashier = $this->createUserWithPermissions([
            'transactions-access',
            'cashier-shifts-access',
            'cashier-shifts-open',
            'cashier-shifts-close',
        ]);
        $this->openShiftFor($cashier);
        $product = $this->createProduct();
        $customer = Customer::create([
            'name' => 'Registered Customer',
            'no_telp' => '62812345678',
            'address' => 'Jl. Uji Pelanggan',
        ]);

        Cart::create([
            'cashier_id' => $cashier->id,
            'product_id' => $product->id,
            'qty' => 1,
            'price' => $product->sell_price,
        ]);

        PricingRule::create([
            'name' => 'Harga Member',
            'is_active' => true,
            'priority' => 200,
            'target_type' => 'product',
            'product_id' => $product->id,
            'customer_scope' => 'registered',
            'discount_type' => 'fixed_amount',
            'discount_value' => 10000,
        ]);

        $walkInResponse = $this
            ->actingAs($cashier)
            ->postJson(route('transactions.pricing-preview'), []);

        $registeredResponse = $this
            ->actingAs($cashier)
            ->postJson(route('transactions.pricing-preview'), [
                'customer_id' => $customer->id,
            ]);

        $walkInResponse->assertOk();
        $registeredResponse->assertOk();
        $this->assertSame(
            0,
            data_get($walkInResponse->json(), 'data.summary.promo_discount_total')
        );
        $this->assertSame(
            10000,
            data_get($registeredResponse->json(), 'data.summary.promo_discount_total')
        );
    }

    public function test_pricing_preview_uses_outlet_specific_member_tier_for_member_scope_rules(): void
    {
        $cashier = $this->createUserWithPermissions([
            'transactions-access',
            'cashier-shifts-access',
            'cashier-shifts-open',
            'cashier-shifts-close',
        ]);
        $outletA = $this->createOutlet('OUTLET-PA', 'Outlet Promo A', true);
        $outletB = $this->createOutlet('OUTLET-PB', 'Outlet Promo B');
        $cashier->outlets()->attach([
            $outletA->id => ['is_primary' => true],
            $outletB->id => ['is_primary' => false],
        ]);

        $this->openShiftFor($cashier, $outletB->id);
        $product = $this->createProduct();
        $customer = Customer::create([
            'name' => 'Member Outlet Pricing',
            'no_telp' => '62819999991',
            'address' => 'Jl. Tier Promo',
            'is_loyalty_member' => true,
            'member_code' => 'MEM-OUTLET-PRICE',
            'loyalty_tier' => LoyaltyService::TIER_GOLD,
        ]);

        CustomerOutletMetric::create([
            'customer_id' => $customer->id,
            'outlet_id' => $outletB->id,
            'total_spent' => 350000,
            'transaction_count' => 2,
            'loyalty_points_earned' => 12,
            'loyalty_points_redeemed' => 0,
            'loyalty_tier' => LoyaltyService::TIER_SILVER,
        ]);

        Cart::create([
            'cashier_id' => $cashier->id,
            'outlet_id' => $outletB->id,
            'product_id' => $product->id,
            'qty' => 1,
            'price' => $product->sell_price,
        ]);

        PricingRule::create([
            'name' => 'Harga Khusus Silver',
            'is_active' => true,
            'priority' => 250,
            'target_type' => 'product',
            'product_id' => $product->id,
            'customer_scope' => PricingRule::SCOPE_MEMBER,
            'eligible_loyalty_tiers' => [LoyaltyService::TIER_SILVER],
            'discount_type' => 'fixed_amount',
            'discount_value' => 10000,
        ]);

        $response = $this
            ->withSession(['active_outlet_id' => $outletB->id])
            ->actingAs($cashier)
            ->postJson(route('transactions.pricing-preview'), [
                'customer_id' => $customer->id,
            ]);

        $response->assertOk();
        $this->assertSame(
            10000,
            data_get($response->json(), 'data.summary.promo_discount_total')
        );
        $this->assertSame(
            LoyaltyService::TIER_SILVER,
            data_get($response->json(), 'data.customer.loyalty_tier')
        );
    }

    public function test_qty_break_preview_applies_wholesale_rule(): void
    {
        $cashier = $this->createUserWithPermissions([
            'transactions-access',
            'cashier-shifts-access',
            'cashier-shifts-open',
            'cashier-shifts-close',
        ]);
        $this->openShiftFor($cashier);
        $product = $this->createProduct();

        Cart::create([
            'cashier_id' => $cashier->id,
            'product_id' => $product->id,
            'qty' => 3,
            'price' => $product->sell_price * 3,
        ]);

        $rule = PricingRule::create([
            'name' => 'Harga Grosir Produk',
            'kind' => PricingRule::KIND_QTY_BREAK,
            'is_active' => true,
            'priority' => 250,
            'target_type' => 'product',
            'product_id' => $product->id,
            'customer_scope' => 'all',
            'discount_type' => 'fixed_price',
            'discount_value' => 0,
        ]);
        $rule->qtyBreaks()->create([
            'min_qty' => 3,
            'discount_type' => 'fixed_price',
            'discount_value' => 50000,
            'sort_order' => 0,
        ]);

        $response = $this
            ->actingAs($cashier)
            ->postJson(route('transactions.pricing-preview'), []);

        $response->assertOk();
        $this->assertSame(
            30000,
            data_get($response->json(), 'data.summary.promo_discount_total')
        );
        $this->assertSame(
            'qty_break',
            data_get($response->json(), 'data.items.0.pricing_rule.kind')
        );
    }

    public function test_bundle_price_preview_returns_applied_group(): void
    {
        $cashier = $this->createUserWithPermissions([
            'transactions-access',
            'cashier-shifts-access',
            'cashier-shifts-open',
            'cashier-shifts-close',
        ]);
        $this->openShiftFor($cashier);
        $productA = $this->createProduct('Produk Bundle A');
        $productB = $this->createProduct('Produk Bundle B');

        Cart::create([
            'cashier_id' => $cashier->id,
            'product_id' => $productA->id,
            'qty' => 1,
            'price' => $productA->sell_price,
        ]);
        Cart::create([
            'cashier_id' => $cashier->id,
            'product_id' => $productB->id,
            'qty' => 1,
            'price' => $productB->sell_price,
        ]);

        $rule = PricingRule::create([
            'name' => 'Bundle Hemat',
            'kind' => PricingRule::KIND_BUNDLE_PRICE,
            'is_active' => true,
            'priority' => 400,
            'target_type' => 'all',
            'customer_scope' => 'all',
            'discount_type' => 'fixed_price',
            'discount_value' => 100000,
        ]);
        $rule->bundleItems()->createMany([
            ['product_id' => $productA->id, 'quantity' => 1, 'sort_order' => 0],
            ['product_id' => $productB->id, 'quantity' => 1, 'sort_order' => 1],
        ]);

        $response = $this
            ->actingAs($cashier)
            ->postJson(route('transactions.pricing-preview'), []);

        $response->assertOk();
        $this->assertSame(
            20000,
            data_get($response->json(), 'data.summary.promo_discount_total')
        );
        $this->assertCount(1, data_get($response->json(), 'data.applied_groups', []));
    }

    public function test_pricing_rule_can_be_limited_to_specific_days(): void
    {
        Carbon::setTestNow('2026-05-25 10:00:00');

        $cashier = $this->createUserWithPermissions([
            'transactions-access',
            'cashier-shifts-access',
            'cashier-shifts-open',
            'cashier-shifts-close',
        ]);
        $this->openShiftFor($cashier);
        $product = $this->createProduct();

        Cart::create([
            'cashier_id' => $cashier->id,
            'product_id' => $product->id,
            'qty' => 1,
            'price' => $product->sell_price,
        ]);

        PricingRule::create([
            'name' => 'Promo Senin Pagi',
            'is_active' => true,
            'priority' => 320,
            'target_type' => 'product',
            'product_id' => $product->id,
            'customer_scope' => 'all',
            'discount_type' => 'fixed_amount',
            'discount_value' => 10000,
            'active_days' => [PricingRule::DAY_MONDAY],
        ]);

        $response = $this
            ->actingAs($cashier)
            ->postJson(route('transactions.pricing-preview'), []);

        $response->assertOk();
        $this->assertSame(
            10000,
            data_get($response->json(), 'data.summary.promo_discount_total')
        );

        Carbon::setTestNow('2026-05-26 10:00:00');

        $response = $this
            ->actingAs($cashier)
            ->postJson(route('transactions.pricing-preview'), []);

        $response->assertOk();
        $this->assertSame(
            0,
            data_get($response->json(), 'data.summary.promo_discount_total')
        );

        Carbon::setTestNow();
    }

    public function test_pricing_rule_can_be_limited_to_daily_time_window(): void
    {
        Carbon::setTestNow('2026-05-25 15:30:00');

        $cashier = $this->createUserWithPermissions([
            'transactions-access',
            'cashier-shifts-access',
            'cashier-shifts-open',
            'cashier-shifts-close',
        ]);
        $this->openShiftFor($cashier);
        $product = $this->createProduct();

        Cart::create([
            'cashier_id' => $cashier->id,
            'product_id' => $product->id,
            'qty' => 1,
            'price' => $product->sell_price,
        ]);

        PricingRule::create([
            'name' => 'Happy Hour Sore',
            'is_active' => true,
            'priority' => 330,
            'target_type' => 'product',
            'product_id' => $product->id,
            'customer_scope' => 'all',
            'discount_type' => 'fixed_amount',
            'discount_value' => 12000,
            'daily_start_time' => '14:00:00',
            'daily_end_time' => '17:00:00',
        ]);

        $response = $this
            ->actingAs($cashier)
            ->postJson(route('transactions.pricing-preview'), []);

        $response->assertOk();
        $this->assertSame(
            12000,
            data_get($response->json(), 'data.summary.promo_discount_total')
        );

        Carbon::setTestNow('2026-05-25 18:15:00');

        $response = $this
            ->actingAs($cashier)
            ->postJson(route('transactions.pricing-preview'), []);

        $response->assertOk();
        $this->assertSame(
            0,
            data_get($response->json(), 'data.summary.promo_discount_total')
        );

        Carbon::setTestNow();
    }

    public function test_buy_x_get_y_preview_discounts_reward_item(): void
    {
        $cashier = $this->createUserWithPermissions([
            'transactions-access',
            'cashier-shifts-access',
            'cashier-shifts-open',
            'cashier-shifts-close',
        ]);
        $this->openShiftFor($cashier);
        $buyProduct = $this->createProduct('Produk Buy');
        $getProduct = $this->createProduct('Produk Get');

        Cart::create([
            'cashier_id' => $cashier->id,
            'product_id' => $buyProduct->id,
            'qty' => 1,
            'price' => $buyProduct->sell_price,
        ]);
        Cart::create([
            'cashier_id' => $cashier->id,
            'product_id' => $getProduct->id,
            'qty' => 1,
            'price' => $getProduct->sell_price,
        ]);

        $rule = PricingRule::create([
            'name' => 'Buy 1 Get 1',
            'kind' => PricingRule::KIND_BUY_X_GET_Y,
            'is_active' => true,
            'priority' => 450,
            'target_type' => 'all',
            'customer_scope' => 'all',
            'discount_type' => 'fixed_amount',
            'discount_value' => 0,
        ]);
        $rule->buyGetItems()->createMany([
            ['product_id' => $buyProduct->id, 'role' => 'buy', 'quantity' => 1, 'sort_order' => 0],
            ['product_id' => $getProduct->id, 'role' => 'get', 'quantity' => 1, 'sort_order' => 1],
        ]);

        $response = $this
            ->actingAs($cashier)
            ->postJson(route('transactions.pricing-preview'), []);

        $response->assertOk();
        $this->assertSame(
            60000,
            data_get($response->json(), 'data.summary.promo_discount_total')
        );
        $this->assertFalse((bool) data_get($response->json(), 'data.items.0.is_promo_reward'));
        $this->assertTrue((bool) data_get($response->json(), 'data.items.1.is_promo_reward'));
        $this->assertSame(0, data_get($response->json(), 'data.items.1.line_total'));
        $this->assertSame(
            'buy_x_get_y',
            data_get($response->json(), 'data.items.1.pricing_rule.kind')
        );
    }

    public function test_transaction_checkout_recalculates_grand_total_using_pricing_rules(): void
    {
        $cashier = $this->createUserWithPermissions([
            'transactions-access',
            'cashier-shifts-access',
            'cashier-shifts-open',
            'cashier-shifts-close',
        ]);
        $shift = $this->openShiftFor($cashier);
        $product = $this->createProduct();
        $customer = Customer::create([
            'name' => 'Customer Promo',
            'no_telp' => '628777888999',
            'address' => 'Jl. Promo No. 1',
        ]);

        Cart::create([
            'cashier_id' => $cashier->id,
            'product_id' => $product->id,
            'qty' => 2,
            'price' => $product->sell_price * 2,
        ]);

        PricingRule::create([
            'name' => 'Harga Spesial Produk',
            'is_active' => true,
            'priority' => 300,
            'target_type' => 'product',
            'product_id' => $product->id,
            'customer_scope' => 'all',
            'discount_type' => 'fixed_price',
            'discount_value' => 50000,
        ]);

        $response = $this
            ->actingAs($cashier)
            ->post(route('transactions.store'), [
                'customer_id' => $customer->id,
                'discount' => 5000,
                'shipping_cost' => 0,
                'grand_total' => 999999,
                'cash' => 100000,
                'change' => 0,
            ]);

        $transaction = Transaction::with(['details', 'profits'])->latest('id')->first();

        $response->assertRedirect(route('transactions.print', $transaction->invoice));
        $this->assertNotNull($transaction);
        $this->assertSame($shift->id, $transaction->cashier_shift_id);
        $this->assertSame(95000, (int) $transaction->grand_total);
        $this->assertSame(5000, (int) $transaction->discount);
        $this->assertSame(100000, (int) $transaction->cash);
        $this->assertSame(5000, (int) $transaction->change);

        $detail = $transaction->details->first();
        $this->assertSame(60000, (int) $detail->base_unit_price);
        $this->assertSame(50000, (int) $detail->unit_price);
        $this->assertSame(100000, (int) $detail->price);
        $this->assertSame(20000, (int) $detail->discount_total);
        $this->assertSame('Harga Spesial Produk', $detail->pricing_rule_name);

        $profit = $transaction->profits->first();
        $this->assertSame(5000, (int) $profit->total);
        $this->assertDatabaseMissing('carts', [
            'cashier_id' => $cashier->id,
        ]);
        $this->assertSame(23, $product->fresh()->stock);
    }

    private function createUserWithPermissions(array $permissions): User
    {
        $user = User::factory()->create();
        $user->givePermissionTo($permissions);

        return $user;
    }

    private function openShiftFor(User $cashier, ?int $outletId = null)
    {
        return \App\Models\CashierShift::create([
            'user_id' => $cashier->id,
            'outlet_id' => $outletId,
            'opened_by' => $cashier->id,
            'opened_at' => now(),
            'opening_cash' => 100000,
            'expected_cash' => 100000,
            'status' => 'open',
        ]);
    }

    private function createOutlet(string $code, string $name, bool $isDefault = false): Outlet
    {
        return Outlet::create([
            'code' => $code,
            'slug' => strtolower($code),
            'name' => $name,
            'is_active' => true,
            'is_default' => $isDefault,
            'sort_order' => 0,
        ]);
    }

    private function createProduct(?string $title = null): Product
    {
        $category = Category::create([
            'name' => 'Snack Promo '.Str::upper(Str::random(4)),
            'description' => 'Kategori promo',
            'image' => 'category.png',
        ]);

        return Product::create([
            'category_id' => $category->id,
            'image' => 'product.png',
            'barcode' => 'BRCD-'.Str::upper(Str::random(10)),
            'sku' => 'SKU-'.Str::upper(Str::random(8)),
            'title' => $title ?? 'Produk Promo',
            'description' => 'Produk untuk pengujian promo.',
            'buy_price' => 45000,
            'sell_price' => 60000,
            'stock' => 25,
        ]);
    }
}
