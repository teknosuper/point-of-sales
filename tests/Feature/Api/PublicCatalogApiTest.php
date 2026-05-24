<?php

namespace Tests\Feature\Api;

use App\Models\Category;
use App\Models\Outlet;
use App\Models\PricingRule;
use App\Models\Product;
use App\Models\ProductOutletStock;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Tests\TestCase;

class PublicCatalogApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_catalog_products_endpoint_is_accessible_without_auth_and_is_outlet_aware(): void
    {
        $outlet = $this->createOutlet('PUB-API', 'Outlet Public API', true);
        $category = $this->createCategory('Minuman');
        $promoProduct = $this->createProduct($category, 'Es Kopi Susu', 28000);
        $regularProduct = $this->createProduct($category, 'Matcha Latte', 30000);

        ProductOutletStock::create([
            'outlet_id' => $outlet->id,
            'product_id' => $promoProduct->id,
            'stock' => 9,
        ]);
        ProductOutletStock::create([
            'outlet_id' => $outlet->id,
            'product_id' => $regularProduct->id,
            'stock' => 0,
        ]);

        PricingRule::create([
            'name' => 'Promo Kopi Pagi',
            'kind' => PricingRule::KIND_STANDARD_DISCOUNT,
            'is_active' => true,
            'priority' => 300,
            'target_type' => PricingRule::TARGET_PRODUCT,
            'product_id' => $promoProduct->id,
            'outlet_id' => $outlet->id,
            'customer_scope' => PricingRule::SCOPE_ALL,
            'discount_type' => PricingRule::TYPE_FIXED_PRICE,
            'discount_value' => 20000,
            'starts_at' => now()->subHour(),
            'ends_at' => now()->addHour(),
        ]);

        $response = $this->getJson(route('public.catalog.products', [
            'outlet_code' => $outlet->code,
        ]));

        $response
            ->assertOk()
            ->assertHeader('Access-Control-Allow-Origin', '*')
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.title', 'Es Kopi Susu')
            ->assertJsonPath('data.0.stock', 9)
            ->assertJsonPath('data.0.pricing_badge.kind', PricingRule::KIND_STANDARD_DISCOUNT)
            ->assertJsonPath('data.0.pricing_badge.promo_price', 20000)
            ->assertJsonPath('context.outlet.code', $outlet->code);
    }

    public function test_public_catalog_promos_endpoint_returns_multiple_rule_types(): void
    {
        Carbon::setTestNow('2026-05-24 10:00:00');

        $outlet = $this->createOutlet('PROMO-API', 'Outlet Promo API', true);
        $category = $this->createCategory('Snack');
        $productA = $this->createProduct($category, 'Keripik Kentang', 15000);
        $productB = $this->createProduct($category, 'Soda Lemon', 18000);

        foreach ([$productA, $productB] as $product) {
            ProductOutletStock::create([
                'outlet_id' => $outlet->id,
                'product_id' => $product->id,
                'stock' => 12,
            ]);
        }

        $qtyRule = PricingRule::create([
            'name' => 'Grosir Snack',
            'kind' => PricingRule::KIND_QTY_BREAK,
            'is_active' => true,
            'priority' => 210,
            'target_type' => PricingRule::TARGET_PRODUCT,
            'product_id' => $productA->id,
            'outlet_id' => $outlet->id,
            'customer_scope' => PricingRule::SCOPE_ALL,
            'discount_type' => PricingRule::TYPE_FIXED_PRICE,
            'discount_value' => 0,
        ]);
        $qtyRule->qtyBreaks()->create([
            'min_qty' => 3,
            'discount_type' => PricingRule::TYPE_FIXED_PRICE,
            'discount_value' => 12000,
            'sort_order' => 0,
        ]);

        $bundleRule = PricingRule::create([
            'name' => 'Bundle Camilan',
            'kind' => PricingRule::KIND_BUNDLE_PRICE,
            'is_active' => true,
            'priority' => 220,
            'target_type' => PricingRule::TARGET_ALL,
            'outlet_id' => $outlet->id,
            'customer_scope' => PricingRule::SCOPE_ALL,
            'discount_type' => PricingRule::TYPE_FIXED_PRICE,
            'discount_value' => 25000,
        ]);
        $bundleRule->bundleItems()->createMany([
            ['product_id' => $productA->id, 'quantity' => 1, 'sort_order' => 0],
            ['product_id' => $productB->id, 'quantity' => 1, 'sort_order' => 1],
        ]);

        $buyGetRule = PricingRule::create([
            'name' => 'Beli 1 Gratis 1',
            'kind' => PricingRule::KIND_BUY_X_GET_Y,
            'is_active' => true,
            'priority' => 230,
            'target_type' => PricingRule::TARGET_ALL,
            'outlet_id' => $outlet->id,
            'customer_scope' => PricingRule::SCOPE_ALL,
            'discount_type' => PricingRule::TYPE_FIXED_AMOUNT,
            'discount_value' => 0,
        ]);
        $buyGetRule->buyGetItems()->createMany([
            ['product_id' => $productA->id, 'role' => 'buy', 'quantity' => 1, 'sort_order' => 0],
            ['product_id' => $productB->id, 'role' => 'get', 'quantity' => 1, 'sort_order' => 1],
        ]);

        $response = $this->getJson(route('public.catalog.promos', [
            'outlet_id' => $outlet->id,
        ]));

        $response
            ->assertOk()
            ->assertJsonPath('meta.total', 3)
            ->assertJsonPath('meta.counts_by_kind.buy_x_get_y', 1)
            ->assertJsonPath('data.0.kind', PricingRule::KIND_BUY_X_GET_Y)
            ->assertJsonPath('data.0.badge.text', 'Buy X Get Y')
            ->assertJsonPath('data.0.theme.key', 'emerald')
            ->assertJsonPath('data.0.cta.label', 'Lihat Buy/Get')
            ->assertJsonPath('data.0.visual.type', 'buy_get')
            ->assertJsonPath('data.0.buy_items.0.image', $productA->image)
            ->assertJsonPath('data.0.get_items.0.image', $productB->image)
            ->assertJsonPath('data.1.kind', PricingRule::KIND_BUNDLE_PRICE)
            ->assertJsonPath('data.1.badge.text', 'Bundle')
            ->assertJsonPath('data.1.visual.type', 'bundle')
            ->assertJsonPath('data.1.bundle_items.0.image', $productA->image)
            ->assertJsonPath('data.2.kind', PricingRule::KIND_QTY_BREAK)
            ->assertJsonPath('groups.buy_x_get_y.0.kind', PricingRule::KIND_BUY_X_GET_Y);

        $this->assertNotEmpty(data_get($response->json(), 'data.0.highlight_products'));
        $this->assertNotEmpty(data_get($response->json(), 'data.1.bundle_items'));
        $this->assertNotEmpty(data_get($response->json(), 'data.2.qty_breaks'));

        Carbon::setTestNow();
    }

    private function createOutlet(string $code, string $name, bool $isDefault = false): Outlet
    {
        return Outlet::create([
            'code' => $code,
            'slug' => Str::slug($code),
            'name' => $name,
            'is_active' => true,
            'is_default' => $isDefault,
            'sort_order' => 0,
        ]);
    }

    private function createCategory(string $name): Category
    {
        return Category::create([
            'name' => $name,
            'description' => 'Kategori public API',
            'image' => 'category.png',
        ]);
    }

    private function createProduct(Category $category, string $title, int $sellPrice): Product
    {
        return Product::create([
            'category_id' => $category->id,
            'image' => 'product.png',
            'barcode' => 'BRCD-'.Str::upper(Str::random(8)),
            'sku' => 'SKU-'.Str::upper(Str::random(8)),
            'title' => $title,
            'description' => 'Produk untuk public catalog API',
            'buy_price' => max(1000, $sellPrice - 5000),
            'sell_price' => $sellPrice,
            'stock' => 10,
        ]);
    }
}
