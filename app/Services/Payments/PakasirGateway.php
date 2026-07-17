<?php

namespace App\Services\Payments;

use App\Exceptions\PaymentGatewayException;
use App\Models\Transaction;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class PakasirGateway
{
    public function createTransaction(Transaction $transaction, array $config): array
    {
        if (! ($config['enabled'] ?? false)) {
            throw new PaymentGatewayException('Pakasir tidak aktif atau belum dikonfigurasi.');
        }

        $method = strtolower((string) ($config['method'] ?? 'qris'));
        $response = Http::post("https://app.pakasir.com/api/transactioncreate/{$method}", [
            'project' => $config['project_slug'],
            'order_id' => $transaction->invoice,
            'amount' => (int) $transaction->grand_total,
            'api_key' => $config['api_key'],
        ]);

        if ($response->failed()) {
            throw new PaymentGatewayException(
                'Pakasir error: '.$response->json('message', $response->body())
            );
        }

        $payment = $response->json('payment', []);
        $accessToken = $transaction->tableOrder?->access_token;
        $paymentUrl = 'https://app.pakasir.com/pay/'
            .rawurlencode((string) $config['project_slug'])
            .'/'.(int) $transaction->grand_total
            .'?order_id='.rawurlencode((string) $transaction->invoice);

        if (filled($accessToken)) {
            $paymentUrl .= '&redirect='.rawurlencode(route('table-order.status', $accessToken));
        }

        if (Str::lower((string) $method) === 'qris') {
            $paymentUrl .= '&qris_only=1';
        }

        return [
            'reference' => $payment['order_id'] ?? $transaction->invoice,
            'payment_url' => $paymentUrl,
            'payment_number' => $payment['payment_number'] ?? null,
            'expired_at' => $payment['expired_at'] ?? null,
            'raw' => $response->json(),
        ];
    }

    public function getTransactionDetail(Transaction $transaction, array $config): array
    {
        if (! ($config['enabled'] ?? false)) {
            throw new PaymentGatewayException('Pakasir tidak aktif atau belum dikonfigurasi.');
        }

        $response = Http::get('https://app.pakasir.com/api/transactiondetail', [
            'project' => $config['project_slug'],
            'amount' => (int) $transaction->grand_total,
            'order_id' => $transaction->invoice,
            'api_key' => $config['api_key'],
        ]);

        if ($response->failed()) {
            throw new PaymentGatewayException(
                'Pakasir error: '.$response->json('message', $response->body())
            );
        }

        return $response->json('transaction', []);
    }
}
