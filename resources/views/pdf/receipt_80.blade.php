@php
    $line = str_repeat('=', 48);
    $dash = str_repeat('-', 48);
    $formatPrice = fn($v) => 'Rp ' . number_format((int) ($v ?? 0), 0, ',', '.');

    $promoDiscount = (int) $transaction->details->sum('discount_total');
    $voucherDiscount = (int) ($transaction->customer_voucher_discount ?? 0);
    $loyaltyDiscount = (int) ($transaction->loyalty_discount_total ?? 0);
    $manualDiscount = (int) ($transaction->discount ?? 0);
    $shippingCost = (int) ($transaction->shipping_cost ?? 0);
    $grandTotal = (int) ($transaction->grand_total ?? 0);
    $cash = (int) ($transaction->cash ?? 0);
    $change = (int) ($transaction->change ?? 0);
    $subtotal = $grandTotal + $manualDiscount - $shippingCost + $promoDiscount + $voucherDiscount + $loyaltyDiscount;

    $paymentLabels = [
        'cash' => 'TUNAI',
        'bank_transfer' => 'TRANSFER BANK',
        'midtrans' => 'MIDTRANS',
        'xendit' => 'XENDIT',
        'pay_later' => 'PIUTANG',
    ];
    $paymentMethodKey = strtolower((string) ($transaction->payment_method ?? 'cash'));
    $paymentMethod = $paymentLabels[$paymentMethodKey] ?? strtoupper((string) ($transaction->payment_method ?? 'TUNAI'));
    $paymentSummary = match ($paymentMethodKey) {
        'bank_transfer' => trim(implode(' • ', array_filter([
            $transaction->bankAccount?->bank_name,
            $transaction->bankAccount?->account_number,
        ]))),
        'midtrans', 'xendit' => $transaction->payment_reference,
        'pay_later' => 'Pembayaran dicatat sebagai piutang',
        default => null,
    };
    $paidAmount = $paymentMethodKey === 'cash' ? $cash : max($cash, $grandTotal);
    $promoKindLabels = [
        'standard_discount' => 'Harga Spesial',
        'qty_break' => 'Belanja Lebih Untung',
        'bundle_price' => 'Paket Hemat',
        'buy_x_get_y' => 'Bonus Item',
    ];
@endphp
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <style>
        @page { margin: 0; }
        html, body { margin: 0; padding: 0; width: 80mm; }
        body {
            font-family: "Courier New", "DejaVu Sans Mono", monospace;
            width: 80mm;
            margin: 0;
            padding: 8px;
            font-size: 12px;
            line-height: 1.4;
            color: #000;
            box-sizing: border-box;
        }
        * { box-sizing: border-box; }
        .center { text-align: center; }
        .bold { font-weight: 700; }
        .section { margin: 6px 0; }
        .barcode img { height: 28px; }
        .muted { font-size: 10px; color: #475569; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        td { padding: 0; vertical-align: top; word-wrap: break-word; }
        .value { width: 34%; text-align: right; white-space: nowrap; }
        .item-name { font-weight: 600; }
    </style>
</head>
<body>
    <div class="center section" style="margin-top:0;">
        <div class="bold" style="margin-bottom:2px;">{{ $store['name'] }}</div>
        @if($store['address'])<div>{{ $store['address'] }}</div>@endif
        @if($store['phone'])<div>Telp: {{ $store['phone'] }}</div>@endif
        @if($store['email'])<div>Email: {{ $store['email'] }}</div>@endif
        @if($store['website'])<div>{{ $store['website'] }}</div>@endif
    </div>

    <pre style="margin:4px 0;">{{ $line }}</pre>

    <div class="section">
        <table>
            <tr><td>No</td><td class="value">{{ $transaction->invoice }}</td></tr>
            <tr><td>Tgl</td><td class="value">{{ \Carbon\Carbon::parse($transaction->created_at)->format('d/m/Y H:i') }}</td></tr>
            <tr><td>Kasir</td><td class="value">{{ $transaction->cashier->name ?? '-' }}</td></tr>
            <tr><td>Pelanggan</td><td class="value">{{ $transaction->customer->name ?? 'Umum' }}</td></tr>
            <tr><td>Pesanan</td><td class="value">{{ ($transaction->order_type ?? 'take_away') === 'dine_in' ? 'Dine In' : 'Take Away' }}</td></tr>
            @if($transaction->diningTable?->name)
                <tr><td>Meja</td><td class="value">{{ $transaction->diningTable->code ?: $transaction->diningTable->name }}</td></tr>
            @endif
            @if($transaction->waiter?->name)
                <tr><td>Waiter</td><td class="value">{{ $transaction->waiter->name }}</td></tr>
            @endif
        </table>
    </div>

    <pre style="margin:4px 0;">{{ $line }}</pre>

    <div class="section">
        @foreach($transaction->details as $item)
            @php
                $qty = max(1, (int) $item->qty);
                $lineTotal = (int) ($item->price ?? 0);
                $modifierTotal = (int) collect($item->modifiers ?? [])->sum('total_price');
                $baseLineTotal = max(0, $lineTotal - $modifierTotal);
                $unitPrice = (int) ($item->unit_price ?: ($qty ? $baseLineTotal / $qty : $baseLineTotal));
                $baseUnitPrice = (int) ($item->base_unit_price ?: $unitPrice);
                $promoTitle = $item->pricing_group_label ?: $item->pricing_rule_name;
                $promoKind = $promoKindLabels[$item->pricing_rule_kind] ?? null;
                $promoHeadline = match ($item->pricing_rule_kind) {
                    'qty_break' => 'Beli '.$qty.'+ lebih hemat',
                    'bundle_price' => 'Ambil paket, harga lebih hemat',
                    'buy_x_get_y' => 'Beli item pilihan, bonus langsung aktif',
                    default => null,
                };
            @endphp
            <div class="item-name">{{ $item->product->title ?? 'Produk' }}</div>
            @if((int) ($item->discount_total ?? 0) > 0)
                <div class="muted">
                    {{ implode(' • ', array_filter([$promoKind, $promoHeadline, $promoTitle])) ?: 'Promo Spesial' }}
                    @if($baseUnitPrice > $unitPrice)
                        • {{ $formatPrice($baseUnitPrice) }} → {{ $formatPrice($unitPrice) }}
                    @endif
                </div>
            @endif
            <table>
                <tr>
                    <td>{{ $qty }}x @ {{ $formatPrice($unitPrice) }}</td>
                    <td class="value">{{ $formatPrice($baseLineTotal) }}</td>
                </tr>
            </table>
            @foreach($item->modifiers ?? [] as $modifier)
                <table>
                    <tr>
                        <td>+ {{ $modifier->name }}</td>
                        <td class="value">{{ $formatPrice($modifier->total_price) }}</td>
                    </tr>
                </table>
            @endforeach
            @if($item->notes)
                <div class="muted">* {{ $item->notes }}</div>
            @endif
        @endforeach
    </div>

    <pre style="margin:4px 0;">{{ $dash }}</pre>

    <div class="section">
        <table>
            <tr><td>Subtotal</td><td class="value">{{ $formatPrice($subtotal) }}</td></tr>
            @if($promoDiscount > 0)
                <tr><td>Potongan Promo</td><td class="value">-{{ $formatPrice($promoDiscount) }}</td></tr>
            @endif
            @if($manualDiscount > 0)
                <tr><td>Diskon Manual</td><td class="value">-{{ $formatPrice($manualDiscount) }}</td></tr>
            @endif
            @if($voucherDiscount > 0)
                <tr><td>Voucher</td><td class="value">-{{ $formatPrice($voucherDiscount) }}</td></tr>
            @endif
            @if($loyaltyDiscount > 0)
                <tr><td>Redeem Poin</td><td class="value">-{{ $formatPrice($loyaltyDiscount) }}</td></tr>
            @endif
            @if($shippingCost > 0)
                <tr><td>Ongkir</td><td class="value">{{ $formatPrice($shippingCost) }}</td></tr>
            @endif
            <tr class="bold"><td>TOTAL</td><td class="value">{{ $formatPrice($grandTotal) }}</td></tr>
        </table>
    </div>

    <pre style="margin:4px 0;">{{ $dash }}</pre>

    <div class="section">
        <table>
            <tr><td>Metode Bayar</td><td class="value">{{ $paymentMethod }}</td></tr>
            @if($paymentSummary)
                <tr><td colspan="2" class="muted">{{ $paymentSummary }}</td></tr>
            @endif
            <tr><td>{{ $paymentMethodKey === 'cash' ? 'Bayar' : 'Nominal Bayar' }}</td><td class="value">{{ $formatPrice($paidAmount) }}</td></tr>
            @if($change > 0)
                <tr class="bold"><td>Kembali</td><td class="value">{{ $formatPrice($change) }}</td></tr>
            @endif
        </table>
    </div>

    <pre style="margin:4px 0;">{{ $line }}</pre>

    <div class="center section" style="margin-bottom:0;">
        <div class="barcode">
            <img src="{{ $barcode }}" alt="barcode">
        </div>
        <div style="font-size:11px;">{{ $transaction->invoice }}</div>
        <div>Terima kasih!</div>
    </div>
</body>
</html>
