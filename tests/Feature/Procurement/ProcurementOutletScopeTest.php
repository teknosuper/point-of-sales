<?php

namespace Tests\Feature\Procurement;

use App\Models\Category;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class ProcurementOutletScopeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'suppliers-access',
            'purchase-orders-access',
            'purchase-orders-create',
        ] as $permission) {
            Permission::firstOrCreate([
                'name' => $permission,
                'guard_name' => 'web',
            ]);
        }
    }

    public function test_supplier_index_only_shows_suppliers_for_active_outlet(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('suppliers-access');

        $tenantA = $this->createOutlet('TENANT-A', 'Tenant A', 'tenant');
        $tenantB = $this->createOutlet('TENANT-B', 'Tenant B', 'tenant');
        $user->outlets()->attach([
            $tenantA->id => ['is_primary' => true],
            $tenantB->id => ['is_primary' => false],
        ]);

        Supplier::create([
            'outlet_id' => $tenantA->id,
            'name' => 'Supplier Tenant A',
        ]);
        Supplier::create([
            'outlet_id' => $tenantB->id,
            'name' => 'Supplier Tenant B',
        ]);

        $this->withSession(['active_outlet_id' => $tenantA->id])
            ->actingAs($user)
            ->get(route('suppliers.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Suppliers/Index')
                ->has('suppliers.data', 1)
                ->where('suppliers.data.0.name', 'Supplier Tenant A')
                ->where('workspace.active_outlet.id', $tenantA->id)
            );
    }

    public function test_purchase_order_create_only_shows_active_tenant_suppliers_and_products(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo(['purchase-orders-access', 'purchase-orders-create']);

        $tenantA = $this->createOutlet('TENANT-A', 'Tenant A', 'tenant');
        $tenantB = $this->createOutlet('TENANT-B', 'Tenant B', 'tenant');
        $user->outlets()->attach([
            $tenantA->id => ['is_primary' => true],
            $tenantB->id => ['is_primary' => false],
        ]);

        $category = Category::create([
            'name' => 'Procurement',
            'description' => 'Procurement test',
            'image' => 'procurement.png',
        ]);

        Supplier::create([
            'outlet_id' => $tenantA->id,
            'name' => 'Supplier A',
        ]);
        Supplier::create([
            'outlet_id' => $tenantB->id,
            'name' => 'Supplier B',
        ]);

        Product::create([
            'category_id' => $category->id,
            'tenant_outlet_id' => $tenantA->id,
            'image' => 'a.png',
            'barcode' => 'A-001',
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
            'barcode' => 'B-001',
            'title' => 'Produk Tenant B',
            'description' => 'Produk B',
            'tenant_hpp_price' => 12000,
            'buy_price' => 14000,
            'sell_price' => 20000,
            'stock' => 10,
        ]);

        $this->withSession(['active_outlet_id' => $tenantA->id])
            ->actingAs($user)
            ->get(route('purchase-orders.create'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/PurchaseOrders/Create')
                ->has('suppliers', 1)
                ->where('suppliers.0.name', 'Supplier A')
                ->has('products', 1)
                ->where('products.0.title', 'Produk Tenant A')
            );
    }

    private function createOutlet(string $code, string $name, string $outletType): Outlet
    {
        return Outlet::create([
            'code' => $code,
            'name' => $name,
            'outlet_type' => $outletType,
            'is_active' => true,
            'is_default' => false,
        ]);
    }
}
