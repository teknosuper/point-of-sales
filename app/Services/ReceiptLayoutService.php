<?php

namespace App\Services;

class ReceiptLayoutService
{
    public function build(object $transaction, array $store = [], string $paperWidth = '58mm'): array
    {
        $items = collect($transaction->details ?? []);
        $promoDiscount = (int) $items->sum(fn ($item) => (int) ($item->discount_total ?? 0));
        $voucherDiscount = (int) ($transaction->customer_voucher_discount ?? 0);
        $loyaltyDiscount = (int) ($transaction->loyalty_discount_total ?? 0);
        $manualDiscount = (int) ($transaction->discount ?? 0);
        $shippingCost = (int) ($transaction->shipping_cost ?? 0);
        $grandTotal = (int) ($transaction->grand_total ?? 0);
        $cash = (int) ($transaction->cash ?? 0);
        $change = (int) ($transaction->change ?? 0);
        $subtotal = $grandTotal + $manualDiscount - $shippingCost + $promoDiscount + $voucherDiscount + $loyaltyDiscount;
        $paymentMethodKey = strtolower((string) ($transaction->payment_method ?? 'cash'));
        $paymentMethodLabel = $this->paymentMethodLabel($paymentMethodKey);
        $paymentSummary = $this->paymentSummary($transaction, $paymentMethodKey);
        $paidAmount = $paymentMethodKey === 'cash' ? max($cash, $grandTotal) : max($cash, $grandTotal);

        return [
            'paper_width' => $paperWidth,
            'store' => array_filter([
                'name' => $store['name'] ?? null,
                'address' => $store['address'] ?? null,
                'phone' => $store['phone'] ?? null,
                'email' => $store['email'] ?? null,
                'website' => $store['website'] ?? null,
            ]),
            'meta_rows' => array_values(array_filter([
                ['label' => 'No', 'value' => $transaction->invoice ?? '-'],
                ['label' => 'Tgl', 'value' => $transaction->created_at ? \Carbon\Carbon::parse($transaction->created_at)->format('d/m/Y H:i') : '-'],
                ['label' => 'Kasir', 'value' => $transaction->cashier->name ?? '-'],
                ['label' => 'Pelanggan', 'value' => $transaction->customer->name ?? 'Umum'],
                ['label' => 'Pesanan', 'value' => ($transaction->order_type ?? 'take_away') === 'dine_in' ? 'Dine In' : 'Take Away'],
                $transaction->diningTable?->name ? ['label' => 'Meja', 'value' => $transaction->diningTable->code ?: $transaction->diningTable->name] : null,
                $transaction->waiter?->name ? ['label' => 'Waiter', 'value' => $transaction->waiter->name] : null,
            ])),
            'items' => $items->map(function ($item) {
                $qty = max(1, (int) ($item->qty ?? 1));
                $lineTotal = (int) ($item->price ?? 0);
                $modifierTotal = (int) collect($item->modifiers ?? [])->sum('total_price');
                $baseLineTotal = max(0, $lineTotal - $modifierTotal);
                $unitPrice = (int) ($item->unit_price ?: ($qty ? $baseLineTotal / $qty : $baseLineTotal));
                $baseUnitPrice = (int) ($item->base_unit_price ?: $unitPrice);

                return [
                    'name' => $item->product->title ?? 'Produk',
                    'promo' => $this->promoSummary($item, $qty, $baseUnitPrice, $unitPrice),
                    'detail_left' => sprintf('%dx %s', $qty, $this->compactMoney($unitPrice)),
                    'detail_right' => $this->compactMoney($baseLineTotal),
                    'notes' => $item->notes ?: null,
                    'modifiers' => collect($item->modifiers ?? [])->map(fn ($modifier) => [
                        'label' => '+ '.$modifier->name,
                        'value' => $this->compactMoney((int) ($modifier->total_price ?? 0)),
                    ])->values()->all(),
                ];
            })->values()->all(),
            'totals' => array_values(array_filter([
                ['label' => 'Sub Total', 'value' => $this->compactMoney($subtotal)],
                $promoDiscount > 0 ? ['label' => 'Diskon Item', 'value' => $this->compactMoney($promoDiscount)] : null,
                $manualDiscount > 0 ? ['label' => 'Diskon Manual', 'value' => '-'.$this->compactMoney($manualDiscount)] : null,
                $voucherDiscount > 0 ? ['label' => 'Voucher', 'value' => '-'.$this->compactMoney($voucherDiscount)] : null,
                $loyaltyDiscount > 0 ? ['label' => 'Redeem Poin', 'value' => '-'.$this->compactMoney($loyaltyDiscount)] : null,
                $shippingCost > 0 ? ['label' => 'Ongkir', 'value' => $this->compactMoney($shippingCost)] : null,
                ['label' => 'Netto', 'value' => $this->compactMoney($grandTotal), 'strong' => true],
            ])),
            'payments' => array_values(array_filter([
                $paymentMethodKey === 'cash'
                    ? ['label' => 'Bayar Tunai', 'value' => $this->compactMoney($paidAmount)]
                    : ['label' => 'Bayar Tunai', 'value' => $this->compactMoney($cash)],
                $paymentMethodKey !== 'cash'
                    ? ['label' => $paymentMethodLabel, 'value' => $this->compactMoney($paidAmount)]
                    : null,
                ['label' => 'Nominal Bayar', 'value' => $this->compactMoney($paidAmount)],
                ['label' => 'Kembali', 'value' => $this->compactMoney($change)],
                ['label' => 'Metode', 'value' => $paymentMethodLabel],
                $paymentSummary ? ['label' => 'Info', 'value' => $paymentSummary] : null,
            ])),
            'footer_lines' => [
                'Terima kasih!',
                '#'.($transaction->invoice ?? '-'),
            ],
        ];
    }

    private function paymentMethodLabel(string $key): string
    {
        return match ($key) {
            'cash' => 'Tunai',
            'bank_transfer' => 'Transfer Bank',
            'midtrans' => 'Midtrans',
            'xendit' => 'Xendit',
            'pay_later' => 'Piutang',
            default => strtoupper(str_replace('_', ' ', $key)),
        };
    }

    private function paymentSummary(object $transaction, string $methodKey): ?string
    {
        return match ($methodKey) {
            'bank_transfer' => trim(implode(' • ', array_filter([
                $transaction->bankAccount->bank_name ?? null,
                $transaction->bankAccount->account_number ?? null,
            ]))),
            'midtrans', 'xendit' => $transaction->payment_reference ?? null,
            'pay_later' => 'Pembayaran dicatat sebagai piutang',
            default => null,
        };
    }

    private function promoSummary(object $item, int $qty, int $baseUnitPrice, int $unitPrice): ?string
    {
        if ((bool) ($item->is_promo_reward ?? false)) {
            return implode(' • ', array_filter([
                'Item Bonus Promo',
                $item->promo_reward_rule_name ?? null,
            ]));
        }

        if ((int) ($item->discount_total ?? 0) <= 0) {
            return null;
        }

        $kindLabel = match ($item->pricing_rule_kind) {
            'standard_discount' => 'Harga Spesial',
            'qty_break' => 'Belanja Lebih Untung',
            'bundle_price' => 'Paket Hemat',
            'buy_x_get_y' => 'Promo Buy Get',
            default => 'Promo Spesial',
        };

        $headline = match ($item->pricing_rule_kind) {
            'qty_break' => 'Beli '.$qty.'+ lebih hemat',
            'bundle_price' => 'Ambil paket, harga lebih hemat',
            'buy_x_get_y' => 'Benefit buy-get diterapkan pada item ini',
            default => null,
        };

        $parts = array_filter([
            $kindLabel,
            $headline,
            $item->pricing_group_label ?: $item->pricing_rule_name,
            $baseUnitPrice > $unitPrice ? $this->compactMoney($baseUnitPrice).' -> '.$this->compactMoney($unitPrice) : null,
        ]);

        return implode(' • ', $parts);
    }

    private function compactMoney(int $value): string
    {
        return number_format($value, 0, ',', '.');
    }
}
