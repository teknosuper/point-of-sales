<?php

namespace Tests\Feature\Reports;

use App\Models\Outlet;
use App\Models\Product;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class ProfitReportItemTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Permission::firstOrCreate([
            'name' => 'profits-access',
            'guard_name' => 'web',
        ]);
    }

    public function test_profit_report_shows_item_breakdown_for_active_outlet(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('profits-access');

        $activeOutlet = $this->createOutlet('OUTLET-A', 'Outlet A', true);
        $otherOutlet = $this->createOutlet('OUTLET-B', 'Outlet B');
        $user->outlets()->attach([
            $activeOutlet->id => ['is_primary' => true],
            $otherOutlet->id => ['is_primary' => false],
        ]);

        $productA = Product::create([
            'title' => 'Ayam Bakar',
            'buy_price' => 15000,
            'sell_price' => 25000,
            'stock' => 10,
        ]);
        $productB = Product::create([
            'title' => 'Es Jeruk',
            'buy_price' => 4000,
            'sell_price' => 9000,
            'stock' => 10,
        ]);

        $transactionA = Transaction::create([
            'cashier_id' => $user->id,
            'outlet_id' => $activeOutlet->id,
            'invoice' => 'TRX-PROFIT-ITEM-1',
            'cash' => 50000,
            'change' => 0,
            'discount' => 0,
            'grand_total' => 34000,
            'payment_method' => 'cash',
            'payment_status' => 'paid',
        ]);

        TransactionDetail::create([
            'transaction_id' => $transactionA->id,
            'outlet_id' => $activeOutlet->id,
            'product_id' => $productA->id,
            'qty' => 1,
            'base_unit_price' => 15000,
            'price' => 25000,
            'unit_price' => 25000,
            'owner_discount_total' => 2000,
            'owner_net_total' => 23000,
        ]);

        TransactionDetail::create([
            'transaction_id' => $transactionA->id,
            'outlet_id' => $activeOutlet->id,
            'product_id' => $productB->id,
            'qty' => 1,
            'base_unit_price' => 4000,
            'price' => 9000,
            'unit_price' => 9000,
            'tenant_discount_total' => 1000,
            'tenant_net_total' => 8000,
        ]);

        $transactionB = Transaction::create([
            'cashier_id' => $user->id,
            'outlet_id' => $otherOutlet->id,
            'invoice' => 'TRX-PROFIT-ITEM-2',
            'cash' => 10000,
            'change' => 0,
            'discount' => 0,
            'grand_total' => 10000,
            'payment_method' => 'cash',
            'payment_status' => 'paid',
        ]);

        TransactionDetail::create([
            'transaction_id' => $transactionB->id,
            'outlet_id' => $otherOutlet->id,
            'product_id' => $productA->id,
            'qty' => 1,
            'base_unit_price' => 15000,
            'price' => 25000,
            'unit_price' => 25000,
        ]);

        $this->withSession(['active_outlet_id' => $activeOutlet->id])
            ->actingAs($user)
            ->get(route('reports.profits.index', ['item_keyword' => 'Ayam']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Reports/Profit')
                ->where('filters.item_keyword', 'Ayam')
                ->has('itemBreakdown.data', 1)
                ->where('itemBreakdown.data.0.product_name', 'Ayam Bakar')
                ->where('itemBreakdown.data.0.orders_count', 1)
                ->where('itemBreakdown.data.0.qty_sold', 1)
                ->where('itemBreakdown.data.0.gross_profit_total', 10000)
            );
    }

    public function test_profit_item_export_respects_active_filters(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('profits-access');

        $activeOutlet = $this->createOutlet('OUTLET-A', 'Outlet A', true);
        $user->outlets()->attach($activeOutlet->id, ['is_primary' => true]);

        $product = Product::create([
            'title' => 'Mie Goreng',
            'buy_price' => 12000,
            'sell_price' => 22000,
            'stock' => 10,
        ]);

        $transaction = Transaction::create([
            'cashier_id' => $user->id,
            'outlet_id' => $activeOutlet->id,
            'invoice' => 'TRX-EXPORT-1',
            'cash' => 22000,
            'change' => 0,
            'discount' => 0,
            'grand_total' => 22000,
            'payment_method' => 'cash',
            'payment_status' => 'paid',
        ]);

        TransactionDetail::create([
            'transaction_id' => $transaction->id,
            'outlet_id' => $activeOutlet->id,
            'product_id' => $product->id,
            'qty' => 2,
            'base_unit_price' => 12000,
            'price' => 22000,
            'unit_price' => 11000,
        ]);

        $response = $this->withSession(['active_outlet_id' => $activeOutlet->id])
            ->actingAs($user)
            ->get(route('reports.profits.items.export', ['item_keyword' => 'Mie']));

        $response->assertOk();
        $response->assertHeader('content-type', 'text/csv; charset=UTF-8');
        $response->assertSee('Mie Goreng');
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
