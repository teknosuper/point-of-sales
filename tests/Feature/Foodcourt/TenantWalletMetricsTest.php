<?php

namespace Tests\Feature\Foodcourt;

use App\Models\Category;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use App\Models\TransactionTenantAllocation;
use App\Models\TransactionTenantAllocationItem;
use App\Models\User;
use App\Support\TenantWalletMetrics;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Tests untuk TenantWalletMetrics::sumTenantNetValueForAllocationIds
 *
 * Memverifikasi:
 * 1. Hak tenant net tidak bisa melebihi harga bayar pelanggan (LEAST guard)
 * 2. Markup owner tidak masuk ke hak tenant net
 * 3. Kalkulasi normal tanpa markup berjalan benar
 * 4. Collection kosong mengembalikan 0
 */
class TenantWalletMetricsTest extends TestCase
{
    use RefreshDatabase;

    private function createOutlet(string $code, string $name, bool $isDefault = false): Outlet
    {
        return Outlet::create([
            'code'       => $code,
            'slug'       => strtolower(str_replace('-', '_', $code)),
            'name'       => $name,
            'is_active'  => true,
            'is_default' => $isDefault,
            'sort_order' => 0,
        ]);
    }

    private function createProduct(Outlet $tenantOutlet, int $buyPrice, int $sellPrice): Product
    {
        $category = Category::firstOrCreate(
            ['name' => 'Test Category'],
            ['description' => 'Test', 'image' => 'test.png']
        );

        return Product::create([
            'category_id'      => $category->id,
            'tenant_outlet_id' => $tenantOutlet->id,
            'image'            => 'test.png',
            'barcode'          => 'TEST-' . uniqid(),
            'sku'              => 'SKU-' . uniqid(),
            'title'            => 'Test Product',
            'description'      => 'Test product',
            'buy_price'        => $buyPrice,
            'sell_price'       => $sellPrice,
            'stock'            => 100,
        ]);
    }

    private function createAllocationWithItem(
        Outlet $mainOutlet,
        Outlet $tenantOutlet,
        User $cashier,
        int $subtotal,
        int $customerUnitPrice,
        int $tenantBaseUnitPrice,
        int $ownerMarkupUnitPrice,
        int $qty = 1
    ): TransactionTenantAllocation {
        $product = $this->createProduct($tenantOutlet, $tenantBaseUnitPrice, $customerUnitPrice);

        $transaction = Transaction::create([
            'cashier_id'     => $cashier->id,
            'outlet_id'      => $mainOutlet->id,
            'invoice'        => 'TEST-' . uniqid(),
            'cash'           => $subtotal,
            'change'         => 0,
            'discount'       => 0,
            'grand_total'    => $subtotal,
            'payment_method' => 'cash',
            'payment_status' => 'paid',
        ]);

        $detail = TransactionDetail::create([
            'transaction_id'           => $transaction->id,
            'outlet_id'                => $mainOutlet->id,
            'tenant_outlet_id'         => $tenantOutlet->id,
            'product_id'               => $product->id,
            'qty'                      => $qty,
            'unit_price'               => $customerUnitPrice,
            'price'                    => $customerUnitPrice * $qty,
            'customer_base_unit_price' => $customerUnitPrice,
            'tenant_base_unit_price'   => $tenantBaseUnitPrice,
            'owner_markup_unit_price'  => $ownerMarkupUnitPrice,
        ]);

        $allocation = TransactionTenantAllocation::create([
            'transaction_id'  => $transaction->id,
            'outlet_id'       => $mainOutlet->id,
            'tenant_outlet_id' => $tenantOutlet->id,
            'cashier_id'      => $cashier->id,
            'allocation_number' => 'ALLOC-' . uniqid(),
            'subtotal'        => $subtotal,
            'grand_total'     => $subtotal,
            'waiter_status'   => 'delivered',
            'delivered_at'    => now(),
        ]);

        TransactionTenantAllocationItem::create([
            'transaction_tenant_allocation_id' => $allocation->id,
            'transaction_detail_id'            => $detail->id,
            'tenant_outlet_id'                 => $tenantOutlet->id,
            'qty'                              => $qty,
            'base_unit_price'                  => $tenantBaseUnitPrice,
            'unit_price'                       => $customerUnitPrice,
            'line_total'                       => $customerUnitPrice * $qty,
        ]);

        return $allocation;
    }

    /**
     * Test kalkulasi normal: tenant_base_unit_price < customer_base_unit_price
     * Hak tenant = tenant_base_unit_price * qty
     */
    public function test_tenant_net_equals_tenant_base_price_when_below_customer_price(): void
    {
        $mainOutlet   = $this->createOutlet('MAIN-1', 'Outlet Utama', true);
        $tenantOutlet = $this->createOutlet('TENANT-1', 'Tenant A');
        $cashier      = User::factory()->create();

        // harga pelanggan = 25.000, harga dasar tenant = 18.000, markup = 7.000
        $allocation = $this->createAllocationWithItem(
            mainOutlet:          $mainOutlet,
            tenantOutlet:        $tenantOutlet,
            cashier:             $cashier,
            subtotal:            25000,
            customerUnitPrice:   25000,
            tenantBaseUnitPrice: 18000,
            ownerMarkupUnitPrice: 7000,
            qty:                 1
        );

        $net = TenantWalletMetrics::sumTenantNetValueForAllocationIds(
            collect([$allocation->id])
        );

        // Hak tenant seharusnya 18.000, bukan 25.000
        $this->assertEquals(18000, $net);
        $this->assertLessThan(25000, $net, 'Tenant net tidak boleh melebihi harga pelanggan');
    }

    /**
     * Test LEAST guard: jika tenant_base_unit_price > customer_base_unit_price
     * (data inconsistency), tenant net harus dikap di customer_base_unit_price
     */
    public function test_tenant_net_is_capped_at_customer_price_when_tenant_base_exceeds_it(): void
    {
        $mainOutlet   = $this->createOutlet('MAIN-2', 'Outlet Utama 2', true);
        $tenantOutlet = $this->createOutlet('TENANT-2', 'Tenant B');
        $cashier      = User::factory()->create();

        // Skenario data inconsistency: tenant_base = 25.000 > customer = 18.000
        $allocation = $this->createAllocationWithItem(
            mainOutlet:          $mainOutlet,
            tenantOutlet:        $tenantOutlet,
            cashier:             $cashier,
            subtotal:            18000,
            customerUnitPrice:   18000,
            tenantBaseUnitPrice: 25000,  // LEBIH BESAR dari harga pelanggan — data inconsistency
            ownerMarkupUnitPrice: 0,
            qty:                 1
        );

        $net = TenantWalletMetrics::sumTenantNetValueForAllocationIds(
            collect([$allocation->id])
        );

        // LEAST guard: net tidak boleh melebihi harga pelanggan (18.000)
        $this->assertLessThanOrEqual(18000, $net, 'Tenant net tidak boleh melebihi harga bayar pelanggan');
        $this->assertEquals(18000, $net, 'LEAST guard harus menghasilkan customer_price (18000)');
    }

    /**
     * Test multi-item: verifikasi agregasi benar untuk beberapa alokasi
     */
    public function test_tenant_net_aggregates_correctly_across_multiple_allocations(): void
    {
        $mainOutlet   = $this->createOutlet('MAIN-3', 'Outlet Utama 3', true);
        $tenantOutlet = $this->createOutlet('TENANT-3', 'Tenant C');
        $cashier      = User::factory()->create();

        // Alokasi 1: hak tenant = 18.000
        $alloc1 = $this->createAllocationWithItem(
            mainOutlet:          $mainOutlet,
            tenantOutlet:        $tenantOutlet,
            cashier:             $cashier,
            subtotal:            25000,
            customerUnitPrice:   25000,
            tenantBaseUnitPrice: 18000,
            ownerMarkupUnitPrice: 7000,
            qty:                 1
        );

        // Alokasi 2: hak tenant = 30.000 (qty=2 x 15.000)
        $alloc2 = $this->createAllocationWithItem(
            mainOutlet:          $mainOutlet,
            tenantOutlet:        $tenantOutlet,
            cashier:             $cashier,
            subtotal:            40000,
            customerUnitPrice:   20000,
            tenantBaseUnitPrice: 15000,
            ownerMarkupUnitPrice: 5000,
            qty:                 2
        );

        $net = TenantWalletMetrics::sumTenantNetValueForAllocationIds(
            collect([$alloc1->id, $alloc2->id])
        );

        // 18.000 + (15.000 * 2) = 48.000
        $this->assertEquals(48000, $net);
    }

    /**
     * Test collection kosong mengembalikan 0
     */
    public function test_returns_zero_for_empty_collection(): void
    {
        $net = TenantWalletMetrics::sumTenantNetValueForAllocationIds(collect());

        $this->assertEquals(0, $net);
    }

    /**
     * Test markup owner tidak masuk ke tenant net
     * gross = tenant_net + markup_owner
     */
    public function test_owner_markup_is_excluded_from_tenant_net(): void
    {
        $mainOutlet   = $this->createOutlet('MAIN-4', 'Outlet Utama 4', true);
        $tenantOutlet = $this->createOutlet('TENANT-4', 'Tenant D');
        $cashier      = User::factory()->create();

        $customerPrice   = 30000;
        $tenantBasePrice = 20000;
        $ownerMarkup     = 10000; // $customerPrice - $tenantBasePrice

        $allocation = $this->createAllocationWithItem(
            mainOutlet:          $mainOutlet,
            tenantOutlet:        $tenantOutlet,
            cashier:             $cashier,
            subtotal:            $customerPrice,
            customerUnitPrice:   $customerPrice,
            tenantBaseUnitPrice: $tenantBasePrice,
            ownerMarkupUnitPrice: $ownerMarkup,
            qty:                 1
        );

        $net    = TenantWalletMetrics::sumTenantNetValueForAllocationIds(collect([$allocation->id]));
        $markup = TenantWalletMetrics::sumOwnerMarkupValueForAllocationIds(collect([$allocation->id]));

        // Verifikasi pemisahan:
        // 1. net = tenant_base_price (bukan customer_price)
        $this->assertEquals($tenantBasePrice, $net);
        // 2. markup = owner_markup
        $this->assertEquals($ownerMarkup, $markup);
        // 3. net + markup = customer_price (rekonsiliasi)
        $this->assertEquals($customerPrice, $net + $markup, 'gross = tenant_net + owner_markup harus seimbang');
    }
}
