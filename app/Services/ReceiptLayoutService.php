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
                ['label' => 'Tgl', 'value' => $transaction->created_at ? $this->formatReceiptDateTime($transaction->created_at, $paperWidth) : '-'],
                ['label' => 'Kasir', 'value' => $transaction->cashier->name ?? '-'],
                ['label' => 'Pelanggan', 'value' => $transaction->customer->name ?? 'Umum'],
                filled($transaction->order_reference_name ?? null) ? ['label' => 'Nama Order', 'value' => $transaction->order_reference_name] : null,
                filled($transaction->order_reference_notes ?? null) ? ['label' => 'Ket. Order', 'value' => $transaction->order_reference_notes] : null,
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

                $isReward = (bool) ($item->is_promo_reward ?? false) || ($unitPrice <= 0 && $baseUnitPrice > 0);

                return [
                    'name' => $item->product->title ?? 'Produk',
                    'promo' => $this->promoSummary($item, $qty, $baseUnitPrice, $unitPrice),
                    'qty' => $qty,
                    'unit_price_label' => $isReward ? 'Bonus' : $this->compactMoney($unitPrice),
                    'unit_note' => $isReward ? null : '@ '.$this->compactMoney($unitPrice).'/item',
                    'line_total_label' => $this->compactMoney($baseLineTotal),
                    'detail_left' => sprintf('%dx %s', $qty, $isReward ? 'Bonus' : $this->compactMoney($unitPrice)),
                    'detail_right' => $this->compactMoney($baseLineTotal),
                    'notes' => $this->normalizeOptionalText($item->notes ?? null),
                    'modifiers' => collect($item->modifiers ?? [])->map(fn ($modifier) => [
                        'label' => '+ '.$modifier->name,
                        'value' => $this->compactMoney((int) ($modifier->total_price ?? 0)),
                    ])->values()->all(),
                ];
            })->values()->all(),
            'totals' => array_values(array_filter([
                ['label' => 'Subtotal', 'value' => $this->compactMoney($subtotal)],
                $promoDiscount > 0 ? ['label' => 'Diskon', 'value' => $this->compactMoney($promoDiscount)] : null,
                $manualDiscount > 0 ? ['label' => 'Diskon Manual', 'value' => '-'.$this->compactMoney($manualDiscount)] : null,
                $voucherDiscount > 0 ? ['label' => 'Voucher', 'value' => '-'.$this->compactMoney($voucherDiscount)] : null,
                $loyaltyDiscount > 0 ? ['label' => 'Poin', 'value' => '-'.$this->compactMoney($loyaltyDiscount)] : null,
                $shippingCost > 0 ? ['label' => 'Ongkir', 'value' => $this->compactMoney($shippingCost)] : null,
                ['label' => 'Total', 'value' => $this->compactMoney($grandTotal), 'strong' => true],
            ])),
            'payments' => array_values(array_filter([
                ['label' => 'Metode', 'value' => $paymentMethodLabel],
                $paymentMethodKey === 'cash'
                    ? ['label' => 'Tunai', 'value' => $this->compactMoney($paidAmount)]
                    : ['label' => $paymentMethodLabel, 'value' => $this->compactMoney($paidAmount)],
                $change > 0 ? ['label' => 'Kembalian', 'value' => $this->compactMoney($change)] : null,
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
            'bank_transfer' => trim(implode(' / ', array_filter([
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
            return implode(' - ', array_filter([
                'Bonus Gratis '.max(1, $qty).'x',
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
            'buy_x_get_y' => null,
            default => null,
        };

        if ($item->pricing_rule_kind === 'buy_x_get_y') {
            $name = $item->pricing_group_label ?: $item->pricing_rule_name;

            return 'Promo: '.$name;
        }

        $parts = array_filter([
            $kindLabel,
            $headline,
            $item->pricing_group_label ?: $item->pricing_rule_name,
            $baseUnitPrice > $unitPrice ? $this->compactMoney($baseUnitPrice).' -> '.$this->compactMoney($unitPrice) : null,
        ]);

        return implode(' - ', $parts);
    }

    private function compactMoney(int $value): string
    {
        return number_format($value, 0, ',', '.');
    }

    private function formatReceiptDateTime(mixed $value, string $paperWidth): string
    {
        $date = \Carbon\Carbon::parse($value);

        return $paperWidth === '58mm'
            ? $date->format('d/m/y H:i')
            : $date->format('d/m/Y H:i');
    }

    private function normalizeOptionalText(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $text = trim((string) $value);

        if ($text === '' || in_array(strtolower($text), ['null', 'undefined', '-'], true)) {
            return null;
        }

        return $text;
    }
}
