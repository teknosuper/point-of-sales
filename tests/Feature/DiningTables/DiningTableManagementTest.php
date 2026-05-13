<?php

namespace Tests\Feature\DiningTables;

use App\Models\DiningTable;
use App\Models\Outlet;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class DiningTableManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'dashboard-access',
            'dining-tables-access',
            'dining-tables-create',
            'dining-tables-update',
            'dining-tables-delete',
        ] as $permission) {
            Permission::firstOrCreate([
                'name' => $permission,
                'guard_name' => 'web',
            ]);
        }
    }

    public function test_index_scopes_tables_to_active_outlet(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo(['dashboard-access', 'dining-tables-access']);

        $primaryOutlet = $this->createOutlet('OUTLET-A', 'Outlet A', true);
        $secondaryOutlet = $this->createOutlet('OUTLET-B', 'Outlet B');
        $user->outlets()->attach([
            $primaryOutlet->id => ['is_primary' => true],
            $secondaryOutlet->id => ['is_primary' => false],
        ]);

        DiningTable::create([
            'outlet_id' => $primaryOutlet->id,
            'name' => 'Meja A1',
            'code' => 'A1',
            'capacity' => 4,
            'status' => 'active',
            'sort_order' => 1,
        ]);

        DiningTable::create([
            'outlet_id' => $secondaryOutlet->id,
            'name' => 'Meja B1',
            'code' => 'B1',
            'capacity' => 6,
            'status' => 'active',
            'sort_order' => 1,
        ]);

        $response = $this->withSession(['active_outlet_id' => $secondaryOutlet->id])
            ->actingAs($user)
            ->get(route('dining-tables.index'));

        $response->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard/DiningTables/Index')
            ->where('summary.total', 1)
            ->where('diningTables.data.0.name', 'Meja B1')
        );
    }

    public function test_store_creates_table_for_active_outlet(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo([
            'dashboard-access',
            'dining-tables-access',
            'dining-tables-create',
        ]);

        $outlet = $this->createOutlet('OUTLET-A', 'Outlet A', true);
        $user->outlets()->attach($outlet->id, ['is_primary' => true]);

        $this->withSession(['active_outlet_id' => $outlet->id])
            ->actingAs($user)
            ->post(route('dining-tables.store'), [
                'name' => 'Meja VIP',
                'code' => 'VIP-1',
                'capacity' => 8,
                'status' => 'active',
                'sort_order' => 2,
                'notes' => 'Area depan',
            ])
            ->assertRedirect(route('dining-tables.index'));

        $this->assertDatabaseHas('dining_tables', [
            'outlet_id' => $outlet->id,
            'name' => 'Meja VIP',
            'code' => 'VIP-1',
            'capacity' => 8,
            'status' => 'active',
        ]);
    }

    public function test_destroy_is_blocked_when_table_has_transactions(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo([
            'dashboard-access',
            'dining-tables-access',
            'dining-tables-delete',
        ]);

        $outlet = $this->createOutlet('OUTLET-A', 'Outlet A', true);
        $user->outlets()->attach($outlet->id, ['is_primary' => true]);

        $table = DiningTable::create([
            'outlet_id' => $outlet->id,
            'name' => 'Meja 01',
            'code' => 'T01',
            'capacity' => 4,
            'status' => 'active',
            'sort_order' => 1,
        ]);

        Transaction::create([
            'cashier_id' => $user->id,
            'outlet_id' => $outlet->id,
            'order_type' => 'dine_in',
            'table_id' => $table->id,
            'invoice' => 'INV-TBL-001',
            'cash' => 50000,
            'change' => 0,
            'discount' => 0,
            'grand_total' => 50000,
            'payment_method' => 'cash',
            'payment_status' => 'paid',
        ]);

        $this->withSession(['active_outlet_id' => $outlet->id])
            ->actingAs($user)
            ->delete(route('dining-tables.destroy', $table))
            ->assertRedirect(route('dining-tables.index'));

        $this->assertDatabaseHas('dining_tables', [
            'id' => $table->id,
        ]);
    }

    private function createOutlet(string $code, string $name, bool $isDefault = false): Outlet
    {
        return Outlet::create([
            'code' => $code,
            'slug' => strtolower($code),
            'name' => $name,
            'legal_name' => $name,
            'address' => 'Jl. Test No. 1',
            'city' => 'Jakarta',
            'phone' => '08123456789',
            'email' => strtolower($code).'@example.com',
            'website' => 'https://example.com',
            'outlet_type' => 'main',
            'commission_rate_percent' => 0,
            'is_active' => true,
            'is_default' => $isDefault,
            'sort_order' => $isDefault ? 1 : 2,
        ]);
    }
}
