<?php

namespace Tests\Feature\Products;

use App\Models\Category;
use App\Models\KitchenStation;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\ProductKitchenStationMapping;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class ProductTenantPricingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'products-access',
            'products-edit',
            'products-pricing-update',
        ] as $permission) {
            Permission::firstOrCreate([
                'name' => $permission,
                'guard_name' => 'web',
            ]);
        }
    }

    public function test_tenant_workspace_edit_payload_hides_owner_sell_price(): void
    {
        [$user, $product] = $this->createTenantWorkspaceContext();

        $this->actingAs($user)
            ->get(route('products.edit', $product))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Products/Edit')
                ->where('product.buy_price', 17000)
                ->where('product.sell_price', null)
                ->where('capabilities.can_manage_tenant_discount', true)
                ->where('capabilities.can_manage_pricing', false));
    }

    public function test_tenant_workspace_can_update_discount_without_changing_owner_prices(): void
    {
        [$user, $product] = $this->createTenantWorkspaceContext();

        $this->actingAs($user)
            ->put(route('products.update', $product), [
                'barcode' => $product->barcode,
                'sku' => $product->sku,
                'title' => 'Produk Tenant Final',
                'description' => 'Tidak boleh mengubah katalog owner.',
                'category_id' => $product->category_id,
                'buy_price' => 99999,
                'sell_price' => 123456,
                'tenant_discount_price' => 15000,
            ])
            ->assertRedirect(route('products.index'));

        $product->refresh();

        $this->assertSame(17000, (int) $product->buy_price);
        $this->assertSame(28000, (int) $product->sell_price);
        $this->assertSame(15000, (int) $product->tenant_discount_price);
        $this->assertSame('Produk Tenant', $product->title);
    }

    public function test_tenant_discount_cannot_exceed_buy_price(): void
    {
        [$user, $product] = $this->createTenantWorkspaceContext();

        $this->from(route('products.edit', $product))
            ->actingAs($user)
            ->put(route('products.update', $product), [
                'barcode' => $product->barcode,
                'sku' => $product->sku,
                'title' => $product->title,
                'description' => $product->description,
                'category_id' => $product->category_id,
                'tenant_discount_price' => 18000,
            ])
            ->assertRedirect(route('products.edit', $product))
            ->assertSessionHasErrors(['tenant_discount_price']);

        $this->assertNull($product->fresh()->tenant_discount_price);
    }

    /**
     * @return array{0: User, 1: Product}
     */
    private function createTenantWorkspaceContext(): array
    {
        $outlet = Outlet::create([
            'code' => 'TNT-'.Str::upper(Str::random(4)),
            'slug' => 'tenant-'.Str::lower(Str::random(8)),
            'name' => 'Tenant Test',
            'outlet_type' => 'tenant',
            'is_active' => true,
            'is_default' => false,
        ]);

        $station = KitchenStation::create([
            'outlet_id' => $outlet->id,
            'name' => 'Station Tenant',
            'slug' => 'station-tenant',
            'code' => 'ST-1',
            'is_active' => true,
        ]);

        $user = User::factory()->create([
            'preferred_workspace' => 'kitchen',
            'preferred_kitchen_station_id' => $station->id,
        ]);
        $user->givePermissionTo(['products-access', 'products-edit']);
        $user->outlets()->attach($outlet->id, ['is_primary' => true]);

        $category = Category::create([
            'name' => 'Kategori Tenant '.Str::random(4),
            'description' => 'Kategori Tenant',
            'image' => 'tenant-category.png',
        ]);

        $product = Product::create([
            'category_id' => $category->id,
            'tenant_outlet_id' => $outlet->id,
            'image' => 'tenant-product.png',
            'barcode' => 'BRCD-'.Str::upper(Str::random(8)),
            'sku' => 'SKU-'.Str::upper(Str::random(8)),
            'title' => 'Produk Tenant',
            'description' => 'Produk tenant untuk pengujian',
            'buy_price' => 17000,
            'sell_price' => 28000,
            'stock' => 8,
        ]);

        ProductKitchenStationMapping::create([
            'product_id' => $product->id,
            'kitchen_station_id' => $station->id,
            'priority' => 1,
            'fire_on_sale' => true,
            'is_active' => true,
        ]);

        return [$user, $product];
    }
}
