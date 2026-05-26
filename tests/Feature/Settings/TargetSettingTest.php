<?php

namespace Tests\Feature\Settings;

use App\Models\Outlet;
use App\Models\Product;
use App\Models\ProductOutletStock;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class TargetSettingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Permission::firstOrCreate([
            'name' => 'dashboard-access',
            'guard_name' => 'web',
        ]);
    }

    public function test_target_page_shows_outlet_products_with_saved_monthly_targets(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('dashboard-access');

        $activeOutlet = $this->createOutlet('OUTLET-A', 'Outlet A', true);
        $otherOutlet = $this->createOutlet('OUTLET-B', 'Outlet B');
        $user->outlets()->attach([
            $activeOutlet->id => ['is_primary' => true],
            $otherOutlet->id => ['is_primary' => false],
        ]);

        $productA = Product::create([
            'title' => 'Ayam Geprek',
            'buy_price' => 12000,
            'sell_price' => 18000,
            'stock' => 10,
        ]);
        $productB = Product::create([
            'title' => 'Es Teh',
            'buy_price' => 3000,
            'sell_price' => 6000,
            'stock' => 10,
        ]);

        ProductOutletStock::create([
            'outlet_id' => $activeOutlet->id,
            'product_id' => $productA->id,
            'stock' => 8,
        ]);
        ProductOutletStock::create([
            'outlet_id' => $otherOutlet->id,
            'product_id' => $productB->id,
            'stock' => 9,
        ]);

        Setting::set(
            'monthly_product_item_targets',
            json_encode([
                ['product_id' => $productA->id, 'monthly_target' => 90],
            ]),
            'Target penjualan item bulanan per produk',
            $activeOutlet->id
        );

        $this->withSession(['active_outlet_id' => $activeOutlet->id])
            ->actingAs($user)
            ->get(route('settings.target'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Settings/Target')
                ->has('products', 2)
                ->where('products.0.id', $productA->id)
                ->where('products.0.monthly_target', 90)
                ->where('products.0.stock', 8)
            );
    }

    public function test_target_update_stores_monthly_product_targets_per_outlet(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('dashboard-access');

        $activeOutlet = $this->createOutlet('OUTLET-A', 'Outlet A', true);
        $otherOutlet = $this->createOutlet('OUTLET-B', 'Outlet B');
        $user->outlets()->attach([
            $activeOutlet->id => ['is_primary' => true],
            $otherOutlet->id => ['is_primary' => false],
        ]);

        $productA = Product::create([
            'title' => 'Ramen Original',
            'buy_price' => 22000,
            'sell_price' => 36000,
            'stock' => 10,
        ]);
        $productB = Product::create([
            'title' => 'Spicy Tori Ramen',
            'buy_price' => 23000,
            'sell_price' => 38000,
            'stock' => 10,
        ]);

        $this->withSession(['active_outlet_id' => $activeOutlet->id])
            ->actingAs($user)
            ->post(route('settings.target.update'), [
                'monthly_sales_target' => 5000000,
                'monthly_profit_target' => 1500000,
                'daily_global_item_target' => 25,
                'product_targets' => [
                    ['product_id' => $productA->id, 'monthly_target' => 120],
                    ['product_id' => $productB->id, 'monthly_target' => 0],
                ],
            ])
            ->assertRedirect();

        $savedTargets = json_decode(
            (string) Setting::get('monthly_product_item_targets', '[]', $activeOutlet->id),
            true
        );

        $this->assertSame('5000000', (string) Setting::get('monthly_sales_target', 0, $activeOutlet->id));
        $this->assertSame('1500000', (string) Setting::get('monthly_profit_target', 0, $activeOutlet->id));
        $this->assertSame('25', (string) Setting::get('daily_global_item_target', 0, $activeOutlet->id));
        $this->assertSame([
            ['product_id' => $productA->id, 'monthly_target' => 120],
        ], $savedTargets);
        $this->assertSame('[]', (string) Setting::get('monthly_product_item_targets', '[]', $otherOutlet->id));
    }

    private function createOutlet(string $code, string $name, bool $isDefault = false): Outlet
    {
        return Outlet::create([
            'code' => $code,
            'name' => $name,
            'is_active' => true,
            'is_default' => $isDefault,
        ]);
    }
}
