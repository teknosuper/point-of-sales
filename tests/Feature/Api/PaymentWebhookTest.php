<?php

namespace Tests\Feature\Api;

use App\Models\PaymentSetting;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

class PaymentWebhookTest extends TestCase
{
    use RefreshDatabase;

    public function test_midtrans_webhook_updates_transaction_status_when_signature_is_valid(): void
    {
        PaymentSetting::create([
            'default_gateway' => 'midtrans',
            'midtrans_enabled' => true,
            'midtrans_server_key' => 'server-key',
            'midtrans_client_key' => 'client-key',
        ]);

        $transaction = $this->createPendingTransaction('midtrans');

        $payload = [
            'order_id' => $transaction->invoice,
            'status_code' => '200',
            'gross_amount' => (string) (int) $transaction->grand_total,
            'transaction_status' => 'settlement',
            'transaction_id' => 'midtrans-tx-001',
        ];
        $payload['signature_key'] = hash(
            'sha512',
            $payload['order_id'].$payload['status_code'].$payload['gross_amount'].'server-key'
        );

        $response = $this->postJson(route('webhooks.midtrans'), $payload);

        $response->assertOk()->assertJson(['status' => 'success']);
        $transaction->refresh();

        $this->assertSame('paid', $transaction->payment_status);
        $this->assertSame('midtrans-tx-001', $transaction->payment_reference);
    }

    public function test_midtrans_webhook_rejects_invalid_signature(): void
    {
        Log::spy();

        PaymentSetting::create([
            'default_gateway' => 'midtrans',
            'midtrans_enabled' => true,
            'midtrans_server_key' => 'server-key',
            'midtrans_client_key' => 'client-key',
        ]);

        $transaction = $this->createPendingTransaction('midtrans');

        $response = $this->postJson(route('webhooks.midtrans'), [
            'order_id' => $transaction->invoice,
            'status_code' => '200',
            'gross_amount' => (string) (int) $transaction->grand_total,
            'transaction_status' => 'settlement',
            'transaction_id' => 'midtrans-tx-001',
            'signature_key' => 'invalid-signature',
        ]);

        $response->assertForbidden();
        $this->assertSame('pending', $transaction->fresh()->payment_status);
        Log::shouldNotHaveReceived('info', function ($message) {
            return $message === 'Midtrans Webhook Received';
        });
        Log::shouldHaveReceived('warning', function ($message, $context = []) {
            return $message === 'Midtrans Webhook: Invalid signature'
                && ! array_key_exists('received', $context)
                && ! array_key_exists('expected', $context)
                && ($context['verification_result'] ?? null) === 'invalid';
        });
    }

    public function test_xendit_webhook_updates_transaction_status_when_token_is_valid(): void
    {
        PaymentSetting::create([
            'default_gateway' => 'xendit',
            'xendit_enabled' => true,
            'xendit_secret_key' => 'xendit-secret',
            'xendit_public_key' => 'xendit-public',
            'xendit_callback_token' => 'callback-token',
        ]);

        $transaction = $this->createPendingTransaction('xendit');

        $response = $this->withHeader('X-CALLBACK-TOKEN', 'callback-token')
            ->postJson(route('webhooks.xendit'), [
                'external_id' => $transaction->invoice,
                'status' => 'PAID',
                'id' => 'xendit-invoice-001',
            ]);

        $response->assertOk()->assertJson(['status' => 'success']);
        $transaction->refresh();

        $this->assertSame('paid', $transaction->payment_status);
        $this->assertSame('xendit-invoice-001', $transaction->payment_reference);
    }

    public function test_xendit_webhook_rejects_invalid_callback_token(): void
    {
        Log::spy();

        PaymentSetting::create([
            'default_gateway' => 'xendit',
            'xendit_enabled' => true,
            'xendit_secret_key' => 'xendit-secret',
            'xendit_public_key' => 'xendit-public',
            'xendit_callback_token' => 'callback-token',
        ]);

        $transaction = $this->createPendingTransaction('xendit');

        $response = $this->withHeader('X-CALLBACK-TOKEN', 'wrong-token')
            ->postJson(route('webhooks.xendit'), [
                'external_id' => $transaction->invoice,
                'status' => 'PAID',
                'id' => 'xendit-invoice-001',
            ]);

        $response->assertForbidden();
        $this->assertSame('pending', $transaction->fresh()->payment_status);
        Log::shouldNotHaveReceived('info', function ($message) {
            return $message === 'Xendit Webhook Received';
        });
        Log::shouldHaveReceived('warning', function ($message, $context = []) {
            return $message === 'Xendit Webhook: Invalid callback token'
                && ! array_key_exists('token', $context)
                && ($context['verification_result'] ?? null) === 'invalid';
        });
    }

    public function test_pakasir_webhook_updates_transaction_status_successfully_with_valid_secret(): void
    {
        PaymentSetting::create([
            'default_gateway' => 'pakasir',
            'pakasir_enabled' => true,
            'pakasir_project_slug' => 'test-project',
            'pakasir_api_key' => 'test-api-key',
            'pakasir_webhook_secret' => 'valid-secret-123',
            'pakasir_method' => 'qris',
        ]);

        $transaction = $this->createPendingTransaction('pakasir');

        $response = $this->withHeader('X-Secret', 'valid-secret-123')
            ->postJson(route('webhooks.pakasir'), [
                'txn_id' => 'pakasir-tx-001',
                'order_id' => $transaction->invoice,
                'amount' => 150000,
                'status' => 'completed',
                'completed_at' => now()->toIso8601String(),
            ]);

        $response->assertOk()->assertJson(['status' => 'success']);
        $transaction->refresh();

        $this->assertSame('paid', $transaction->payment_status);
        $this->assertSame('pakasir-tx-001', $transaction->payment_reference);
    }

    public function test_pakasir_webhook_rejects_invalid_secret(): void
    {
        Log::spy();

        PaymentSetting::create([
            'default_gateway' => 'pakasir',
            'pakasir_enabled' => true,
            'pakasir_project_slug' => 'test-project',
            'pakasir_api_key' => 'test-api-key',
            'pakasir_webhook_secret' => 'valid-secret-123',
            'pakasir_method' => 'qris',
        ]);

        $transaction = $this->createPendingTransaction('pakasir');

        $response = $this->withHeader('X-Secret', 'wrong-secret')
            ->postJson(route('webhooks.pakasir'), [
                'txn_id' => 'pakasir-tx-001',
                'order_id' => $transaction->invoice,
                'amount' => 150000,
                'status' => 'completed',
            ]);

        $response->assertForbidden();
        $this->assertSame('pending', $transaction->fresh()->payment_status);
        Log::shouldHaveReceived('warning', function ($message, $context = []) {
            return $message === 'Pakasir Webhook: Invalid secret'
                && ($context['verification_result'] ?? null) === 'invalid';
        });
    }

    public function test_pakasir_webhook_accepts_when_no_secret_configured(): void
    {
        PaymentSetting::create([
            'default_gateway' => 'pakasir',
            'pakasir_enabled' => true,
            'pakasir_project_slug' => 'test-project',
            'pakasir_api_key' => 'test-api-key',
            'pakasir_method' => 'qris',
        ]);

        $transaction = $this->createPendingTransaction('pakasir');

        $response = $this->postJson(route('webhooks.pakasir'), [
            'txn_id' => 'pakasir-tx-001',
            'order_id' => $transaction->invoice,
            'amount' => 150000,
            'status' => 'completed',
        ]);

        $response->assertOk()->assertJson(['status' => 'success']);
        $this->assertSame('paid', $transaction->fresh()->payment_status);
    }

    public function test_pakasir_webhook_finds_transaction_by_txn_id(): void
    {
        PaymentSetting::create([
            'default_gateway' => 'pakasir',
            'pakasir_enabled' => true,
            'pakasir_project_slug' => 'test-project',
            'pakasir_api_key' => 'test-api-key',
            'pakasir_webhook_secret' => 'valid-secret-123',
            'pakasir_method' => 'qris',
        ]);

        $transaction = $this->createPendingTransaction('pakasir');
        $transaction->update(['payment_reference' => 'pakasir-tx-999']);

        $response = $this->withHeader('X-Secret', 'valid-secret-123')
            ->postJson(route('webhooks.pakasir'), [
                'txn_id' => 'pakasir-tx-999',
                'amount' => 150000,
                'status' => 'completed',
            ]);

        $response->assertOk()->assertJson(['status' => 'success']);
        $this->assertSame('paid', $transaction->fresh()->payment_status);
    }

    private function createPendingTransaction(string $paymentMethod): Transaction
    {
        return Transaction::create([
            'cashier_id' => User::factory()->create()->id,
            'invoice' => 'TRX-WEBHOOK-'.strtoupper($paymentMethod),
            'cash' => 0,
            'change' => 0,
            'discount' => 0,
            'shipping_cost' => 0,
            'grand_total' => 150000,
            'payment_method' => $paymentMethod,
            'payment_status' => 'pending',
        ]);
    }
}
