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
            table-layout: fixed;
        }

        td {
            vertical-align: top;
            padding: 0;
            word-wrap: break-word;
        }

        .value {
            text-align: right;
            white-space: nowrap;
            width: 34%;
        }

        .item-name {
            font-weight: bold;
            margin-bottom: 1px;
            word-break: break-word;
        }

        .muted {
            font-size: 8px;
            color: #475569;
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
                <td class="value">: {{ $transaction->invoice }}</td>
            </tr>
            <tr>
                <td>Tgl</td>
                <td class="value">: {{ \Carbon\Carbon::parse($transaction->created_at)->format('d/m/Y H:i') }}</td>
            </tr>
            <tr>
                <td>Kasir</td>
                <td class="value">: {{ $transaction->cashier->name ?? '-' }}</td>
            </tr>
            <tr>
                <td>Pelanggan</td>
                <td class="value">: {{ $transaction->customer->name ?? 'Umum' }}</td>
            </tr>
            <tr>
                <td>Pesanan</td>
                <td class="value">: {{ ($transaction->order_type ?? 'take_away') === 'dine_in' ? 'Dine In' : 'Take Away' }}</td>
            </tr>
            @if($transaction->diningTable?->name)
                <tr>
                    <td>Meja</td>
                    <td class="value">: {{ $transaction->diningTable->code ?: $transaction->diningTable->name }}</td>
                </tr>
            @endif
            @if($transaction->waiter?->name)
                <tr>
                    <td>Waiter</td>
                    <td class="value">: {{ $transaction->waiter->name }}</td>
                </tr>
            @endif
        </table>
    </div>

    <div class="divider">{{ $strongLine }}</div>

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
                    <td>{{ $qty }} x {{ $formatPrice($unitPrice) }}</td>
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

    <div class="divider">{{ $line }}</div>

    <div class="section">
        <table>
            <tr>
                <td>Subtotal</td>
                <td class="value">{{ $formatPrice($subtotal) }}</td>
            </tr>
            @if($promoDiscount > 0)
                <tr>
                    <td>Potongan Promo</td>
                    <td class="value">-{{ $formatPrice($promoDiscount) }}</td>
                </tr>
            @endif
            @if($manualDiscount > 0)
                <tr>
                    <td>Diskon Manual</td>
                    <td class="value">-{{ $formatPrice($manualDiscount) }}</td>
                </tr>
            @endif
            @if($voucherDiscount > 0)
                <tr>
                    <td>Voucher</td>
                    <td class="value">-{{ $formatPrice($voucherDiscount) }}</td>
                </tr>
            @endif
            @if($loyaltyDiscount > 0)
                <tr>
                    <td>Redeem Poin</td>
                    <td class="value">-{{ $formatPrice($loyaltyDiscount) }}</td>
                </tr>
            @endif
            @if($shippingCost > 0)
                <tr>
                    <td>Ongkir</td>
                    <td class="value">{{ $formatPrice($shippingCost) }}</td>
                </tr>
            @endif
            <tr class="strong">
                <td>TOTAL</td>
                <td class="value">{{ $formatPrice($grandTotal) }}</td>
            </tr>
        </table>
    </div>

    <div class="divider">{{ $line }}</div>

    <div class="section">
        <table>
            <tr>
                <td>Metode Bayar</td>
                <td class="value">{{ $paymentMethod }}</td>
            </tr>
            @if($paymentSummary)
                <tr>
                    <td colspan="2" class="muted">{{ $paymentSummary }}</td>
                </tr>
            @endif
            <tr>
                <td>{{ $paymentMethodKey === 'cash' ? 'Bayar' : 'Nominal Bayar' }}</td>
                <td class="value">{{ $formatPrice($paidAmount) }}</td>
            </tr>
            @if($change > 0)
                <tr class="strong">
                    <td>Kembali</td>
                    <td class="value">{{ $formatPrice($change) }}</td>
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
