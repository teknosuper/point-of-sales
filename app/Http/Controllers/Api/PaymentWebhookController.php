<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PaymentSetting;
use App\Models\Transaction;
use App\Services\TableOrderService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class PaymentWebhookController extends Controller
{
    public function __construct(
        private readonly TableOrderService $tableOrderService
    ) {}

    /**
     * Handle Midtrans notification webhook
     * URL: POST /api/webhooks/midtrans
     */
    public function midtrans(Request $request)
    {
        try {
            $orderId = $request->input('order_id');
            $transaction = Transaction::where('invoice', $orderId)->first();
            $paymentSetting = PaymentSetting::resolveForOutlet($transaction?->outlet_id);

            if (! $paymentSetting || ! $paymentSetting->midtrans_enabled) {
                return response()->json(['status' => 'error', 'message' => 'Midtrans not configured'], 400);
            }

            // Get notification data
            $statusCode = $request->input('status_code');
            $grossAmount = $request->input('gross_amount');
            $serverKey = $paymentSetting->resolvedSecret('midtrans_server_key');

            // Verify signature
            $signatureKey = $request->input('signature_key');
            $expectedSignature = hash('sha512', $orderId.$statusCode.$grossAmount.$serverKey);

            if ($signatureKey !== $expectedSignature) {
                Log::warning('Midtrans Webhook: Invalid signature', [
                    'provider' => 'midtrans',
                    'order_id' => $orderId,
                    'verification_result' => 'invalid',
                    'error_category' => 'invalid_signature',
                ]);

                return response()->json(['status' => 'error', 'message' => 'Invalid signature'], 403);
            }

            // Find transaction by invoice (order_id)
            if (! $transaction) {
                Log::warning('Midtrans Webhook: Transaction not found', [
                    'provider' => 'midtrans',
                    'order_id' => $orderId,
                    'verification_result' => 'valid',
                    'error_category' => 'transaction_not_found',
                ]);

                return response()->json(['status' => 'error', 'message' => 'Transaction not found'], 404);
            }

            // Map Midtrans status to our status
            $transactionStatus = $request->input('transaction_status');
            $fraudStatus = $request->input('fraud_status');

            $newStatus = $this->mapMidtransStatus($transactionStatus, $fraudStatus);

            $previousStatus = (string) ($transaction->payment_status ?? '');

            $transaction->update([
                'payment_status' => $newStatus,
                'payment_reference' => $request->input('transaction_id') ?: $transaction->payment_reference,
            ]);

            if ($newStatus === 'paid' && $previousStatus !== 'paid') {
                $this->tableOrderService->finalizePublicPayment($transaction->fresh());
            }

            Log::info('Midtrans Webhook: Transaction updated', [
                'provider' => 'midtrans',
                'order_id' => $orderId,
                'payment_reference' => $request->input('transaction_id'),
                'normalized_status' => $newStatus,
                'verification_result' => 'valid',
            ]);

            return response()->json(['status' => 'success']);

        } catch (\Exception $e) {
            Log::error('Midtrans Webhook Error', [
                'provider' => 'midtrans',
                'order_id' => $request->input('order_id'),
                'verification_result' => 'unknown',
                'error_category' => 'exception',
                'message' => $e->getMessage(),
            ]);

            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Handle Xendit notification webhook
     * URL: POST /api/webhooks/xendit
     */
    public function xendit(Request $request)
    {
        try {
            $externalId = $request->input('external_id');
            $transaction = Transaction::where('invoice', $externalId)->first();
            $paymentSetting = PaymentSetting::resolveForOutlet($transaction?->outlet_id);

            if (! $paymentSetting || ! $paymentSetting->xendit_enabled) {
                return response()->json(['status' => 'error', 'message' => 'Xendit not configured'], 400);
            }

            $callbackToken = $request->header('X-CALLBACK-TOKEN');
            $expectedToken = $paymentSetting->resolvedSecret('xendit_callback_token');

            if (blank($expectedToken)) {
                Log::warning('Xendit Webhook: Callback token is not configured.', [
                    'provider' => 'xendit',
                    'external_id' => $request->input('external_id'),
                    'verification_result' => 'misconfigured',
                    'error_category' => 'missing_callback_token',
                ]);

                return response()->json(['status' => 'error', 'message' => 'Xendit callback token is not configured'], 400);
            }

            if (! is_string($callbackToken) || ! hash_equals($expectedToken, $callbackToken)) {
                Log::warning('Xendit Webhook: Invalid callback token', [
                    'provider' => 'xendit',
                    'external_id' => $request->input('external_id'),
                    'verification_result' => 'invalid',
                    'error_category' => 'invalid_callback_token',
                ]);

                return response()->json(['status' => 'error', 'message' => 'Invalid callback token'], 403);
            }

            $status = $request->input('status');
            $paymentId = $request->input('id');

            if (blank($externalId) || blank($status) || blank($paymentId)) {
                return response()->json(['status' => 'error', 'message' => 'Invalid payload'], 422);
            }

            // Find transaction by invoice
            if (! $transaction) {
                Log::warning('Xendit Webhook: Transaction not found', [
                    'provider' => 'xendit',
                    'external_id' => $externalId,
                    'verification_result' => 'valid',
                    'error_category' => 'transaction_not_found',
                ]);

                return response()->json(['status' => 'error', 'message' => 'Transaction not found'], 404);
            }

            // Map Xendit status to our status
            $newStatus = $this->mapXenditStatus($status);

            $previousStatus = (string) ($transaction->payment_status ?? '');

            $transaction->update([
                'payment_status' => $newStatus,
                'payment_reference' => $paymentId ?: $transaction->payment_reference,
            ]);

            if ($newStatus === 'paid' && $previousStatus !== 'paid') {
                $this->tableOrderService->finalizePublicPayment($transaction->fresh());
            }

            Log::info('Xendit Webhook: Transaction updated', [
                'provider' => 'xendit',
                'external_id' => $externalId,
                'payment_reference' => $paymentId,
                'normalized_status' => $newStatus,
                'verification_result' => 'valid',
            ]);

            return response()->json(['status' => 'success']);

        } catch (\Exception $e) {
            Log::error('Xendit Webhook Error', [
                'provider' => 'xendit',
                'external_id' => $request->input('external_id'),
                'verification_result' => 'unknown',
                'error_category' => 'exception',
                'message' => $e->getMessage(),
            ]);

            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Handle Pakasir notification webhook
     * URL: POST /api/webhooks/pakasir
     */
    public function pakasir(Request $request)
    {
        try {
            $orderId = $request->input('order_id');
            $transaction = Transaction::where('invoice', $orderId)->first();
            $paymentSetting = PaymentSetting::resolveForOutlet($transaction?->outlet_id);

            if (! $paymentSetting || ! $paymentSetting->pakasir_enabled) {
                return response()->json(['status' => 'error', 'message' => 'Pakasir not configured'], 400);
            }

            if (blank($orderId) || blank($request->input('status'))) {
                return response()->json(['status' => 'error', 'message' => 'Invalid payload'], 422);
            }

            if (! $transaction) {
                Log::warning('Pakasir Webhook: Transaction not found', [
                    'provider' => 'pakasir',
                    'order_id' => $orderId,
                    'verification_result' => 'accepted',
                    'error_category' => 'transaction_not_found',
                ]);

                return response()->json(['status' => 'error', 'message' => 'Transaction not found'], 404);
            }

            $newStatus = $this->mapPakasirStatus((string) $request->input('status'));
            $previousStatus = (string) ($transaction->payment_status ?? '');

            $transaction->update([
                'payment_status' => $newStatus,
                'payment_reference' => $request->input('order_id') ?: $transaction->payment_reference,
            ]);

            if ($newStatus === 'paid' && $previousStatus !== 'paid') {
                $this->tableOrderService->finalizePublicPayment($transaction->fresh());
            }

            Log::info('Pakasir Webhook: Transaction updated', [
                'provider' => 'pakasir',
                'order_id' => $orderId,
                'payment_method' => $request->input('payment_method'),
                'normalized_status' => $newStatus,
                'verification_result' => 'accepted',
            ]);

            return response()->json(['status' => 'success']);
        } catch (\Exception $e) {
            Log::error('Pakasir Webhook Error', [
                'provider' => 'pakasir',
                'order_id' => $request->input('order_id'),
                'verification_result' => 'unknown',
                'error_category' => 'exception',
                'message' => $e->getMessage(),
            ]);

            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Map Midtrans transaction status to our payment status
     */
    private function mapMidtransStatus(string $transactionStatus, ?string $fraudStatus = null): string
    {
        // Handle fraud status first
        if ($fraudStatus === 'challenge' || $fraudStatus === 'deny') {
            return 'failed';
        }

        return match ($transactionStatus) {
            'capture', 'settlement' => 'paid',
            'pending' => 'pending',
            'deny', 'cancel', 'expire' => 'failed',
            default => 'pending',
        };
    }

    /**
     * Map Xendit invoice status to our payment status
     */
    private function mapXenditStatus(string $status): string
    {
        return match (strtoupper($status)) {
            'PAID', 'SETTLED' => 'paid',
            'PENDING' => 'pending',
            'EXPIRED', 'FAILED' => 'failed',
            default => 'pending',
        };
    }

    private function mapPakasirStatus(string $status): string
    {
        return match (strtolower($status)) {
            'completed', 'paid', 'settled' => 'paid',
            'expired', 'failed', 'cancelled', 'canceled' => 'failed',
            default => 'pending',
        };
    }
}
