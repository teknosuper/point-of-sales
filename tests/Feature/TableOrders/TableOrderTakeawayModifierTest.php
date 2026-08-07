<?php

namespace Tests\Feature\TableOrders;

use App\Models\Category;
use App\Models\Customer;
use App\Models\DiningTable;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\ProductModifierOption;
use App\Models\ProductOutletStock;
use App\Models\TableOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TableOrderTakeawayModifierTest extends TestCase
{
    use RefreshDatabase;

    public function test_take_away_item_without_bungkus_modifier_is_rejected_from_table(): void
    {
        [$outlet, $table, $product, $bungkus, $customer] = $this->createFixture();

        $this->withSession([
            "public_table_order.customer_id.{$outlet->id}" => $customer->id,
        ])->postJson(route('table-order.store', $table->qr_token), [
            'items' => [
                [
                    'product_id' => $product->id,
                    'qty' => 1,
                    'order_type' => 'take_away',
                    'modifiers' => [],
                ],
            ],
        ])->assertStatus(422);

        $this->assertDatabaseMissing('table_orders', [
            'outlet_id' => $outlet->id,
        ]);
    }

    public function test_dine_in_item_without_bungkus_modifier_is_accepted_from_table(): void
    {
        [$outlet, $table, $product, $bungkus, $customer] = $this->createFixture();

        $this->withSession([
            "public_table_order.customer_id.{$outlet->id}" => $customer->id,
        ])->post(route('table-order.store', $table->qr_token), [
            'items' => [
                [
                    'product_id' => $product->id,
                    'qty' => 1,
                    'order_type' => 'dine_in',
                    'notes' => 'Tanpa es',
                    'modifiers' => [],
                ],
            ],
        ])->assertRedirect();

        $order = TableOrder::query()->latest('id')->firstOrFail();

        $this->assertSame('dine_in', $order->items()->firstOrFail()->order_type);
        $this->assertSame('Tanpa es', $order->items()->firstOrFail()->notes);
    }

    public function test_take_away_item_with_bungkus_modifier_is_accepted_and_tagged_from_table(): void
    {
        [$outlet, $table, $product, $bungkus, $customer] = $this->createFixture();

        $this->withSession([
            "public_table_order.customer_id.{$outlet->id}" => $customer->id,
        ])->post(route('table-order.store', $table->qr_token), [
            'items' => [
                [
                    'product_id' => $product->id,
                    'qty' => 1,
                    'order_type' => 'take_away',
                    'notes' => '[TAKE AWAY] Dibungkus',
                    'modifiers' => [
                        ['id' => $bungkus->id],
                    ],
                ],
            ],
        ])->assertRedirect();

        $order = TableOrder::query()->latest('id')->firstOrFail();

        $this->assertSame('take_away', $order->items()->firstOrFail()->order_type);
        $this->assertSame('[TAKE AWAY] Dibungkus', $order->items()->firstOrFail()->notes);
        $this->assertDatabaseHas('table_order_item_modifiers', [
            'name' => 'Bungkus',
        ]);
    }

    private function createFixture(): array
    {
        $outlet = Outlet::create([
            'code' => 'OUTLET-TA',
            'slug' => 'outlet-ta',
            'name' => 'Outlet TA',
            'legal_name' => 'Outlet TA',
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

        $table = DiningTable::create([
            'outlet_id' => $outlet->id,
            'name' => 'Meja TA',
            'code' => 'TA1',
            'qr_token' => 'table-ta-token',
            'capacity' => 4,
            'status' => 'active',
            'self_order_enabled' => true,
            'sort_order' => 1,
        ]);

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
            'supports_modifiers' => true,
            'publish_status' => 'approved',
            'stock' => 10,
        ]);

        ProductOutletStock::create([
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'stock' => 10,
            'reorder_level' => 0,
        ]);

        $bungkus = ProductModifierOption::create([
            'product_id' => $product->id,
            'name' => 'Bungkus',
            'price' => 1000,
            'is_active' => true,
            'sort_order' => 1,
            'group_name' => 'Bungkus',
            'selection_mode' => 'required',
            'min_select' => 1,
            'order_type_scope' => 'take_away',
        ]);

        $customer = Customer::create([
            'name' => 'Budi',
            'no_telp' => '08123456789',
            'email' => 'budi@example.com',
            'address' => 'Jl. Mawar No. 1',
        ]);

        return [$outlet, $table, $product, $bungkus, $customer];
    }
}
