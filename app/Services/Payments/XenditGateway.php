<?php

namespace App\Services\Payments;

use App\Exceptions\PaymentGatewayException;
use App\Models\Transaction;
use Illuminate\Support\Facades\Http;

class XenditGateway
{
    public function createInvoice(Transaction $transaction, array $config): array
    {
        if (! ($config['enabled'] ?? false)) {
            throw new PaymentGatewayException('Xendit tidak aktif atau belum dikonfigurasi.');
        }

        $customer = $transaction->customer;
        $payerEmail = filter_var(optional($customer)->email, FILTER_VALIDATE_EMAIL)
            ? optional($customer)->email
            : config('mail.from.address');
        $accessToken = $transaction->tableOrder?->access_token;
        $payload = [
            'external_id' => $transaction->invoice,
            'amount' => (int) $transaction->grand_total,
            'description' => 'Pembayaran transaksi #'.$transaction->invoice,
        ];

        if (filled($payerEmail)) {
            $payload['payer_email'] = $payerEmail;
        }

        if (filled($accessToken)) {
            $payload['success_redirect_url'] = route('table-order.status', $accessToken);
        }

        $response = Http::withBasicAuth($config['secret_key'], '')
            ->post('https://api.xendit.co/v2/invoices', $payload);

        if ($response->failed()) {
            throw new PaymentGatewayException(
                'Xendit error: '.$response->json('message', $response->body())
            );
        }

        return [
            'reference' => $response->json('id'),
            'payment_url' => $response->json('invoice_url'),
            'raw' => $response->json(),
        ];
    }

    public function getInvoiceStatus(Transaction $transaction, array $config): array
    {
        if (! ($config['enabled'] ?? false)) {
            throw new PaymentGatewayException('Xendit tidak aktif atau belum dikonfigurasi.');
        }

        $invoiceId = (string) ($transaction->payment_reference ?? '');
        if (blank($invoiceId)) {
            throw new PaymentGatewayException('Referensi invoice Xendit belum tersedia untuk transaksi ini.');
        }

        $response = Http::withBasicAuth($config['secret_key'], '')
            ->get("https://api.xendit.co/v2/invoices/{$invoiceId}");

        if ($response->failed()) {
            throw new PaymentGatewayException(
                'Xendit error: '.$response->json('message', $response->body())
            );
        }

        return $response->json();
    }
}
