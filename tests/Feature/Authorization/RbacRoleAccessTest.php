<?php

namespace Tests\Feature\Authorization;

use App\Models\CashierSettlementRequest;
use App\Models\KitchenStation;
use App\Models\Outlet;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class RbacRoleAccessTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(PermissionSeeder::class);
        $this->seed(RoleSeeder::class);
    }

    public function test_cashier_role_cannot_access_kitchen_and_cashier_settlement_pages(): void
    {
        $outlet = $this->createOutlet('OUT-CASHIER', 'Outlet Cashier');
        $user = User::factory()->create();
        $user->assignRole('cashier');
        $user->outlets()->attach($outlet->id, ['is_primary' => true]);

        $this->withSession(['active_outlet_id' => $outlet->id])
            ->actingAs($user)
            ->get(route('kitchen.index'))
            ->assertForbidden();

        $this->withSession(['active_outlet_id' => $outlet->id])
            ->actingAs($user)
            ->get(route('cashier-settlements.index'))
            ->assertForbidden();

        $this->withSession(['active_outlet_id' => $outlet->id])
            ->actingAs($user)
            ->get(route('settings.target'))
            ->assertForbidden();

        $this->withSession(['active_outlet_id' => $outlet->id])
            ->actingAs($user)
            ->get(route('workspace-sales.index'))
            ->assertForbidden();
    }

    public function test_kitchen_operator_can_access_kitchen_and_kitchen_settings_pages(): void
    {
        $outlet = $this->createOutlet('OUT-KITCHEN', 'Outlet Kitchen');
        KitchenStation::create([
            'outlet_id' => $outlet->id,
            'name' => 'Station Grill',
            'slug' => 'station-grill',
            'code' => 'ST-GRILL',
            'station_type' => 'kitchen',
            'display_mode' => 'screen',
            'processing_mode' => 'manual',
            'is_active' => true,
            'sort_order' => 1,
        ]);

        $user = User::factory()->create();
        $user->assignRole('kitchen-operator');
        $user->outlets()->attach($outlet->id, ['is_primary' => true]);

        $this->withSession(['active_outlet_id' => $outlet->id])
            ->actingAs($user)
            ->get(route('kitchen.index'))
            ->assertOk();

        $this->withSession(['active_outlet_id' => $outlet->id])
            ->actingAs($user)
            ->get(route('settings.kitchen-devices.index'))
            ->assertOk();

        $this->withSession(['active_outlet_id' => $outlet->id])
            ->actingAs($user)
            ->get(route('cashier-settlements.index'))
            ->assertForbidden();
    }

    public function test_outlet_owner_can_approve_cashier_settlements(): void
    {
        $outlet = $this->createOutlet('OUT-OWNER', 'Outlet Owner');
        $owner = User::factory()->create([
            'password' => Hash::make('password'),
        ]);
        $owner->assignRole('outlet-owner');
        $owner->outlets()->attach($outlet->id, ['is_primary' => true]);

        $cashier = User::factory()->create();
        $cashier->outlets()->attach($outlet->id, ['is_primary' => true]);

        $settlement = CashierSettlementRequest::create([
            'outlet_id' => $outlet->id,
            'cashier_id' => $cashier->id,
            'request_number' => 'CSR-TEST-001',
            'business_date' => now()->toDateString(),
            'gross_sales_total' => 150000,
            'base_sales_total' => 100000,
            'markup_total' => 50000,
            'requested_amount' => 100000,
            'status' => CashierSettlementRequest::STATUS_PENDING,
        ]);

        $this->withSession(['active_outlet_id' => $outlet->id])
            ->actingAs($owner)
            ->patch(route('cashier-settlements.approve', $settlement), [
                'password' => 'password',
                'approved_amount' => 100000,
                'approved_cash_amount' => 100000,
                'approved_transfer_amount' => 0,
                'approved_other_amount' => 0,
                'recipient_name' => 'Outlet Owner',
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('cashier_settlement_requests', [
            'id' => $settlement->id,
            'status' => CashierSettlementRequest::STATUS_APPROVED,
            'approved_by' => $owner->id,
            'approved_amount' => 100000,
        ]);
    }

    public function test_tenant_users_in_same_outlet_share_settlement_request_history(): void
    {
        $tenantOutlet = Outlet::create([
            'code' => 'TEN-RBAC',
            'slug' => 'ten-rbac',
            'name' => 'Tenant RBAC',
            'outlet_type' => 'tenant',
            'commission_rate_percent' => 0,
            'is_active' => true,
            'is_default' => false,
            'sort_order' => 0,
        ]);

        $firstUser = User::factory()->create();
        $firstUser->assignRole('tenant-owner');
        $firstUser->outlets()->attach($tenantOutlet->id, ['is_primary' => true]);

        $secondUser = User::factory()->create();
        $secondUser->assignRole('tenant-owner');
        $secondUser->outlets()->attach($tenantOutlet->id, ['is_primary' => true]);

        CashierSettlementRequest::create([
            'outlet_id' => $tenantOutlet->id,
            'cashier_id' => $firstUser->id,
            'request_number' => 'TWR-TEST-001',
            'business_date' => now()->toDateString(),
            'gross_sales_total' => 150000,
            'base_sales_total' => 100000,
            'markup_total' => 50000,
            'requested_amount' => 100000,
            'status' => CashierSettlementRequest::STATUS_PENDING,
        ]);

        $this->withSession(['active_outlet_id' => $tenantOutlet->id])
            ->actingAs($secondUser)
            ->get(route('cashier-settlements.index', ['tab' => 'request']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/CashierSettlements/Index')
                ->where('canCreateRequest', true)
                ->where('requests.data', fn (array $rows) => count($rows) === 1
                    && $rows[0]['request_number'] === 'TWR-TEST-001'
                    && (int) $rows[0]['cashier']['id'] === (int) $firstUser->id));
    }

    private function createOutlet(string $code, string $name): Outlet
    {
        return Outlet::create([
            'code' => $code,
            'slug' => strtolower($code),
            'name' => $name,
            'commission_rate_percent' => 0,
            'is_active' => true,
            'is_default' => false,
            'sort_order' => 0,
        ]);
    }
}
