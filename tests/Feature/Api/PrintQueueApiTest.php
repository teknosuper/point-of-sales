<?php

namespace Tests\Feature\Api;

use App\Models\BankAccount;
use App\Models\Category;
use App\Models\DiningTable;
use App\Models\KitchenStation;
use App\Models\KitchenStationDevice;
use App\Models\KitchenTicket;
use App\Models\KitchenTicketItem;
use App\Models\Outlet;
use App\Models\PrintJob;
use App\Models\Product;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use App\Models\TransactionDetailModifier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class PrintQueueApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_cashier_print_queue_returns_payment_and_promo_breakdown(): void
    {
        config(['services.print_bridge.token' => 'test-token']);

        $outlet = $this->createOutlet('PRINT-1', 'Outlet Print');
        $category = $this->createCategory('Minuman');
        $product = $this->createProduct($category, 'Es Kopi Susu', 20000);
        $cashier = User::factory()->create(['name' => 'Kasir Print']);
        $bankAccount = BankAccount::create([
            'outlet_id' => $outlet->id,
            'bank_name' => 'BCA',
            'account_number' => '1234567890',
            'account_name' => 'Outlet Print',
            'is_active' => true,
            'sort_order' => 1,
        ]);

        $transaction = Transaction::create([
            'cashier_id' => $cashier->id,
            'outlet_id' => $outlet->id,
            'order_type' => 'take_away',
            'invoice' => 'INV-PRINT-001',
            'cash' => 0,
            'change' => 0,
            'discount' => 2000,
            'customer_voucher_discount' => 1000,
            'loyalty_discount_total' => 500,
            'shipping_cost' => 0,
            'grand_total' => 30000,
            'payment_method' => 'bank_transfer',
            'payment_status' => 'paid',
            'payment_reference' => 'TRX-REF-001',
            'bank_account_id' => $bankAccount->id,
        ]);

        $detail = TransactionDetail::create([
            'transaction_id' => $transaction->id,
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'qty' => 2,
            'base_unit_price' => 20000,
            'unit_price' => 15000,
            'price' => 30000,
            'discount_total' => 10000,
            'pricing_rule_name' => 'Promo Paket Berdua',
            'pricing_rule_kind' => 'bundle_price',
            'pricing_group_label' => 'Paket Hemat Kopi',
            'notes' => 'Less sugar',
        ]);

        TransactionDetailModifier::create([
            'transaction_detail_id' => $detail->id,
            'name' => 'Extra Shot',
            'qty' => 1,
            'unit_price' => 3000,
            'total_price' => 3000,
        ]);

        PrintJob::create([
            'outlet_id' => $outlet->id,
            'transaction_id' => $transaction->id,
            'job_type' => PrintJob::TYPE_RECEIPT,
            'status' => PrintJob::STATUS_QUEUED,
            'copies' => 1,
            'payload' => ['paper_width' => '58mm'],
            'queued_at' => now(),
        ]);

        $response = $this->getJson(route('print-queue.cashier', [
            'token' => 'test-token',
            'outlet_id' => $outlet->id,
        ]));

        $response
            ->assertOk()
            ->assertJsonPath('count', 1)
            ->assertJsonPath('jobs.0.type', 'receipt')
            ->assertJsonPath('jobs.0.transaction.payment_method', 'bank_transfer')
            ->assertJsonPath('jobs.0.transaction.payment_method_label', 'Transfer Bank')
            ->assertJsonPath('jobs.0.transaction.payment_summary', 'BCA • 1234567890')
            ->assertJsonPath('jobs.0.transaction.paid_amount', 30000)
            ->assertJsonPath('jobs.0.transaction.promo_discount_total', 10000)
            ->assertJsonPath('jobs.0.transaction.discount', 2000)
            ->assertJsonPath('jobs.0.transaction.voucher_discount_total', 1000)
            ->assertJsonPath('jobs.0.transaction.loyalty_discount_total', 500)
            ->assertJsonPath('jobs.0.transaction.items.0.base_unit_price', 20000)
            ->assertJsonPath('jobs.0.transaction.items.0.price', 15000)
            ->assertJsonPath('jobs.0.transaction.items.0.promo_kind', 'bundle_price')
            ->assertJsonPath('jobs.0.transaction.items.0.promo_kind_label', 'Promo Paket Hemat')
            ->assertJsonPath('jobs.0.transaction.items.0.modifiers.0.total', 3000);

        $this->assertStringContainsString(
            'Promo Paket Hemat',
            (string) data_get($response->json(), 'jobs.0.transaction.items.0.promo_summary')
        );
    }

    public function test_kitchen_print_queue_returns_table_label_and_order_type_label(): void
    {
        config(['services.print_bridge.token' => 'test-token']);

        $outlet = $this->createOutlet('PRINT-KITCHEN', 'Outlet Kitchen');
        $station = KitchenStation::create([
            'outlet_id' => $outlet->id,
            'name' => 'Dapur Utama',
            'slug' => 'dapur-utama',
            'code' => 'DPR',
            'station_type' => 'kitchen',
            'display_mode' => 'screen',
            'processing_mode' => 'auto',
            'is_active' => true,
            'sort_order' => 1,
        ]);
        $device = KitchenStationDevice::create([
            'kitchen_station_id' => $station->id,
            'name' => 'Printer Dapur',
            'device_type' => 'printer',
            'connection_driver' => 'web',
            'endpoint' => null,
            'is_primary' => true,
            'is_active' => true,
            'meta' => ['paper_width' => '80mm'],
        ]);
        $table = DiningTable::create([
            'outlet_id' => $outlet->id,
            'name' => 'Meja Teras',
            'code' => 'A01',
            'capacity' => 4,
            'status' => 'active',
            'self_order_enabled' => true,
            'sort_order' => 1,
        ]);

        $transaction = Transaction::create([
            'outlet_id' => $outlet->id,
            'table_id' => $table->id,
            'order_type' => 'dine_in',
            'invoice' => 'INV-KITCHEN-001',
            'cash' => 0,
            'change' => 0,
            'discount' => 0,
            'customer_voucher_discount' => 0,
            'loyalty_discount_total' => 0,
            'shipping_cost' => 0,
            'grand_total' => 25000,
            'payment_method' => 'cash',
            'payment_status' => 'paid',
        ]);

        $ticket = KitchenTicket::create([
            'outlet_id' => $outlet->id,
            'transaction_id' => $transaction->id,
            'kitchen_station_id' => $station->id,
            'ticket_number' => 'KT-0001',
            'status' => 'pending',
            'notes' => 'Tanpa sambal',
            'fired_at' => now(),
        ]);

        KitchenTicketItem::create([
            'kitchen_ticket_id' => $ticket->id,
            'product_title' => 'Nasi Goreng',
            'qty' => 2,
            'status' => 'pending',
            'notes' => 'Pedas sedang',
        ]);

        PrintJob::create([
            'outlet_id' => $outlet->id,
            'transaction_id' => $transaction->id,
            'kitchen_ticket_id' => $ticket->id,
            'kitchen_station_device_id' => $device->id,
            'job_type' => PrintJob::TYPE_KITCHEN_TICKET,
            'status' => PrintJob::STATUS_QUEUED,
            'copies' => 1,
            'payload' => ['paper_width' => '80mm'],
            'queued_at' => now(),
        ]);

        $response = $this->getJson(route('print-queue.kitchen', [
            'token' => 'test-token',
            'outlet_id' => $outlet->id,
            'station_id' => $station->id,
        ]));

        $response
            ->assertOk()
            ->assertJsonPath('count', 1)
            ->assertJsonPath('jobs.0.transaction.invoice', 'INV-KITCHEN-001')
            ->assertJsonPath('jobs.0.transaction.table', 'A01 - Meja Teras')
            ->assertJsonPath('jobs.0.transaction.table_code', 'A01')
            ->assertJsonPath('jobs.0.transaction.table_name', 'Meja Teras')
            ->assertJsonPath('jobs.0.transaction.order_type', 'dine_in')
            ->assertJsonPath('jobs.0.transaction.order_type_label', 'Makan di Tempat');
    }

    private function createOutlet(string $code, string $name): Outlet
    {
        return Outlet::create([
            'code' => $code,
            'slug' => Str::slug($code),
            'name' => $name,
            'address' => 'Jalan Outlet Print',
            'phone' => '08123456789',
            'is_active' => true,
            'is_default' => true,
            'sort_order' => 0,
        ]);
    }

    private function createCategory(string $name): Category
    {
        return Category::create([
            'name' => $name,
            'description' => 'Kategori print queue',
            'image' => 'category.png',
        ]);
    }

    private function createProduct(Category $category, string $title, int $sellPrice): Product
    {
        return Product::create([
            'category_id' => $category->id,
            'image' => 'product.png',
            'barcode' => 'BRCD-'.Str::upper(Str::random(8)),
            'sku' => 'SKU-'.Str::upper(Str::random(8)),
            'title' => $title,
            'description' => 'Produk print queue',
            'buy_price' => max(1000, $sellPrice - 7000),
            'sell_price' => $sellPrice,
            'stock' => 10,
        ]);
    }
}
