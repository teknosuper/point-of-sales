<?php

namespace Tests\Feature\MultiOutlet;

use App\Models\KitchenStation;
use App\Models\KitchenStationDevice;
use App\Models\KitchenTicket;
use App\Models\Outlet;
use App\Models\PaymentSetting;
use App\Models\Customer;
use App\Models\CustomerOutletMetric;
use App\Models\KitchenTicketEvent;
use App\Models\Transaction;
use App\Models\User;
use App\Services\LoyaltyService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class MultiOutletIsolationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'dashboard-access',
            'payment-settings-access',
            'customers-access',
        ] as $permission) {
            Permission::firstOrCreate([
                'name' => $permission,
                'guard_name' => 'web',
            ]);
        }
    }

    public function test_user_can_switch_to_accessible_outlet_context(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('dashboard-access');

        $primaryOutlet = $this->createOutlet('OUTLET-A', 'Outlet A', true);
        $secondaryOutlet = $this->createOutlet('OUTLET-B', 'Outlet B');
        $user->outlets()->attach([
            $primaryOutlet->id => ['is_primary' => true],
            $secondaryOutlet->id => ['is_primary' => false],
        ]);

        $response = $this
            ->actingAs($user)
            ->post(route('outlets.switch'), [
                'outlet_id' => $secondaryOutlet->id,
            ]);

        $response->assertRedirect();
        $response->assertSessionHas('active_outlet_id', $secondaryOutlet->id);
    }

    public function test_user_cannot_switch_to_unassigned_outlet_context(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('dashboard-access');

        $assignedOutlet = $this->createOutlet('OUTLET-A', 'Outlet A', true);
        $forbiddenOutlet = $this->createOutlet('OUTLET-B', 'Outlet B');
        $user->outlets()->attach($assignedOutlet->id, ['is_primary' => true]);

        $this
            ->actingAs($user)
            ->post(route('outlets.switch'), [
                'outlet_id' => $forbiddenOutlet->id,
            ])
            ->assertForbidden();
    }

    public function test_payment_settings_page_prefers_outlet_specific_configuration(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo(['dashboard-access', 'payment-settings-access']);

        $primaryOutlet = $this->createOutlet('OUTLET-A', 'Outlet A', true);
        $secondaryOutlet = $this->createOutlet('OUTLET-B', 'Outlet B');
        $user->outlets()->attach([
            $primaryOutlet->id => ['is_primary' => true],
            $secondaryOutlet->id => ['is_primary' => false],
        ]);

        PaymentSetting::create([
            'default_gateway' => 'cash',
            'bank_transfer_enabled' => false,
        ]);

        PaymentSetting::create([
            'outlet_id' => $secondaryOutlet->id,
            'default_gateway' => PaymentSetting::GATEWAY_BANK_TRANSFER,
            'bank_transfer_enabled' => true,
        ]);

        $response = $this
            ->withSession(['active_outlet_id' => $secondaryOutlet->id])
            ->actingAs($user)
            ->get(route('settings.payments.edit'));

        $response->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard/Settings/Payment')
            ->where('setting.default_gateway', PaymentSetting::GATEWAY_BANK_TRANSFER)
            ->where('setting.bank_transfer_enabled', true)
        );
    }

    public function test_store_settings_can_update_tenant_commission_rates(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('dashboard-access');

        $activeOutlet = $this->createOutlet('OUTLET-HQ', 'Outlet HQ', true);
        $tenantA = $this->createOutlet('TENANT-A', 'Tenant A');
        $tenantB = $this->createOutlet('TENANT-B', 'Tenant B');
        $user->outlets()->attach([
            $activeOutlet->id => ['is_primary' => true],
            $tenantA->id => ['is_primary' => false],
            $tenantB->id => ['is_primary' => false],
        ]);

        $this->withSession(['active_outlet_id' => $activeOutlet->id])
            ->actingAs($user)
            ->post(route('settings.store.update'), [
                'store_name' => 'Outlet HQ',
                'store_address' => 'Jl. HQ No. 1',
                'store_phone' => '08123456789',
                'store_email' => 'hq@example.com',
                'store_website' => 'https://hq.test',
                'store_city' => 'Jakarta',
                'tenant_commissions' => [
                    (string) $tenantA->id => 12.5,
                    (string) $tenantB->id => 7,
                ],
            ])
            ->assertRedirect();

        $this->assertSame(12.5, (float) $tenantA->fresh()->commission_rate_percent);
        $this->assertSame(7.0, (float) $tenantB->fresh()->commission_rate_percent);
    }

    public function test_kitchen_board_uses_active_outlet_when_station_slug_exists_in_multiple_outlets(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('dashboard-access');

        $outletA = $this->createOutlet('OUTLET-A', 'Outlet A', true);
        $outletB = $this->createOutlet('OUTLET-B', 'Outlet B');
        $user->outlets()->attach([
            $outletA->id => ['is_primary' => true],
            $outletB->id => ['is_primary' => false],
        ]);

        $stationA = KitchenStation::create([
            'outlet_id' => $outletA->id,
            'name' => 'Dapur Ayam A',
            'slug' => 'ayam',
            'code' => 'AYAM-A',
            'display_mode' => 'screen',
            'is_active' => true,
            'sort_order' => 1,
        ]);
        $stationB = KitchenStation::create([
            'outlet_id' => $outletB->id,
            'name' => 'Dapur Ayam B',
            'slug' => 'ayam',
            'code' => 'AYAM-B',
            'display_mode' => 'screen',
            'is_active' => true,
            'sort_order' => 1,
        ]);

        KitchenStationDevice::create([
            'kitchen_station_id' => $stationB->id,
            'name' => 'Tablet Dapur B',
            'device_type' => 'tablet',
            'connection_driver' => 'browser',
            'is_primary' => true,
            'is_active' => true,
        ]);

        $transactionA = $this->createTransactionForOutlet($user, $outletA, 'TRX-OUTLET-A');
        $transactionB = $this->createTransactionForOutlet($user, $outletB, 'TRX-OUTLET-B');

        $ticketA = KitchenTicket::create([
            'outlet_id' => $outletA->id,
            'transaction_id' => $transactionA->id,
            'kitchen_station_id' => $stationA->id,
            'ticket_number' => 'KT-OUTLET-A',
            'source_channel' => 'pos',
            'status' => 'pending',
            'fired_at' => now(),
        ]);
        $ticketB = KitchenTicket::create([
            'outlet_id' => $outletB->id,
            'transaction_id' => $transactionB->id,
            'kitchen_station_id' => $stationB->id,
            'ticket_number' => 'KT-OUTLET-B',
            'source_channel' => 'pos',
            'status' => 'pending',
            'fired_at' => now(),
        ]);

        $ticketA->items()->create([
            'product_title' => 'Ayam Outlet A',
            'qty' => 1,
            'status' => 'pending',
            'fired_at' => now(),
        ]);
        $ticketB->items()->create([
            'product_title' => 'Ayam Outlet B',
            'qty' => 2,
            'status' => 'pending',
            'fired_at' => now(),
        ]);

        $response = $this
            ->withSession(['active_outlet_id' => $outletB->id])
            ->actingAs($user)
            ->get(route('kitchen.show', [
                'stationSlug' => 'ayam',
            ]));

        $response->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard/Kitchen/Index')
            ->where('activeStation.id', $stationB->id)
            ->where('activeStation.name', 'Dapur Ayam B')
            ->where('tickets.0.ticket_number', 'KT-OUTLET-B')
            ->where('tickets.0.items.0.product_title', 'Ayam Outlet B')
            ->where('tickets', fn (array $tickets) => collect($tickets)->doesntContain(
                fn (array $ticket) => $ticket['ticket_number'] === 'KT-OUTLET-A'
            ))
        );
    }

    public function test_loyalty_service_prefers_outlet_metric_tier_over_global_customer_tier(): void
    {
        $outlet = $this->createOutlet('OUTLET-TIER', 'Outlet Tier', true);
        $customer = Customer::create([
            'name' => 'Tier Outlet',
            'no_telp' => '628770009999',
            'address' => 'Jl. Tier Outlet',
            'is_loyalty_member' => true,
            'member_code' => 'MEM-TIER-OUTLET',
            'loyalty_tier' => LoyaltyService::TIER_GOLD,
            'loyalty_points' => 15,
        ]);

        CustomerOutletMetric::create([
            'customer_id' => $customer->id,
            'outlet_id' => $outlet->id,
            'total_spent' => 250000,
            'transaction_count' => 2,
            'loyalty_points_earned' => 15,
            'loyalty_points_redeemed' => 0,
            'loyalty_tier' => LoyaltyService::TIER_SILVER,
        ]);

        $resolvedTier = app(LoyaltyService::class)->resolvedTier($customer->fresh(['outletMetrics']), $outlet->id);

        $this->assertSame(LoyaltyService::TIER_SILVER, $resolvedTier);
    }

    public function test_member_index_filters_by_outlet_metric_tier_in_active_outlet(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo(['dashboard-access', 'customers-access']);

        $outletA = $this->createOutlet('OUTLET-MA', 'Outlet MA', true);
        $outletB = $this->createOutlet('OUTLET-MB', 'Outlet MB');
        $user->outlets()->attach([
            $outletA->id => ['is_primary' => true],
            $outletB->id => ['is_primary' => false],
        ]);

        $customerA = Customer::create([
            'name' => 'Member Silver',
            'no_telp' => '628770001111',
            'address' => 'Jl. Silver',
            'is_loyalty_member' => true,
            'member_code' => 'MEM-SILVER',
            'loyalty_tier' => LoyaltyService::TIER_GOLD,
        ]);

        $customerB = Customer::create([
            'name' => 'Member Gold',
            'no_telp' => '628770001112',
            'address' => 'Jl. Gold',
            'is_loyalty_member' => true,
            'member_code' => 'MEM-GOLD',
            'loyalty_tier' => LoyaltyService::TIER_GOLD,
        ]);

        CustomerOutletMetric::create([
            'customer_id' => $customerA->id,
            'outlet_id' => $outletB->id,
            'total_spent' => 300000,
            'transaction_count' => 2,
            'loyalty_points_earned' => 10,
            'loyalty_points_redeemed' => 0,
            'loyalty_tier' => LoyaltyService::TIER_SILVER,
        ]);

        CustomerOutletMetric::create([
            'customer_id' => $customerB->id,
            'outlet_id' => $outletB->id,
            'total_spent' => 3000000,
            'transaction_count' => 8,
            'loyalty_points_earned' => 100,
            'loyalty_points_redeemed' => 0,
            'loyalty_tier' => LoyaltyService::TIER_GOLD,
        ]);

        $this
            ->withSession(['active_outlet_id' => $outletB->id])
            ->actingAs($user)
            ->get(route('members.index', ['tier' => LoyaltyService::TIER_SILVER, 'status' => 'active']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Members/Index')
                ->where('filters.tier', LoyaltyService::TIER_SILVER)
                ->where('members.data.0.id', $customerA->id)
                ->where('members.data.0.loyalty_tier', LoyaltyService::TIER_SILVER)
                ->count('members.data', 1)
            );
    }

    public function test_kitchen_dispatch_records_event_for_selected_device_in_active_outlet(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('dashboard-access');

        $outlet = $this->createOutlet('OUTLET-KD', 'Outlet KD', true);
        $user->outlets()->attach($outlet->id, ['is_primary' => true]);

        $station = KitchenStation::create([
            'outlet_id' => $outlet->id,
            'name' => 'Dapur Printer',
            'slug' => 'printer',
            'code' => 'PRINT-1',
            'display_mode' => 'printer',
            'is_active' => true,
            'sort_order' => 1,
        ]);

        $device = KitchenStationDevice::create([
            'kitchen_station_id' => $station->id,
            'name' => 'Printer Dapur 1',
            'device_type' => 'printer',
            'connection_driver' => 'browser',
            'endpoint' => 'printer://kitchen-1',
            'is_primary' => true,
            'is_active' => true,
        ]);

        $transaction = $this->createTransactionForOutlet($user, $outlet, 'TRX-PRINT-OUTLET');
        $ticket = KitchenTicket::create([
            'outlet_id' => $outlet->id,
            'transaction_id' => $transaction->id,
            'kitchen_station_id' => $station->id,
            'ticket_number' => 'KT-PRINT-1',
            'source_channel' => 'pos',
            'status' => 'pending',
            'fired_at' => now(),
        ]);

        $response = $this
            ->withSession(['active_outlet_id' => $outlet->id])
            ->actingAs($user)
            ->post(route('kitchen.tickets.dispatch', $ticket), [
                'device_id' => $device->id,
            ]);

        $response->assertRedirect();

        $event = KitchenTicketEvent::query()
            ->where('kitchen_ticket_id', $ticket->id)
            ->where('event', 'ticket.dispatched')
            ->latest('created_at')
            ->first();

        $this->assertNotNull($event);
        $this->assertSame($device->id, data_get($event->payload, 'device_id'));
        $this->assertSame('Printer Dapur 1', data_get($event->payload, 'device_name'));
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

    private function createTransactionForOutlet(User $user, Outlet $outlet, string $invoice): Transaction
    {
        return Transaction::create([
            'cashier_id' => $user->id,
            'outlet_id' => $outlet->id,
            'invoice' => $invoice,
            'cash' => 0,
            'change' => 0,
            'discount' => 0,
            'shipping_cost' => 0,
            'grand_total' => 100000,
            'payment_method' => 'cash',
            'payment_status' => 'paid',
        ]);
    }
}
