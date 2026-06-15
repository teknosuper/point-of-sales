<?php

namespace Tests\Feature\Products;

use App\Models\Category;
use App\Models\KitchenStation;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\ProductKitchenStationMapping;
use App\Models\ProductOutletStock;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class ProductTenantScopeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'products-access',
            'products-edit',
            'products-create',
            'products-delete',
        ] as $permission) {
            Permission::firstOrCreate([
                'name' => $permission,
                'guard_name' => 'web',
            ]);
        }
    }

    public function test_tenant_outlet_index_only_shows_its_own_products(): void
    {
        [$user, $tenantOutlet, $visibleProduct] = $this->createTenantWorkspaceContext();
        $hiddenProduct = Product::factory()->create([
            'tenant_outlet_id' => null,
            'title' => 'Produk Owner Global',
        ]);

        $this->actingAs($user)
            ->get(route('products.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Products/Index')
                ->where('workspace.is_tenant', true)
                ->where('products.data', fn (array $rows) => count($rows) === 1
                    && (int) $rows[0]['id'] === (int) $visibleProduct->id
                    && $rows[0]['title'] !== $hiddenProduct->title));

        $this->assertSame('tenant', $tenantOutlet->outlet_type);
    }

    public function test_tenant_outlet_cannot_open_product_edit_form(): void
    {
        [$user, , $product] = $this->createTenantWorkspaceContext();

        $this->actingAs($user)
            ->get(route('products.edit', $product))
            ->assertRedirect()
            ->assertSessionHas('error');
    }

    public function test_tenant_outlet_can_only_update_daily_stock(): void
    {
        [$user, $tenantOutlet, $product] = $this->createTenantWorkspaceContext();

        $this->actingAs($user)
            ->patch(route('products.daily-stock.update', $product), [
                'stock' => 17,
                'notes' => 'Adjustment tenant',
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertDatabaseHas('product_outlet_stocks', [
            'outlet_id' => $tenantOutlet->id,
            'product_id' => $product->id,
            'stock' => 17,
        ]);
    }

    public function test_tenant_outlet_cannot_update_product_catalogue_fields(): void
    {
        [$user, , $product] = $this->createTenantWorkspaceContext();

        $this->actingAs($user)
            ->put(route('products.update', $product), [
                'barcode' => $product->barcode,
                'sku' => $product->sku,
                'title' => 'Produk Tenant Diubah',
                'description' => 'Tidak boleh tersimpan',
                'category_id' => $product->category_id,
                'tenant_hpp_price' => 12000,
                'buy_price' => 99999,
                'sell_price' => 123456,
                'tenant_discount_price' => 15000,
            ])
            ->assertRedirect()
            ->assertSessionHas('error');

        $product->refresh();

        $this->assertSame('Produk Tenant', $product->title);
        $this->assertSame(17000, (int) $product->tenant_hpp_price);
        $this->assertSame(17000, (int) $product->buy_price);
        $this->assertSame(28000, (int) $product->sell_price);
        $this->assertNull($product->tenant_discount_price);
    }

    public function test_product_store_requires_category_from_same_tenant_context(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo(['products-create']);

        $tenantOutlet = Outlet::create([
            'code' => 'TNT-STORE',
            'slug' => 'tenant-store',
            'name' => 'Tenant Store',
            'outlet_type' => 'tenant',
            'is_active' => true,
            'is_default' => false,
        ]);

        $globalCategory = Category::create([
            'name' => 'Kategori Global',
            'description' => 'Kategori global',
            'image' => 'global-category.png',
        ]);

        $this->actingAs($user)
            ->from(route('products.create'))
            ->post(route('products.store'), [
                'image' => \Illuminate\Http\UploadedFile::fake()->image('product.png'),
                'barcode' => 'BARCODE-STORE-001',
                'sku' => 'SKU-STORE-001',
                'title' => 'Produk Tenant Baru',
                'description' => 'Produk tenant baru',
                'category_id' => $globalCategory->id,
                'tenant_outlet_id' => $tenantOutlet->id,
                'buy_price' => 20000,
                'sell_price' => 28000,
                'stock' => 5,
            ])
            ->assertSessionHasErrors(['category_id']);
    }

    /**
     * @return array{0: User, 1: Outlet, 2: Product}
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
            'tenant_outlet_id' => $outlet->id,
        ]);

        $product = Product::create([
            'category_id' => $category->id,
            'tenant_outlet_id' => $outlet->id,
            'image' => 'tenant-product.png',
            'barcode' => 'BRCD-'.Str::upper(Str::random(8)),
            'sku' => 'SKU-'.Str::upper(Str::random(8)),
            'title' => 'Produk Tenant',
            'description' => 'Produk tenant untuk pengujian',
            'tenant_hpp_price' => 17000,
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

        ProductOutletStock::create([
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'stock' => 8,
            'reorder_level' => 0,
        ]);

        return [$user, $outlet, $product];
    }
}
