<?php

namespace App\Services\Payments;

use App\Exceptions\PaymentGatewayException;
use App\Models\Transaction;
use Illuminate\Support\Facades\Http;

class PakasirGateway
{
    public const API_BASE_URL = 'https://app.pakasir.com/api/v2';

    public const PAY_BASE_URL = 'https://app.pakasir.com/pay-v2';

    public function createTransaction(Transaction $transaction, array $config): array
    {
        if (! ($config['enabled'] ?? false)) {
            throw new PaymentGatewayException('Pakasir tidak aktif atau belum dikonfigurasi.');
        }

        $projectSlug = (string) ($config['project_slug'] ?? '');
        $apiKey = (string) ($config['api_key'] ?? '');

        if (blank($projectSlug) || blank($apiKey)) {
            throw new PaymentGatewayException('Konfigurasi Pakasir (project slug atau API key) belum lengkap.');
        }

        $method = strtolower((string) ($config['method'] ?? 'qris'));
        $orderId = (string) $transaction->invoice;
        $amount = (int) $transaction->grand_total;

        $response = Http::withHeaders([
            'X-Api-Key' => $apiKey,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ])->post(self::API_BASE_URL."/create-transaction/{$projectSlug}/{$orderId}", [
            'method' => $method,
            'amount' => $amount,
        ]);

        if ($response->failed()) {
            throw new PaymentGatewayException(
                'Pakasir error: '.$response->json('message', $response->body())
            );
        }

        $data = $response->json();
        $txnId = $data['txn_id'] ?? null;

        // Payment link resolution:
        // If API returned payment_link directly (method = payment_link), use it.
        // Otherwise, construct v2 pay URL: https://app.pakasir.com/pay-v2/{txn_id}
        $paymentUrl = $data['payment_link'] ?? null;
        if (blank($paymentUrl) && filled($txnId)) {
            $paymentUrl = self::PAY_BASE_URL."/{$txnId}";
            if ($method === 'qris') {
                $paymentUrl .= '?qris_only=1';
            }
        }

        // QR string or VA number resolution for backward compatibility with frontend
        $paymentNumber = null;
        if (filled($data['qr_string'] ?? null)) {
            $paymentNumber = $data['qr_string'];
        } elseif (filled($data['va_number'] ?? null)) {
            $paymentNumber = $data['va_number'];
        } elseif (filled($data['payment_number'] ?? null)) {
            $paymentNumber = $data['payment_number'];
        }

        return [
            'reference' => $txnId ?: $orderId,
            'txn_id' => $txnId,
            'payment_url' => $paymentUrl,
            'payment_number' => $paymentNumber,
            'expired_at' => $data['expired_at'] ?? null,
            'raw' => $data,
        ];
    }

    public function getTransactionDetail(Transaction $transaction, array $config): array
    {
        if (! ($config['enabled'] ?? false)) {
            throw new PaymentGatewayException('Pakasir tidak aktif atau belum dikonfigurasi.');
        }

        $projectSlug = (string) ($config['project_slug'] ?? '');
        $apiKey = (string) ($config['api_key'] ?? '');

        if (blank($projectSlug) || blank($apiKey)) {
            throw new PaymentGatewayException('Konfigurasi Pakasir (project slug atau API key) belum lengkap.');
        }

        // Try to obtain txn_id from payment_payload or payment_reference
        $txnId = data_get($transaction->payment_payload, 'txn_id');
        if (blank($txnId) && filled($transaction->payment_reference) && $transaction->payment_reference !== $transaction->invoice) {
            $txnId = $transaction->payment_reference;
        }

        // If txn_id is still not available, call create-transaction to resolve txn_id (v2 create-transaction is idempotent find-or-create)
        if (blank($txnId)) {
            $method = strtolower((string) ($config['method'] ?? 'qris'));
            $createResponse = Http::withHeaders([
                'X-Api-Key' => $apiKey,
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
            ])->post(self::API_BASE_URL."/create-transaction/{$projectSlug}/{$transaction->invoice}", [
                'method' => $method,
                'amount' => (int) $transaction->grand_total,
            ]);

            if ($createResponse->successful()) {
                $txnId = $createResponse->json('txn_id');
            }
        }

        if (blank($txnId)) {
            throw new PaymentGatewayException('ID Transaksi Pakasir (txn_id) tidak ditemukan.');
        }

        $response = Http::withHeaders([
            'X-Api-Key' => $apiKey,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ])->get(self::API_BASE_URL."/transaction-status/{$projectSlug}/{$txnId}");

        if ($response->failed()) {
            throw new PaymentGatewayException(
                'Pakasir error: '.$response->json('message', $response->body())
            );
        }

        return $response->json() ?? [];
    }
}
