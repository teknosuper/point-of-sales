<?php

namespace Tests\Feature\Foodcourt;

use App\Models\Category;
use App\Models\CashierSettlementRequest;
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
 * Tests untuk pemisahan markup owner dari hak tenant di settlement.
 *
 * Memverifikasi:
 * 1. tenant_sales_total (saldo masuk) = net bukan gross
 * 2. available_balance = net - approved - pending
 * 3. owner_markup_total terpisah dari tenant_sales_total
 * 4. approved_amount tidak overstated saldo tenant
 */
class TenantSettlementReconciliationTest extends TestCase
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

    private function createDeliveredAllocation(
        Outlet $mainOutlet,
        Outlet $tenantOutlet,
        User $cashier,
        int $customerUnitPrice,
        int $tenantBaseUnitPrice,
        int $ownerMarkupUnitPrice,
        int $qty = 1
    ): TransactionTenantAllocation {
        $product = $this->createProduct($tenantOutlet, $tenantBaseUnitPrice, $customerUnitPrice);
        $subtotal = $customerUnitPrice * $qty;

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
            'price'                    => $subtotal,
            'customer_base_unit_price' => $customerUnitPrice,
            'tenant_base_unit_price'   => $tenantBaseUnitPrice,
            'owner_markup_unit_price'  => $ownerMarkupUnitPrice,
        ]);

        $allocation = TransactionTenantAllocation::create([
            'transaction_id'   => $transaction->id,
            'outlet_id'        => $mainOutlet->id,
            'tenant_outlet_id' => $tenantOutlet->id,
            'cashier_id'       => $cashier->id,
            'allocation_number' => 'ALLOC-' . uniqid(),
            'subtotal'         => $subtotal,
            'grand_total'      => $subtotal,
            'waiter_status'    => 'delivered',
            'delivered_at'     => now(),
        ]);

        TransactionTenantAllocationItem::create([
            'transaction_tenant_allocation_id' => $allocation->id,
            'transaction_detail_id'            => $detail->id,
            'tenant_outlet_id'                 => $tenantOutlet->id,
            'qty'                              => $qty,
            'base_unit_price'                  => $tenantBaseUnitPrice,
            'unit_price'                       => $customerUnitPrice,
            'line_total'                       => $subtotal,
        ]);

        return $allocation;
    }

    /**
     * Verifikasi bahwa tenant_net < gross_subtotal ketika ada markup owner.
     * gross = tenant_net + markup_owner (rekonsiliasi harus seimbang).
     */
    public function test_tenant_net_is_less_than_gross_when_markup_exists(): void
    {
        $mainOutlet   = $this->createOutlet('MAIN-R1', 'Outlet Utama R1', true);
        $tenantOutlet = $this->createOutlet('TENANT-R1', 'Tenant R1');
        $cashier      = User::factory()->create();

        // 3 transaksi: customer price 25.000, tenant base 18.000, markup 7.000
        $allocations = collect();
        for ($i = 0; $i < 3; $i++) {
            $allocations->push(
                $this->createDeliveredAllocation(
                    mainOutlet:           $mainOutlet,
                    tenantOutlet:         $tenantOutlet,
                    cashier:              $cashier,
                    customerUnitPrice:    25000,
                    tenantBaseUnitPrice:  18000,
                    ownerMarkupUnitPrice: 7000,
                    qty:                  1
                )
            );
        }

        $allocationIds = $allocations->pluck('id');
        $grossSubtotal = $allocations->sum('subtotal'); // 3 × 25.000 = 75.000
        $tenantNet     = TenantWalletMetrics::sumTenantNetValueForAllocationIds($allocationIds);
        $ownerMarkup   = TenantWalletMetrics::sumOwnerMarkupValueForAllocationIds($allocationIds);

        // 1. Tenant net = 3 × 18.000 = 54.000
        $this->assertEquals(54000, $tenantNet);

        // 2. Markup owner = 3 × 7.000 = 21.000
        $this->assertEquals(21000, $ownerMarkup);

        // 3. Rekonsiliasi: gross = tenant_net + markup_owner
        $this->assertEquals($grossSubtotal, $tenantNet + $ownerMarkup,
            'gross_subtotal harus = tenant_net + owner_markup (rekonsiliasi harus seimbang)');

        // 4. Tenant net tidak boleh melebihi gross subtotal
        $this->assertLessThan($grossSubtotal, $tenantNet,
            'tenant_net harus lebih kecil dari gross saat markup > 0');
    }

    /**
     * Verifikasi bahwa available_balance = tenant_net - approved_total
     * dan tidak melebihi gross subtotal.
     */
    public function test_available_balance_is_net_minus_approved(): void
    {
        $mainOutlet   = $this->createOutlet('MAIN-R2', 'Outlet Utama R2', true);
        $tenantOutlet = $this->createOutlet('TENANT-R2', 'Tenant R2');
        $cashier      = User::factory()->create();

        // 2 transaksi: gross total = 50.000, tenant net = 36.000, markup = 14.000
        $allocations = collect();
        for ($i = 0; $i < 2; $i++) {
            $allocations->push(
                $this->createDeliveredAllocation(
                    mainOutlet:           $mainOutlet,
                    tenantOutlet:         $tenantOutlet,
                    cashier:              $cashier,
                    customerUnitPrice:    25000,
                    tenantBaseUnitPrice:  18000,
                    ownerMarkupUnitPrice: 7000,
                    qty:                  1
                )
            );
        }

        // Tenant sudah withdraw 10.000 (approved)
        CashierSettlementRequest::create([
            'outlet_id'        => $tenantOutlet->id,
            'cashier_id'       => $cashier->id,
            'cashier_shift_id' => null,
            'request_number'   => 'TWR-' . uniqid(),
            'business_date'    => now()->toDateString(),
            'base_sales_total' => 36000,
            'requested_amount' => 10000,
            'approved_amount'  => 10000,
            'status'           => CashierSettlementRequest::STATUS_APPROVED,
        ]);

        $allocationIds = $allocations->pluck('id');
        $tenantNet     = TenantWalletMetrics::sumTenantNetValueForAllocationIds($allocationIds);
        $approvedTotal = CashierSettlementRequest::where('outlet_id', $tenantOutlet->id)
            ->whereNull('cashier_shift_id')
            ->where('status', CashierSettlementRequest::STATUS_APPROVED)
            ->sum('approved_amount');

        $availableBalance = max(0, $tenantNet - $approvedTotal);

        // Tenant net = 36.000, approved = 10.000, available = 26.000
        $this->assertEquals(36000, $tenantNet);
        $this->assertEquals(10000, $approvedTotal);
        $this->assertEquals(26000, $availableBalance);

        // Available balance tidak boleh melebihi tenant net
        $this->assertLessThanOrEqual($tenantNet, $availableBalance);
    }

    /**
     * Verifikasi bahwa markup owner tidak bisa ditarik sebagai saldo tenant.
     * approved_amount tidak boleh melebihi tenant_net.
     */
    public function test_withdrawal_cannot_exceed_tenant_net(): void
    {
        $mainOutlet   = $this->createOutlet('MAIN-R3', 'Outlet Utama R3', true);
        $tenantOutlet = $this->createOutlet('TENANT-R3', 'Tenant R3');
        $cashier      = User::factory()->create();

        // 1 transaksi: gross = 30.000, tenant net = 20.000, markup = 10.000
        $allocation = $this->createDeliveredAllocation(
            mainOutlet:           $mainOutlet,
            tenantOutlet:         $tenantOutlet,
            cashier:              $cashier,
            customerUnitPrice:    30000,
            tenantBaseUnitPrice:  20000,
            ownerMarkupUnitPrice: 10000,
            qty:                  1
        );

        $tenantNet   = TenantWalletMetrics::sumTenantNetValueForAllocationIds(collect([$allocation->id]));
        $grossAmount = $allocation->subtotal;

        // Verifikasi: tenant net < gross (markup 10.000 sudah terpisah)
        $this->assertEquals(20000, $tenantNet);
        $this->assertEquals(30000, $grossAmount);
        $this->assertLessThan($grossAmount, $tenantNet);

        // Max yang bisa ditarik = tenant net, bukan gross
        $maxWithdrawable = $tenantNet;
        $this->assertEquals(20000, $maxWithdrawable,
            'Maksimal yang bisa ditarik tenant adalah net (20.000), bukan gross (30.000)');
    }
}
