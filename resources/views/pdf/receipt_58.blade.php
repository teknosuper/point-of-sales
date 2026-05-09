@php
    $line = str_repeat('-', 32);
    $strongLine = str_repeat('=', 32);
    $formatPrice = fn ($value) => 'Rp '.number_format((int) ($value ?? 0), 0, ',', '.');

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
        'bank_transfer' => 'TRANSFER',
        'midtrans' => 'MIDTRANS',
        'xendit' => 'XENDIT',
        'pay_later' => 'PIUTANG',
    ];
    $paymentMethod = $paymentLabels[strtolower((string) ($transaction->payment_method ?? 'cash'))] ?? strtoupper((string) ($transaction->payment_method ?? 'TUNAI'));
@endphp
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <style>
        @page {
            size: 58mm auto;
            margin: 0;
        }

        html, body {
            margin: 0;
            padding: 0;
            width: 58mm;
        }

        body {
            box-sizing: border-box;
            padding: 3mm 2.5mm;
            font-family: "Courier", "DejaVu Sans Mono", monospace;
            font-size: 9px;
            line-height: 1.35;
            color: #000;
        }

        * {
            box-sizing: border-box;
        }

        .center {
            text-align: center;
        }

        .section {
            margin: 4px 0;
        }

        .strong {
            font-weight: bold;
        }

        .divider {
            margin: 3px 0;
            white-space: pre;
            overflow: hidden;
        }

        table {
            width: 100%;
            border-collapse: collapse;
        }

        td {
            vertical-align: top;
            padding: 0;
        }

        td:last-child {
            text-align: right;
            white-space: nowrap;
        }

        .item-name {
            font-weight: bold;
            margin-bottom: 1px;
            word-break: break-word;
        }

        .muted {
            font-size: 8px;
        }

        .barcode {
            margin-top: 4px;
        }

        .barcode img {
            display: block;
            width: 100%;
            max-width: 46mm;
            height: 16mm;
            margin: 0 auto;
        }

        .invoice-code {
            margin-top: 2px;
            font-size: 8px;
            word-break: break-all;
        }
    </style>
</head>
<body>
    <div class="center section" style="margin-top: 0;">
        <div class="strong">{{ $store['name'] }}</div>
        @if($store['address'])
            <div>{{ $store['address'] }}</div>
        @endif
        @if($store['phone'])
            <div>Telp: {{ $store['phone'] }}</div>
        @endif
        @if($store['email'])
            <div>{{ $store['email'] }}</div>
        @endif
        @if($store['website'])
            <div>{{ $store['website'] }}</div>
        @endif
    </div>

    <div class="divider">{{ $strongLine }}</div>

    <div class="section">
        <table>
            <tr>
                <td>No</td>
                <td>: {{ $transaction->invoice }}</td>
            </tr>
            <tr>
                <td>Tgl</td>
                <td>: {{ \Carbon\Carbon::parse($transaction->created_at)->format('d/m/Y H:i') }}</td>
            </tr>
            <tr>
                <td>Kasir</td>
                <td>: {{ $transaction->cashier->name ?? '-' }}</td>
            </tr>
            <tr>
                <td>Pelanggan</td>
                <td>: {{ $transaction->customer->name ?? 'Umum' }}</td>
            </tr>
        </table>
    </div>

    <div class="divider">{{ $strongLine }}</div>

    <div class="section">
        @foreach($transaction->details as $item)
            @php
                $qty = max(1, (int) $item->qty);
                $lineTotal = (int) ($item->price ?? 0);
                $modifierTotal = (int) collect($item->modifiers ?? [])->sum('total_price');
                $baseLineTotal = $lineTotal - $modifierTotal;
                $unitPrice = (int) ($item->unit_price ?: ($qty ? $baseLineTotal / $qty : $baseLineTotal));
            @endphp
            <div class="item-name">{{ $item->product->title ?? 'Produk' }}</div>
            @if((int) ($item->discount_total ?? 0) > 0 && ($item->pricing_group_label || $item->pricing_rule_name))
                <div class="muted">Promo: {{ $item->pricing_group_label ?: $item->pricing_rule_name }}</div>
            @endif
            <table>
                <tr>
                    <td>{{ $qty }} x {{ $formatPrice($unitPrice) }}</td>
                    <td>{{ $formatPrice($baseLineTotal) }}</td>
                </tr>
            </table>
            @foreach($item->modifiers ?? [] as $modifier)
                <table>
                    <tr>
                        <td>+ {{ $modifier->name }}</td>
                        <td>{{ $formatPrice($modifier->total_price) }}</td>
                    </tr>
                </table>
            @endforeach
            @if($item->notes)
                <div class="muted">* {{ $item->notes }}</div>
            @endif
        @endforeach
    </div>

    <div class="divider">{{ $line }}</div>

    <div class="section">
        <table>
            <tr>
                <td>Subtotal</td>
                <td>{{ $formatPrice($subtotal) }}</td>
            </tr>
            @if($promoDiscount > 0)
                <tr>
                    <td>Promo</td>
                    <td>-{{ $formatPrice($promoDiscount) }}</td>
                </tr>
            @endif
            @if($manualDiscount > 0)
                <tr>
                    <td>Diskon</td>
                    <td>-{{ $formatPrice($manualDiscount) }}</td>
                </tr>
            @endif
            @if($voucherDiscount > 0)
                <tr>
                    <td>Voucher</td>
                    <td>-{{ $formatPrice($voucherDiscount) }}</td>
                </tr>
            @endif
            @if($loyaltyDiscount > 0)
                <tr>
                    <td>Poin</td>
                    <td>-{{ $formatPrice($loyaltyDiscount) }}</td>
                </tr>
            @endif
            @if($shippingCost > 0)
                <tr>
                    <td>Ongkir</td>
                    <td>{{ $formatPrice($shippingCost) }}</td>
                </tr>
            @endif
            <tr class="strong">
                <td>TOTAL</td>
                <td>{{ $formatPrice($grandTotal) }}</td>
            </tr>
        </table>
    </div>

    <div class="divider">{{ $line }}</div>

    <div class="section">
        <table>
            <tr>
                <td>Bayar {{ $paymentMethod }}</td>
                <td>{{ $formatPrice($cash) }}</td>
            </tr>
            @if($change > 0)
                <tr class="strong">
                    <td>Kembali</td>
                    <td>{{ $formatPrice($change) }}</td>
                </tr>
            @endif
        </table>
    </div>

    <div class="divider">{{ $strongLine }}</div>

    <div class="center section" style="margin-bottom: 0;">
        <div class="barcode">
            <img src="{{ $barcode }}" alt="barcode">
        </div>
        <div class="invoice-code">{{ $transaction->invoice }}</div>
        <div>Terima kasih!</div>
    </div>
</body>
</html>
