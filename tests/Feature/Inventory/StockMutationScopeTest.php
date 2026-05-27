<?php

namespace Tests\Feature\Inventory;

use App\Models\Category;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\StockMutation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class StockMutationScopeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Permission::firstOrCreate([
            'name' => 'stock-mutations-access',
            'guard_name' => 'web',
        ]);
    }

    public function test_tenant_stock_mutation_page_only_lists_tenant_products(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('stock-mutations-access');

        $tenantA = $this->createOutlet('TENANT-A', 'Tenant A');
        $tenantB = $this->createOutlet('TENANT-B', 'Tenant B');
        $user->outlets()->attach([
            $tenantA->id => ['is_primary' => true],
            $tenantB->id => ['is_primary' => false],
        ]);

        $category = Category::create([
            'name' => 'Stok',
            'description' => 'Stok test',
            'image' => 'stok.png',
        ]);

        Product::create([
            'category_id' => $category->id,
            'tenant_outlet_id' => $tenantA->id,
            'image' => 'a.png',
            'barcode' => 'ST-A',
            'title' => 'Produk Tenant A',
            'description' => 'Produk A',
            'tenant_hpp_price' => 10000,
            'buy_price' => 12000,
            'sell_price' => 18000,
            'stock' => 10,
        ]);

        Product::create([
            'category_id' => $category->id,
            'tenant_outlet_id' => $tenantB->id,
            'image' => 'b.png',
            'barcode' => 'ST-B',
            'title' => 'Produk Tenant B',
            'description' => 'Produk B',
            'tenant_hpp_price' => 11000,
            'buy_price' => 13000,
            'sell_price' => 19000,
            'stock' => 10,
        ]);

        $this->withSession(['active_outlet_id' => $tenantA->id])
            ->actingAs($user)
            ->get(route('stock-mutations.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/StockMutations/Index')
                ->has('products', 1)
                ->where('products.0.title', 'Produk Tenant A')
            );
    }

    public function test_stock_mutation_page_includes_summary_for_active_outlet(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('stock-mutations-access');

        $tenantA = $this->createOutlet('TENANT-A', 'Tenant A');
        $tenantB = $this->createOutlet('TENANT-B', 'Tenant B');
        $user->outlets()->attach([
            $tenantA->id => ['is_primary' => true],
            $tenantB->id => ['is_primary' => false],
        ]);

        $category = Category::create([
            'name' => 'Mutasi',
            'description' => 'Mutasi test',
            'image' => 'mutasi.png',
        ]);

        $productA = Product::create([
            'category_id' => $category->id,
            'tenant_outlet_id' => $tenantA->id,
            'image' => 'a.png',
            'barcode' => 'M-A',
            'title' => 'Produk A',
            'description' => 'Produk A',
            'tenant_hpp_price' => 10000,
            'buy_price' => 12000,
            'sell_price' => 18000,
            'stock' => 10,
        ]);

        $productB = Product::create([
            'category_id' => $category->id,
            'tenant_outlet_id' => $tenantB->id,
            'image' => 'b.png',
            'barcode' => 'M-B',
            'title' => 'Produk B',
            'description' => 'Produk B',
            'tenant_hpp_price' => 11000,
            'buy_price' => 13000,
            'sell_price' => 19000,
            'stock' => 10,
        ]);

        StockMutation::create([
            'outlet_id' => $tenantA->id,
            'product_id' => $productA->id,
            'reference_type' => 'purchase',
            'reference_id' => 1,
            'mutation_type' => 'in',
            'qty' => 5,
            'stock_before' => 5,
            'stock_after' => 10,
            'created_by' => $user->id,
        ]);

        StockMutation::create([
            'outlet_id' => $tenantB->id,
            'product_id' => $productB->id,
            'reference_type' => 'purchase',
            'reference_id' => 1,
            'mutation_type' => 'out',
            'qty' => 3,
            'stock_before' => 13,
            'stock_after' => 10,
            'created_by' => $user->id,
        ]);

        $this->withSession(['active_outlet_id' => $tenantA->id])
            ->actingAs($user)
            ->get(route('stock-mutations.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/StockMutations/Index')
                ->where('summary.inbound_qty', 5)
                ->where('summary.outbound_qty', 0)
            );
    }

    private function createOutlet(string $code, string $name): Outlet
    {
        return Outlet::create([
            'code' => $code,
            'name' => $name,
            'outlet_type' => 'tenant',
            'is_active' => true,
            'is_default' => false,
        ]);
    }
}
