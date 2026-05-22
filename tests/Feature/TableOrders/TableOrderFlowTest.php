<?php

namespace Tests\Feature\TableOrders;

use App\Models\CashierShift;
use App\Models\Category;
use App\Models\Customer;
use App\Models\DiningTable;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\ProductModifierOption;
use App\Models\ProductOutletStock;
use App\Models\TableOrder;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class TableOrderFlowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'dashboard-access',
            'table-orders-access',
            'table-orders-approve',
        ] as $permission) {
            Permission::firstOrCreate([
                'name' => $permission,
                'guard_name' => 'web',
            ]);
        }
    }

    public function test_public_table_order_can_be_created_from_qr_link(): void
    {
        $outlet = $this->createOutlet();
        $table = DiningTable::create([
            'outlet_id' => $outlet->id,
            'name' => 'Meja 01',
            'code' => 'A1',
            'qr_token' => 'table-01-token',
            'capacity' => 4,
            'status' => 'active',
            'self_order_enabled' => true,
            'sort_order' => 1,
        ]);

        $product = $this->createProduct($outlet);
        $modifier = ProductModifierOption::create([
            'product_id' => $product->id,
            'name' => 'Extra Telur',
            'price' => 5000,
            'is_active' => true,
            'sort_order' => 1,
        ]);
        $customer = Customer::create([
            'name' => 'Budi',
            'no_telp' => '08123456789',
            'email' => 'budi@example.com',
            'address' => 'Jl. Mawar No. 1',
            'is_loyalty_member' => true,
            'member_code' => 'MBR-001',
            'loyalty_tier' => 'silver',
            'loyalty_points' => 120,
        ]);

        $this->post(route('table-order.identify', $table->qr_token), [
            'no_telp' => $customer->no_telp,
        ])->assertRedirect(route('table-order.show', $table->qr_token));

        $this->withSession([
            "public_table_order.customer_id.{$outlet->id}" => $customer->id,
        ])->post(route('table-order.store', $table->qr_token), [
            'notes' => 'Tolong cepat',
            'items' => [
                [
                    'product_id' => $product->id,
                    'qty' => 2,
                    'notes' => 'Tanpa es',
                    'modifiers' => [
                        ['id' => $modifier->id],
                    ],
                ],
            ],
        ])->assertRedirect();

        $this->assertDatabaseHas('table_orders', [
            'outlet_id' => $outlet->id,
            'dining_table_id' => $table->id,
            'customer_id' => $customer->id,
            'customer_name' => 'Budi',
            'customer_phone' => '08123456789',
            'customer_email' => 'budi@example.com',
            'status' => 'pending_cashier_payment',
            'grand_total' => 60000,
        ]);

        $this->assertDatabaseHas('table_order_item_modifiers', [
            'name' => 'Extra Telur',
            'qty' => 2,
            'unit_price' => 5000,
            'total_price' => 10000,
        ]);
    }

    public function test_public_table_order_can_register_new_customer_from_pending_phone(): void
    {
        $outlet = $this->createOutlet();
        $table = DiningTable::create([
            'outlet_id' => $outlet->id,
            'name' => 'Meja 02',
            'code' => 'A2',
            'qr_token' => 'table-02-token',
            'capacity' => 4,
            'status' => 'active',
            'self_order_enabled' => true,
            'sort_order' => 2,
        ]);

        $this->withSession([
            "public_table_order.pending_phone.{$outlet->id}" => '081277788899',
        ])->post(route('table-order.register-identity', $table->qr_token), [
            'name' => 'Sinta',
            'email' => 'sinta@example.com',
            'address' => 'Jl. Melati No. 2',
        ])->assertRedirect(route('table-order.show', $table->qr_token));

        $this->assertDatabaseHas('customers', [
            'name' => 'Sinta',
            'no_telp' => '081277788899',
            'email' => 'sinta@example.com',
        ]);
    }

    public function test_cashier_can_approve_table_order_and_create_transaction(): void
    {
        $cashier = User::factory()->create();
        $cashier->givePermissionTo([
            'dashboard-access',
            'table-orders-access',
            'table-orders-approve',
        ]);

        $outlet = $this->createOutlet();
        $cashier->outlets()->attach($outlet->id, ['is_primary' => true]);

        CashierShift::create([
            'user_id' => $cashier->id,
            'outlet_id' => $outlet->id,
            'opened_by' => $cashier->id,
            'opened_at' => now(),
            'opening_cash' => 0,
            'status' => CashierShift::STATUS_OPEN,
        ]);

        $table = DiningTable::create([
            'outlet_id' => $outlet->id,
            'name' => 'Meja 01',
            'code' => 'A1',
            'qr_token' => 'table-01-token',
            'capacity' => 4,
            'status' => 'active',
            'self_order_enabled' => true,
            'sort_order' => 1,
        ]);

        $product = $this->createProduct($outlet);
        $modifier = ProductModifierOption::create([
            'product_id' => $product->id,
            'name' => 'Extra Telur',
            'price' => 5000,
            'is_active' => true,
            'sort_order' => 1,
        ]);
        $customer = Customer::create([
            'name' => 'Budi',
            'no_telp' => '08123456789',
            'email' => 'budi@example.com',
            'address' => 'Jl. Mawar No. 1',
            'is_loyalty_member' => true,
            'member_code' => 'MBR-001',
            'loyalty_tier' => 'silver',
            'loyalty_points' => 120,
        ]);

        $order = TableOrder::create([
            'outlet_id' => $outlet->id,
            'dining_table_id' => $table->id,
            'customer_id' => $customer->id,
            'order_number' => 'TBL-ABC12345',
            'access_token' => 'access-token-01',
            'customer_name' => $customer->name,
            'customer_phone' => $customer->no_telp,
            'customer_email' => $customer->email,
            'payment_method' => 'cash',
            'status' => 'pending_cashier_payment',
            'subtotal' => 30000,
            'grand_total' => 30000,
        ]);

        $order->items()->create([
            'product_id' => $product->id,
            'tenant_outlet_id' => $outlet->id,
            'product_title' => $product->title,
            'qty' => 1,
            'base_unit_price' => 25000,
            'unit_price' => 25000,
            'line_total' => 30000,
            'discount_total' => 4000,
            'pricing_rule_name' => 'Promo Tenant Lunch',
            'pricing_rule_kind' => 'standard_discount',
            'pricing_group_key' => 'rule-1',
            'pricing_group_label' => 'Promo Tenant Lunch',
            'notes' => 'Pedas sedang',
        ])->modifiers()->create([
            'product_modifier_option_id' => $modifier->id,
            'name' => 'Extra Telur',
            'qty' => 1,
            'unit_price' => 5000,
            'total_price' => 5000,
        ]);

        $this->withSession(['active_outlet_id' => $outlet->id])
            ->actingAs($cashier)
            ->post(route('table-orders.approve', $order))
            ->assertRedirect(route('table-orders.index'));

        $order->refresh();

        $this->assertSame('paid', $order->status);
        $this->assertNotNull($order->transaction_id);
        $this->assertDatabaseHas('transactions', [
            'id' => $order->transaction_id,
            'outlet_id' => $outlet->id,
            'customer_id' => $customer->id,
            'table_id' => $table->id,
            'payment_method' => 'cash',
            'payment_status' => 'paid',
        ]);
        $this->assertDatabaseHas('transaction_detail_modifiers', [
            'name' => 'Extra Telur',
            'qty' => 1,
            'unit_price' => 5000,
            'total_price' => 5000,
        ]);
        $this->assertDatabaseHas('transaction_details', [
            'transaction_id' => $order->transaction_id,
            'product_id' => $product->id,
            'base_unit_price' => 25000,
            'unit_price' => 25000,
            'price' => 30000,
            'discount_total' => 4000,
            'pricing_rule_name' => 'Promo Tenant Lunch',
            'pricing_rule_kind' => 'standard_discount',
            'pricing_group_label' => 'Promo Tenant Lunch',
        ]);
    }

    private function createOutlet(): Outlet
    {
        return Outlet::create([
            'code' => 'OUTLET-A',
            'slug' => 'outlet-a',
            'name' => 'Outlet A',
            'legal_name' => 'Outlet A',
            'address' => 'Jl. Test No. 1',
            'city' => 'Jakarta',
            'phone' => '08123456789',
            'email' => 'outlet@example.com',
            'website' => 'https://example.com',
            'outlet_type' => 'main',
            'commission_rate_percent' => 0,
            'is_active' => true,
            'is_default' => true,
            'sort_order' => 1,
        ]);
    }

    private function createProduct(Outlet $outlet): Product
    {
        $category = Category::create([
            'image' => 'placeholder.jpg',
            'name' => 'Makanan',
            'description' => 'Kategori makanan',
        ]);

        $product = Product::create([
            'image' => 'placeholder.jpg',
            'barcode' => '8990001',
            'sku' => 'SKU-001',
            'title' => 'Nasi Goreng',
            'description' => 'Menu self-order',
            'buy_price' => 10000,
            'sell_price' => 25000,
            'category_id' => $category->id,
            'tenant_outlet_id' => $outlet->id,
            'supports_modifiers' => false,
            'stock' => 10,
        ]);

        ProductOutletStock::create([
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'stock' => 10,
            'reorder_level' => 0,
        ]);

        return $product;
    }
}
