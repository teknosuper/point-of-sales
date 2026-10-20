<?php

namespace Tests\Feature\Payments;

use App\Exceptions\PaymentGatewayException;
use App\Models\Transaction;
use App\Models\User;
use App\Services\Payments\PakasirGateway;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PakasirGatewayTest extends TestCase
{
    use RefreshDatabase;

    private PakasirGateway $gateway;

    protected function setUp(): void
    {
        parent::setUp();
        $this->gateway = new PakasirGateway;
    }

    public function test_create_transaction_qris_posts_to_v2_endpoint_with_headers(): void
    {
        Http::fake([
            'https://app.pakasir.com/api/v2/create-transaction/my-store/TRX-001' => Http::response([
                'txn_id' => 'tx_abc123',
                'project' => 'my-store',
                'order_id' => 'TRX-001',
                'amount' => 50000,
                'fee' => 350,
                'total_payment' => 50350,
                'payment_method' => 'qris',
                'qr_string' => '00020101021226610016ID.CO.SHOPEE.WWW...',
                'va_number' => '',
                'expired_at' => '2026-10-21T10:00:00Z',
                'is_sandbox' => false,
            ], 200),
        ]);

        $transaction = Transaction::create([
            'cashier_id' => User::factory()->create()->id,
            'invoice' => 'TRX-001',
            'cash' => 0,
            'change' => 0,
            'discount' => 0,
            'grand_total' => 50000,
            'payment_method' => 'pakasir',
            'payment_status' => 'pending',
        ]);

        $config = [
            'enabled' => true,
            'project_slug' => 'my-store',
            'api_key' => 'secret-api-key',
            'method' => 'qris',
        ];

        $result = $this->gateway->createTransaction($transaction, $config);

        Http::assertSent(function ($request) {
            return $request->url() === 'https://app.pakasir.com/api/v2/create-transaction/my-store/TRX-001'
                && $request->hasHeader('X-Api-Key', 'secret-api-key')
                && $request['method'] === 'qris'
                && $request['amount'] === 50000;
        });

        $this->assertSame('tx_abc123', $result['reference']);
        $this->assertSame('tx_abc123', $result['txn_id']);
        $this->assertSame('00020101021226610016ID.CO.SHOPEE.WWW...', $result['payment_number']);
        $this->assertSame('https://app.pakasir.com/pay-v2/tx_abc123?qris_only=1', $result['payment_url']);
        $this->assertSame('2026-10-21T10:00:00Z', $result['expired_at']);
    }

    public function test_create_transaction_payment_link_returns_direct_link(): void
    {
        Http::fake([
            'https://app.pakasir.com/api/v2/create-transaction/my-store/TRX-002' => Http::response([
                'txn_id' => 'tx_link999',
                'payment_link' => 'https://app.pakasir.com/pay-v2/tx_link999',
            ], 200),
        ]);

        $transaction = Transaction::create([
            'cashier_id' => User::factory()->create()->id,
            'invoice' => 'TRX-002',
            'cash' => 0,
            'change' => 0,
            'discount' => 0,
            'grand_total' => 75000,
            'payment_method' => 'pakasir',
            'payment_status' => 'pending',
        ]);

        $config = [
            'enabled' => true,
            'project_slug' => 'my-store',
            'api_key' => 'secret-api-key',
            'method' => 'payment_link',
        ];

        $result = $this->gateway->createTransaction($transaction, $config);

        $this->assertSame('tx_link999', $result['reference']);
        $this->assertSame('https://app.pakasir.com/pay-v2/tx_link999', $result['payment_url']);
    }

    public function test_create_transaction_va_returns_va_number(): void
    {
        Http::fake([
            'https://app.pakasir.com/api/v2/create-transaction/my-store/TRX-003' => Http::response([
                'txn_id' => 'tx_va777',
                'project' => 'my-store',
                'order_id' => 'TRX-003',
                'amount' => 100000,
                'payment_method' => 'bri_va',
                'qr_string' => '',
                'va_number' => '8888012345678901',
                'expired_at' => '2026-10-21T12:00:00Z',
            ], 200),
        ]);

        $transaction = Transaction::create([
            'cashier_id' => User::factory()->create()->id,
            'invoice' => 'TRX-003',
            'cash' => 0,
            'change' => 0,
            'discount' => 0,
            'grand_total' => 100000,
            'payment_method' => 'pakasir',
            'payment_status' => 'pending',
        ]);

        $config = [
            'enabled' => true,
            'project_slug' => 'my-store',
            'api_key' => 'secret-api-key',
            'method' => 'bri_va',
        ];

        $result = $this->gateway->createTransaction($transaction, $config);

        $this->assertSame('8888012345678901', $result['payment_number']);
        $this->assertSame('https://app.pakasir.com/pay-v2/tx_va777', $result['payment_url']);
    }

    public function test_get_transaction_detail_calls_v2_status_endpoint(): void
    {
        Http::fake([
            'https://app.pakasir.com/api/v2/transaction-status/my-store/tx_abc123' => Http::response([
                'txn_id' => 'tx_abc123',
                'order_id' => 'TRX-001',
                'amount' => 50000,
                'status' => 'completed',
                'completed_at' => '2026-10-20T12:00:00Z',
            ], 200),
        ]);

        $transaction = Transaction::create([
            'cashier_id' => User::factory()->create()->id,
            'invoice' => 'TRX-001',
            'cash' => 0,
            'change' => 0,
            'discount' => 0,
            'grand_total' => 50000,
            'payment_method' => 'pakasir',
            'payment_status' => 'pending',
            'payment_reference' => 'tx_abc123',
        ]);

        $config = [
            'enabled' => true,
            'project_slug' => 'my-store',
            'api_key' => 'secret-api-key',
            'method' => 'qris',
        ];

        $detail = $this->gateway->getTransactionDetail($transaction, $config);

        Http::assertSent(function ($request) {
            return $request->url() === 'https://app.pakasir.com/api/v2/transaction-status/my-store/tx_abc123'
                && $request->hasHeader('X-Api-Key', 'secret-api-key');
        });

        $this->assertSame('completed', $detail['status']);
        $this->assertSame('tx_abc123', $detail['txn_id']);
    }

    public function test_create_transaction_throws_exception_on_failure(): void
    {
        $this->expectException(PaymentGatewayException::class);
        $this->expectExceptionMessage('Pakasir error: Invalid API key');

        Http::fake([
            'https://app.pakasir.com/api/v2/create-transaction/my-store/TRX-ERR' => Http::response([
                'message' => 'Invalid API key',
            ], 401),
        ]);

        $transaction = Transaction::create([
            'cashier_id' => User::factory()->create()->id,
            'invoice' => 'TRX-ERR',
            'cash' => 0,
            'change' => 0,
            'discount' => 0,
            'grand_total' => 20000,
            'payment_method' => 'pakasir',
            'payment_status' => 'pending',
        ]);

        $config = [
            'enabled' => true,
            'project_slug' => 'my-store',
            'api_key' => 'bad-key',
            'method' => 'qris',
        ];

        $this->gateway->createTransaction($transaction, $config);
    }
}
