<?php

namespace Tests\Feature\Reports;

use App\Models\Outlet;
use App\Models\Transaction;
use App\Models\TransactionTenantAllocation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class SalesReportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Permission::firstOrCreate([
            'name' => 'reports-access',
            'guard_name' => 'web',
        ]);
    }

    public function test_sales_report_includes_tenant_settlement_for_active_outlet(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('reports-access');

        $cashierOutlet = $this->createOutlet('OUTLET-MAIN', 'Outlet Main', true);
        $otherOutlet = $this->createOutlet('OUTLET-OTHER', 'Outlet Other');
        $tenantA = $this->createOutlet('TENANT-A', 'Tenant Ayam');
        $tenantB = $this->createOutlet('TENANT-B', 'Tenant Minuman');
        $otherTenant = $this->createOutlet('TENANT-C', 'Tenant Lain');
        $tenantA->update(['commission_rate_percent' => 10]);
        $tenantB->update(['commission_rate_percent' => 5]);

        $user->outlets()->attach([
            $cashierOutlet->id => ['is_primary' => true],
            $otherOutlet->id => ['is_primary' => false],
        ]);

        $transaction = Transaction::create([
            'cashier_id' => $user->id,
            'outlet_id' => $cashierOutlet->id,
            'invoice' => 'TRX-TENANT-1',
            'cash' => 50000,
            'change' => 0,
            'discount' => 0,
            'grand_total' => 50000,
            'payment_method' => 'cash',
            'payment_status' => 'paid',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $otherTransaction = Transaction::create([
            'cashier_id' => $user->id,
            'outlet_id' => $otherOutlet->id,
            'invoice' => 'TRX-TENANT-2',
            'cash' => 25000,
            'change' => 0,
            'discount' => 0,
            'grand_total' => 25000,
            'payment_method' => 'cash',
            'payment_status' => 'paid',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $allocationA = TransactionTenantAllocation::create([
            'transaction_id' => $transaction->id,
            'outlet_id' => $cashierOutlet->id,
            'tenant_outlet_id' => $tenantA->id,
            'cashier_id' => $user->id,
            'allocation_number' => 'TA-1-A',
            'subtotal' => 30000,
            'promo_discount_total' => 2000,
            'manual_discount_total' => 0,
            'loyalty_discount_total' => 0,
            'voucher_discount_total' => 0,
            'grand_total' => 30000,
            'payment_status' => 'paid',
            'kitchen_status' => 'pending',
        ]);

        $allocationA->items()->create([
            'tenant_outlet_id' => $tenantA->id,
            'qty' => 2,
            'base_unit_price' => 10000,
            'line_total' => 30000,
            'discount_total' => 0,
        ]);

        $allocationB = TransactionTenantAllocation::create([
            'transaction_id' => $transaction->id,
            'outlet_id' => $cashierOutlet->id,
            'tenant_outlet_id' => $tenantB->id,
            'cashier_id' => $user->id,
            'allocation_number' => 'TA-1-B',
            'subtotal' => 20000,
            'promo_discount_total' => 0,
            'manual_discount_total' => 0,
            'loyalty_discount_total' => 0,
            'voucher_discount_total' => 0,
            'grand_total' => 20000,
            'payment_status' => 'paid',
            'kitchen_status' => 'pending',
        ]);

        $allocationB->items()->create([
            'tenant_outlet_id' => $tenantB->id,
            'qty' => 3,
            'base_unit_price' => 5000,
            'line_total' => 20000,
            'discount_total' => 0,
        ]);

        TransactionTenantAllocation::create([
            'transaction_id' => $otherTransaction->id,
            'outlet_id' => $otherOutlet->id,
            'tenant_outlet_id' => $otherTenant->id,
            'cashier_id' => $user->id,
            'allocation_number' => 'TA-2-C',
            'subtotal' => 25000,
            'promo_discount_total' => 0,
            'manual_discount_total' => 0,
            'loyalty_discount_total' => 0,
            'voucher_discount_total' => 0,
            'grand_total' => 25000,
            'payment_status' => 'paid',
            'kitchen_status' => 'pending',
        ]);

        $response = $this
            ->withSession(['active_outlet_id' => $cashierOutlet->id])
            ->actingAs($user)
            ->get(route('reports.sales.index'));

        $response->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard/Reports/Sales')
            ->where('tenantSettlement.summary.tenant_count', 2)
            ->where('tenantSettlement.summary.allocation_count', 2)
            ->where('tenantSettlement.summary.revenue_total', 50000)
            ->where('tenantSettlement.summary.cost_total', 35000)
            ->where('tenantSettlement.summary.profit_total', 15000)
            ->where('tenantSettlement.summary.management_fee_total', 1250)
            ->where('tenantSettlement.summary.tenant_payout_total', 13750)
            ->where('tenantSettlement.summary.margin_percentage', 30.0)
            ->where('tenantSettlement.top_tenants.0.tenant_outlet.name', 'Tenant Ayam')
            ->where('tenantSettlement.top_tenants.0.revenue_total', 30000)
            ->where('tenantSettlement.top_tenants.0.profit_total', 10000)
            ->where('tenantSettlement.top_tenants.0.management_fee_total', 1000)
            ->where('tenantSettlement.top_tenants.0.tenant_payout_total', 9000)
            ->where('tenantSettlement.allocations.0.total_discount_total', 2000)
            ->where('tenantSettlement.allocations.0.pre_promo_subtotal', 32000)
            ->where('tenantSettlement.allocations.0.transaction.invoice', 'TRX-TENANT-1')
        );

        $payload = $response->viewData('page')['props']['tenantSettlement'] ?? [];
        $tenantIds = collect($payload['allocations'] ?? [])->pluck('tenant_outlet_id')->all();

        $this->assertSameCanonicalizing([$tenantA->id, $tenantB->id], $tenantIds);
    }

    public function test_sales_report_overview_includes_payment_method_breakdown(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('reports-access');

        $outlet = $this->createOutlet('OUTLET-REPORT', 'Outlet Report', true);
        $user->outlets()->attach([
            $outlet->id => ['is_primary' => true],
        ]);

        Transaction::create([
            'cashier_id' => $user->id,
            'outlet_id' => $outlet->id,
            'invoice' => 'TRX-OVERVIEW-CASH',
            'cash' => 30000,
            'change' => 0,
            'discount' => 0,
            'grand_total' => 30000,
            'payment_method' => 'cash',
            'payment_status' => 'paid',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        Transaction::create([
            'cashier_id' => $user->id,
            'outlet_id' => $outlet->id,
            'invoice' => 'TRX-OVERVIEW-QRIS',
            'cash' => 0,
            'change' => 0,
            'discount' => 0,
            'grand_total' => 54000,
            'payment_method' => 'qris',
            'payment_status' => 'paid',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this
            ->withSession(['active_outlet_id' => $outlet->id])
            ->actingAs($user)
            ->get(route('reports.sales.index', ['tab' => 'overview']));

        $response->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard/Reports/Sales')
            ->where('summary.orders_count', 2)
            ->where('summary.revenue_total', 84000)
            ->has('analytics.payment_method_breakdown', 2)
            ->where('analytics.payment_method_breakdown.0.payment_method', 'qris')
            ->where('analytics.payment_method_breakdown.0.orders_count', 1)
            ->where('analytics.payment_method_breakdown.0.revenue_total', 54000)
            ->where('analytics.payment_method_breakdown.1.payment_method', 'cash')
            ->where('analytics.payment_method_breakdown.1.orders_count', 1)
            ->where('analytics.payment_method_breakdown.1.revenue_total', 30000)
        );
    }

    public function test_tenant_statement_page_uses_active_outlet_allocations(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('reports-access');

        $cashierOutlet = $this->createOutlet('OUTLET-STATEMENT', 'Outlet Statement', true);
        $tenant = $this->createOutlet('TENANT-STATEMENT', 'Tenant Statement');
        $tenant->update(['commission_rate_percent' => 12]);
        $user->outlets()->attach([
            $cashierOutlet->id => ['is_primary' => true],
        ]);

        $transaction = Transaction::create([
            'cashier_id' => $user->id,
            'outlet_id' => $cashierOutlet->id,
            'invoice' => 'TRX-STATEMENT-1',
            'cash' => 25000,
            'change' => 0,
            'discount' => 0,
            'grand_total' => 25000,
            'payment_method' => 'cash',
            'payment_status' => 'paid',
        ]);

        $allocation = TransactionTenantAllocation::create([
            'transaction_id' => $transaction->id,
            'outlet_id' => $cashierOutlet->id,
            'tenant_outlet_id' => $tenant->id,
            'cashier_id' => $user->id,
            'allocation_number' => 'TA-STATEMENT-1',
            'subtotal' => 25000,
            'promo_discount_total' => 0,
            'manual_discount_total' => 0,
            'loyalty_discount_total' => 0,
            'voucher_discount_total' => 0,
            'grand_total' => 25000,
            'payment_status' => 'paid',
            'kitchen_status' => 'pending',
            'settled_at' => now(),
        ]);

        $allocation->items()->create([
            'tenant_outlet_id' => $tenant->id,
            'qty' => 2,
            'base_unit_price' => 10000,
            'line_total' => 25000,
            'discount_total' => 0,
        ]);

        $response = $this
            ->withSession(['active_outlet_id' => $cashierOutlet->id])
            ->actingAs($user)
            ->get(route('reports.sales.tenant-statement', $tenant));

        $response->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard/Reports/TenantStatement')
            ->where('tenantOutlet.name', 'Tenant Statement')
            ->where('tenantOutlet.commission_rate_percent', 12.0)
            ->where('summary.revenue_total', 25000)
            ->where('summary.profit_total', 5000)
            ->where('summary.management_fee_total', 600)
            ->where('summary.tenant_payout_total', 4400)
            ->where('allocations.data.0.allocation_number', 'TA-STATEMENT-1')
        );
    }

    public function test_tenant_statement_export_includes_payout_metadata(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('reports-access');

        $cashierOutlet = $this->createOutlet('OUTLET-EXPORT-STMT', 'Outlet Export Statement', true);
        $tenant = $this->createOutlet('TENANT-EXPORT-STMT', 'Tenant Export Statement');
        $tenant->update(['commission_rate_percent' => 15]);
        $user->outlets()->attach([
            $cashierOutlet->id => ['is_primary' => true],
        ]);

        $transaction = Transaction::create([
            'cashier_id' => $user->id,
            'outlet_id' => $cashierOutlet->id,
            'invoice' => 'TRX-EXPORT-STMT-1',
            'cash' => 30000,
            'change' => 0,
            'discount' => 0,
            'grand_total' => 30000,
            'payment_method' => 'cash',
            'payment_status' => 'paid',
        ]);

        $allocation = TransactionTenantAllocation::create([
            'transaction_id' => $transaction->id,
            'outlet_id' => $cashierOutlet->id,
            'tenant_outlet_id' => $tenant->id,
            'cashier_id' => $user->id,
            'allocation_number' => 'TA-EXPORT-STMT-1',
            'subtotal' => 30000,
            'promo_discount_total' => 0,
            'manual_discount_total' => 0,
            'loyalty_discount_total' => 0,
            'voucher_discount_total' => 0,
            'grand_total' => 30000,
            'payment_status' => 'paid',
            'kitchen_status' => 'pending',
            'settled_at' => now(),
            'payout_reference' => 'PAYOUT-001',
            'payout_notes' => 'Transfer batch sore',
            'payout_paid_at' => now(),
        ]);

        $allocation->items()->create([
            'tenant_outlet_id' => $tenant->id,
            'qty' => 2,
            'base_unit_price' => 10000,
            'line_total' => 30000,
            'discount_total' => 0,
        ]);

        $response = $this
            ->withSession(['active_outlet_id' => $cashierOutlet->id])
            ->actingAs($user)
            ->get(route('reports.sales.tenant-statement.export', $tenant));

        $response->assertOk();
        $response->assertHeader('content-type', 'text/csv; charset=UTF-8');

        $content = $response->streamedContent();

        $this->assertStringContainsString('TA-EXPORT-STMT-1', $content);
        $this->assertStringContainsString('PAYOUT-001', $content);
        $this->assertStringContainsString('Transfer batch sore', $content);
    }

    public function test_sales_report_can_settle_and_unsettle_tenant_allocation_in_active_outlet(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('reports-access');

        $cashierOutlet = $this->createOutlet('OUTLET-SETTLE', 'Outlet Settle', true);
        $otherOutlet = $this->createOutlet('OUTLET-SETTLE-OTHER', 'Outlet Settle Other');
        $tenant = $this->createOutlet('TENANT-SETTLE', 'Tenant Settle');
        $otherTenant = $this->createOutlet('TENANT-SETTLE-OTHER', 'Tenant Settle Other');

        $user->outlets()->attach([
            $cashierOutlet->id => ['is_primary' => true],
            $otherOutlet->id => ['is_primary' => false],
        ]);

        $transaction = Transaction::create([
            'cashier_id' => $user->id,
            'outlet_id' => $cashierOutlet->id,
            'invoice' => 'TRX-SETTLE-1',
            'cash' => 18000,
            'change' => 0,
            'discount' => 0,
            'grand_total' => 18000,
            'payment_method' => 'cash',
            'payment_status' => 'paid',
        ]);

        $otherTransaction = Transaction::create([
            'cashier_id' => $user->id,
            'outlet_id' => $otherOutlet->id,
            'invoice' => 'TRX-SETTLE-2',
            'cash' => 10000,
            'change' => 0,
            'discount' => 0,
            'grand_total' => 10000,
            'payment_method' => 'cash',
            'payment_status' => 'paid',
        ]);

        $allocation = TransactionTenantAllocation::create([
            'transaction_id' => $transaction->id,
            'outlet_id' => $cashierOutlet->id,
            'tenant_outlet_id' => $tenant->id,
            'cashier_id' => $user->id,
            'allocation_number' => 'TA-SETTLE-1',
            'subtotal' => 18000,
            'promo_discount_total' => 0,
            'manual_discount_total' => 0,
            'loyalty_discount_total' => 0,
            'voucher_discount_total' => 0,
            'grand_total' => 18000,
            'payment_status' => 'paid',
            'kitchen_status' => 'pending',
        ]);

        $foreignAllocation = TransactionTenantAllocation::create([
            'transaction_id' => $otherTransaction->id,
            'outlet_id' => $otherOutlet->id,
            'tenant_outlet_id' => $otherTenant->id,
            'cashier_id' => $user->id,
            'allocation_number' => 'TA-SETTLE-2',
            'subtotal' => 10000,
            'promo_discount_total' => 0,
            'manual_discount_total' => 0,
            'loyalty_discount_total' => 0,
            'voucher_discount_total' => 0,
            'grand_total' => 10000,
            'payment_status' => 'paid',
            'kitchen_status' => 'pending',
        ]);

        $this->withSession([
            'active_outlet_id' => $cashierOutlet->id,
            'auth.password_confirmed_at' => time(),
        ])
            ->actingAs($user)
            ->patch(route('reports.sales.tenant-allocations.settle', $allocation), [
                'payout_reference' => 'SETTLE-001',
                'payout_notes' => 'Pembayaran tenant gelombang 1',
            ])
            ->assertRedirect();

        $this->assertNotNull($allocation->fresh()->settled_at);
        $this->assertSame('SETTLE-001', $allocation->fresh()->payout_reference);
        $this->assertSame('Pembayaran tenant gelombang 1', $allocation->fresh()->payout_notes);
        $this->assertNotNull($allocation->fresh()->payout_paid_at);

        $this->withSession([
            'active_outlet_id' => $cashierOutlet->id,
            'auth.password_confirmed_at' => time(),
        ])
            ->actingAs($user)
            ->patch(route('reports.sales.tenant-allocations.unsettle', $allocation))
            ->assertRedirect();

        $this->assertNull($allocation->fresh()->settled_at);
        $this->assertNull($allocation->fresh()->payout_reference);
        $this->assertNull($allocation->fresh()->payout_notes);
        $this->assertNull($allocation->fresh()->payout_paid_at);

        $this->withSession([
            'active_outlet_id' => $cashierOutlet->id,
            'auth.password_confirmed_at' => time(),
        ])
            ->actingAs($user)
            ->patch(route('reports.sales.tenant-allocations.settle', $foreignAllocation))
            ->assertNotFound();
    }

    public function test_sales_report_can_export_tenant_settlement_csv_for_active_outlet(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('reports-access');

        $cashierOutlet = $this->createOutlet('OUTLET-EXPORT', 'Outlet Export', true);
        $otherOutlet = $this->createOutlet('OUTLET-EXPORT-OTHER', 'Outlet Export Other');
        $tenantA = $this->createOutlet('TENANT-EXPORT-A', 'Tenant Export A');
        $tenantB = $this->createOutlet('TENANT-EXPORT-B', 'Tenant Export B');
        $tenantA->update(['commission_rate_percent' => 10]);

        $user->outlets()->attach([
            $cashierOutlet->id => ['is_primary' => true],
            $otherOutlet->id => ['is_primary' => false],
        ]);

        $transaction = Transaction::create([
            'cashier_id' => $user->id,
            'outlet_id' => $cashierOutlet->id,
            'invoice' => 'TRX-EXPORT-1',
            'cash' => 40000,
            'change' => 0,
            'discount' => 0,
            'grand_total' => 40000,
            'payment_method' => 'cash',
            'payment_status' => 'paid',
        ]);

        $otherTransaction = Transaction::create([
            'cashier_id' => $user->id,
            'outlet_id' => $otherOutlet->id,
            'invoice' => 'TRX-EXPORT-2',
            'cash' => 10000,
            'change' => 0,
            'discount' => 0,
            'grand_total' => 10000,
            'payment_method' => 'cash',
            'payment_status' => 'paid',
        ]);

        TransactionTenantAllocation::create([
            'transaction_id' => $transaction->id,
            'outlet_id' => $cashierOutlet->id,
            'tenant_outlet_id' => $tenantA->id,
            'cashier_id' => $user->id,
            'allocation_number' => 'TA-EXPORT-1',
            'subtotal' => 40000,
            'promo_discount_total' => 0,
            'manual_discount_total' => 0,
            'loyalty_discount_total' => 0,
            'voucher_discount_total' => 0,
            'grand_total' => 40000,
            'payment_status' => 'paid',
            'kitchen_status' => 'pending',
            'settled_at' => now(),
        ])->items()->create([
            'tenant_outlet_id' => $tenantA->id,
            'qty' => 2,
            'base_unit_price' => 12000,
            'line_total' => 40000,
            'discount_total' => 0,
        ]);

        TransactionTenantAllocation::create([
            'transaction_id' => $otherTransaction->id,
            'outlet_id' => $otherOutlet->id,
            'tenant_outlet_id' => $tenantB->id,
            'cashier_id' => $user->id,
            'allocation_number' => 'TA-EXPORT-2',
            'subtotal' => 10000,
            'promo_discount_total' => 0,
            'manual_discount_total' => 0,
            'loyalty_discount_total' => 0,
            'voucher_discount_total' => 0,
            'grand_total' => 10000,
            'payment_status' => 'paid',
            'kitchen_status' => 'pending',
        ]);

        $response = $this
            ->withSession(['active_outlet_id' => $cashierOutlet->id])
            ->actingAs($user)
            ->get(route('reports.sales.tenant-settlement.export', [
                'settlement_status' => 'settled',
            ]));

        $response->assertOk();
        $response->assertHeader('content-type', 'text/csv; charset=UTF-8');

        $content = $response->streamedContent();

        $this->assertStringContainsString('TA-EXPORT-1', $content);
        $this->assertStringContainsString('TRX-EXPORT-1', $content);
        $this->assertStringContainsString('settled', $content);
        $this->assertStringContainsString('24000', $content);
        $this->assertStringContainsString('16000', $content);
        $this->assertStringContainsString('40', $content);
        $this->assertStringContainsString('10', $content);
        $this->assertStringContainsString('1600', $content);
        $this->assertStringContainsString('14400', $content);
        $this->assertStringNotContainsString('TA-EXPORT-2', $content);
        $this->assertStringNotContainsString('TRX-EXPORT-2', $content);
    }

    private function createOutlet(string $code, string $name, bool $isDefault = false): Outlet
    {
        return Outlet::create([
            'code' => $code,
            'slug' => strtolower($code),
            'name' => $name,
            'commission_rate_percent' => 0,
            'is_active' => true,
            'is_default' => $isDefault,
            'sort_order' => 0,
        ]);
    }
}
