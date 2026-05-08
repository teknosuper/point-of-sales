<?php

namespace Tests\Feature\Foodcourt;

use App\Models\Category;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\Transaction;
use App\Models\User;
use App\Services\FoodcourtTenantAllocationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FoodcourtTenantAllocationTest extends TestCase
{
    use RefreshDatabase;

    public function test_transaction_can_be_split_into_multiple_tenant_allocations(): void
    {
        $cashier = User::factory()->create();
        $cashierOutlet = $this->createOutlet('CASHIER-OUTLET', 'Kasir Foodcourt', true);
        $tenantA = $this->createOutlet('TENANT-AYAM', 'Tenant Ayam');
        $tenantB = $this->createOutlet('TENANT-MINUMAN', 'Tenant Minuman');

        $category = Category::create([
            'name' => 'Foodcourt',
            'description' => 'Foodcourt test',
            'image' => 'category.png',
        ]);

        $productA = Product::create([
            'category_id' => $category->id,
            'image' => 'ayam.png',
            'barcode' => 'BAR-AYAM-1',
            'sku' => 'SKU-AYAM-1',
            'title' => 'Ayam Geprek',
            'description' => 'Ayam tenant',
            'buy_price' => 12000,
            'sell_price' => 20000,
            'stock' => 100,
        ]);

        $productB = Product::create([
            'category_id' => $category->id,
            'image' => 'minum.png',
            'barcode' => 'BAR-MINUM-1',
            'sku' => 'SKU-MINUM-1',
            'title' => 'Es Teh',
            'description' => 'Minuman tenant',
            'buy_price' => 4000,
            'sell_price' => 8000,
            'stock' => 100,
        ]);

        $transaction = Transaction::create([
            'cashier_id' => $cashier->id,
            'outlet_id' => $cashierOutlet->id,
            'invoice' => 'TRX-FOODCOURT-1',
            'cash' => 36000,
            'change' => 0,
            'discount' => 0,
            'grand_total' => 36000,
            'payment_method' => 'cash',
            'payment_status' => 'paid',
        ]);

        $transaction->details()->create([
            'outlet_id' => $cashierOutlet->id,
            'tenant_outlet_id' => $tenantA->id,
            'product_id' => $productA->id,
            'qty' => 1,
            'base_unit_price' => 20000,
            'unit_price' => 20000,
            'price' => 20000,
            'discount_total' => 0,
        ]);

        $transaction->details()->create([
            'outlet_id' => $cashierOutlet->id,
            'tenant_outlet_id' => $tenantB->id,
            'product_id' => $productB->id,
            'qty' => 2,
            'base_unit_price' => 8000,
            'unit_price' => 8000,
            'price' => 16000,
            'discount_total' => 0,
        ]);

        $allocations = app(FoodcourtTenantAllocationService::class)
            ->rebuildForTransaction($transaction->fresh('details'));

        $this->assertCount(2, $allocations);
        $this->assertDatabaseHas('transaction_tenant_allocations', [
            'transaction_id' => $transaction->id,
            'tenant_outlet_id' => $tenantA->id,
            'grand_total' => 20000,
        ]);
        $this->assertDatabaseHas('transaction_tenant_allocations', [
            'transaction_id' => $transaction->id,
            'tenant_outlet_id' => $tenantB->id,
            'grand_total' => 16000,
        ]);
        $this->assertDatabaseHas('transaction_tenant_allocation_items', [
            'tenant_outlet_id' => $tenantA->id,
            'product_id' => $productA->id,
            'line_total' => 20000,
        ]);
        $this->assertDatabaseHas('transaction_tenant_allocation_items', [
            'tenant_outlet_id' => $tenantB->id,
            'product_id' => $productB->id,
            'line_total' => 16000,
        ]);
    }

    public function test_transaction_allocates_checkout_discounts_and_shipping_per_tenant(): void
    {
        $cashier = User::factory()->create();
        $cashierOutlet = $this->createOutlet('CASHIER-SHARED', 'Kasir Shared', true);
        $tenantA = $this->createOutlet('TENANT-STEAK', 'Tenant Steak');
        $tenantB = $this->createOutlet('TENANT-MINUMAN-2', 'Tenant Minuman');

        $category = Category::create([
            'name' => 'Foodcourt Split',
            'description' => 'Foodcourt allocation split',
            'image' => 'split.png',
        ]);

        $productA = Product::create([
            'category_id' => $category->id,
            'image' => 'steak.png',
            'barcode' => 'BAR-STEAK-1',
            'sku' => 'SKU-STEAK-1',
            'title' => 'Steak',
            'description' => 'Tenant steak',
            'buy_price' => 15000,
            'sell_price' => 20000,
            'stock' => 50,
        ]);

        $productB = Product::create([
            'category_id' => $category->id,
            'image' => 'tea.png',
            'barcode' => 'BAR-TEA-1',
            'sku' => 'SKU-TEA-1',
            'title' => 'Tea',
            'description' => 'Tenant tea',
            'buy_price' => 3000,
            'sell_price' => 10000,
            'stock' => 50,
        ]);

        $transaction = Transaction::create([
            'cashier_id' => $cashier->id,
            'outlet_id' => $cashierOutlet->id,
            'invoice' => 'TRX-FOODCOURT-SPLIT',
            'cash' => 27000,
            'change' => 0,
            'discount' => 1500,
            'loyalty_discount_total' => 1500,
            'customer_voucher_discount' => 3000,
            'shipping_cost' => 3000,
            'grand_total' => 27000,
            'payment_method' => 'cash',
            'payment_status' => 'paid',
        ]);

        $transaction->details()->create([
            'outlet_id' => $cashierOutlet->id,
            'tenant_outlet_id' => $tenantA->id,
            'product_id' => $productA->id,
            'qty' => 1,
            'base_unit_price' => 20000,
            'unit_price' => 20000,
            'price' => 20000,
            'discount_total' => 0,
        ]);

        $transaction->details()->create([
            'outlet_id' => $cashierOutlet->id,
            'tenant_outlet_id' => $tenantB->id,
            'product_id' => $productB->id,
            'qty' => 1,
            'base_unit_price' => 10000,
            'unit_price' => 10000,
            'price' => 10000,
            'discount_total' => 0,
        ]);

        app(FoodcourtTenantAllocationService::class)
            ->rebuildForTransaction($transaction->fresh('details'));

        $this->assertDatabaseHas('transaction_tenant_allocations', [
            'transaction_id' => $transaction->id,
            'tenant_outlet_id' => $tenantA->id,
            'subtotal' => 20000,
            'voucher_discount_total' => 2000,
            'loyalty_discount_total' => 1000,
            'manual_discount_total' => 1000,
            'grand_total' => 18000,
        ]);
        $this->assertDatabaseHas('transaction_tenant_allocations', [
            'transaction_id' => $transaction->id,
            'tenant_outlet_id' => $tenantB->id,
            'subtotal' => 10000,
            'voucher_discount_total' => 1000,
            'loyalty_discount_total' => 500,
            'manual_discount_total' => 500,
            'grand_total' => 9000,
        ]);
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
}
