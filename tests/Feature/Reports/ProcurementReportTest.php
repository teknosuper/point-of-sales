<?php

namespace Tests\Feature\Reports;

use App\Models\Outlet;
use App\Models\Payable;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class ProcurementReportTest extends TestCase
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

    public function test_procurement_report_is_scoped_to_active_outlet(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('reports-access');

        $outletA = $this->createOutlet('OUTLET-A', 'Outlet A');
        $outletB = $this->createOutlet('OUTLET-B', 'Outlet B');
        $user->outlets()->attach([
            $outletA->id => ['is_primary' => true],
            $outletB->id => ['is_primary' => false],
        ]);

        $supplierA = Supplier::create([
            'outlet_id' => $outletA->id,
            'name' => 'Supplier A',
        ]);
        $supplierB = Supplier::create([
            'outlet_id' => $outletB->id,
            'name' => 'Supplier B',
        ]);

        PurchaseOrder::create([
            'outlet_id' => $outletA->id,
            'supplier_id' => $supplierA->id,
            'document_number' => 'PO-A-001',
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        PurchaseOrder::create([
            'outlet_id' => $outletB->id,
            'supplier_id' => $supplierB->id,
            'document_number' => 'PO-B-001',
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        Payable::create([
            'outlet_id' => $outletA->id,
            'supplier_id' => $supplierA->id,
            'document_number' => 'PAY-A-001',
            'total' => 200000,
            'paid' => 50000,
            'status' => 'partial',
        ]);

        Payable::create([
            'outlet_id' => $outletB->id,
            'supplier_id' => $supplierB->id,
            'document_number' => 'PAY-B-001',
            'total' => 400000,
            'paid' => 0,
            'status' => 'unpaid',
        ]);

        $this->withSession(['active_outlet_id' => $outletA->id])
            ->actingAs($user)
            ->get(route('reports.procurement.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Reports/Procurement')
                ->has('purchaseOrders', 1)
                ->where('purchaseOrders.0.document_number', 'PO-A-001')
                ->has('payables', 1)
                ->where('payables.0.document_number', 'PAY-A-001')
                ->has('suppliers', 1)
                ->where('suppliers.0.name', 'Supplier A')
            );
    }

    public function test_procurement_export_uses_active_outlet_scope(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('reports-access');

        $outletA = $this->createOutlet('OUTLET-A', 'Outlet A');
        $outletB = $this->createOutlet('OUTLET-B', 'Outlet B');
        $user->outlets()->attach([
            $outletA->id => ['is_primary' => true],
            $outletB->id => ['is_primary' => false],
        ]);

        $supplierA = Supplier::create([
            'outlet_id' => $outletA->id,
            'name' => 'Supplier A',
        ]);
        $supplierB = Supplier::create([
            'outlet_id' => $outletB->id,
            'name' => 'Supplier B',
        ]);

        PurchaseOrder::create([
            'outlet_id' => $outletA->id,
            'supplier_id' => $supplierA->id,
            'document_number' => 'PO-A-CSV',
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        PurchaseOrder::create([
            'outlet_id' => $outletB->id,
            'supplier_id' => $supplierB->id,
            'document_number' => 'PO-B-CSV',
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        $response = $this->withSession(['active_outlet_id' => $outletA->id])
            ->actingAs($user)
            ->get(route('reports.procurement.export'));

        $response->assertOk();
        $response->assertSee('PO-A-CSV');
        $response->assertDontSee('PO-B-CSV');
    }

    private function createOutlet(string $code, string $name): Outlet
    {
        return Outlet::create([
            'code' => $code,
            'name' => $name,
            'outlet_type' => 'main',
            'is_active' => true,
            'is_default' => false,
        ]);
    }
}
