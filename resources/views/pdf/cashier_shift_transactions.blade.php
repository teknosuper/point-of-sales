<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <title>Transaksi Shift Kasir</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 12px; color: #0f172a; }
        h1, h2, h3, p { margin: 0; }
        .muted { color: #64748b; }
        .section { margin-top: 18px; }
        .header { width: 100%; border-collapse: collapse; }
        .header td { vertical-align: top; }
        .logo { width: 64px; height: 64px; display:flex; align-items:center; justify-content:center; overflow:hidden; }
        .logo img { max-width:100%; max-height:100%; object-fit:contain; }
        .grid { width: 100%; border-collapse: collapse; }
        .grid th, .grid td { border: 1px solid #cbd5e1; padding: 8px; vertical-align: top; }
        .grid th { background: #f8fafc; text-align: left; }
        .grid tfoot td { background: #f8fafc; font-weight: bold; }
        .pill { display: inline-block; padding: 3px 8px; border-radius: 999px; font-size: 11px; background: #e2e8f0; }
        .summary td { border: none; padding: 4px 0; }
    </style>
</head>
<body>
    <table class="header">
        <tr>
            <td style="width:80px;">
                <div class="logo">
                    @if($store['logo_data'] ?? false)
                        <img src="{{ $store['logo_data'] }}" alt="{{ $store['name'] }}">
                    @elseif($store['logo'] ?? false)
                        <img src="{{ $store['logo'] }}" alt="{{ $store['name'] }}">
                    @endif
                </div>
            </td>
            <td>
                <h1>Transaksi Shift Kasir</h1>
                <p class="muted" style="margin-top: 6px;">
                    {{ $store['name'] ?? ($shift['outlet']['name'] ?? 'Tanpa Outlet') }}
                    @if(!empty($store['code']))
                        • {{ $store['code'] }}
                    @endif
                </p>
                @if(!empty($store['address']) || !empty($store['city']))
                    <p class="muted" style="margin-top: 4px;">
                        {{ trim(($store['address'] ?? '').' '.($store['city'] ?? '')) }}
                    </p>
                @endif
                @if(!empty($store['phone']) || !empty($store['email']) || !empty($store['website']))
                    <p class="muted" style="margin-top: 4px;">
                        {{ $store['phone'] ?? '-' }}
                        @if(!empty($store['email'])) • {{ $store['email'] }} @endif
                        @if(!empty($store['website'])) • {{ $store['website'] }} @endif
                    </p>
                @endif
            </td>
        </tr>
    </table>

    <p class="muted" style="margin-top: 10px;">Shift #{{ $shift['id'] }} • {{ $shift['outlet']['name'] ?? 'Tanpa Outlet' }}</p>
    <p class="muted" style="margin-top: 4px;">Kasir utama: {{ $shift['user']['name'] ?? '-' }} • Dibuka: {{ $shiftPdfMeta['opened_at'] ?? '-' }} ({{ $timezoneLabel }})</p>
    <p class="muted" style="margin-top: 4px;">Ditutup: {{ $shiftPdfMeta['closed_at'] ?? '-' }} ({{ $timezoneLabel }})</p>
    <p class="muted" style="margin-top: 4px;">Kasir terlibat: {{ count($involvedCashiers) > 0 ? implode(', ', $involvedCashiers) : '-' }}</p>
    <p class="muted" style="margin-top: 4px;">Digenerate: {{ $generatedAt->timezone(config('app.timezone'))->format('d/m/Y H:i:s') }} ({{ $timezoneLabel }})</p>

    <div class="section">
        <h3>Catatan Shift</h3>
        <table class="summary" style="margin-top: 6px;">
            <tr>
                <td width="180">Catatan pembukaan</td>
                <td>: {{ $shift['notes'] ?: '-' }}</td>
            </tr>
            <tr>
                <td>Dibuat oleh</td>
                <td>: {{ $shift['opened_by']['name'] ?? '-' }}</td>
            </tr>
            <tr>
                <td>Catatan closing</td>
                <td>: {{ $shift['close_notes'] ?: '-' }}</td>
            </tr>
            <tr>
                <td>Ditutup oleh</td>
                <td>: {{ $shift['closed_by']['name'] ?? '-' }}</td>
            </tr>
        </table>
    </div>

    <div class="section">
        <h3>Ringkasan Kas Shift</h3>
        <table class="grid" style="margin-top: 8px;">
            <thead>
                <tr>
                    <th>Uang Modal Kasir</th>
                    <th>Uang Cash Masuk</th>
                    <th>Uang di Kasir</th>
                    <th>Uang Cash Aktual</th>
                    <th>Selisih Uang Cash</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Rp {{ number_format($shift['opening_cash'] ?? 0, 0, ',', '.') }}</td>
                    <td>Rp {{ number_format($shift['cash_sales_total'] ?? 0, 0, ',', '.') }}</td>
                    <td>Rp {{ number_format($shift['expected_cash'] ?? 0, 0, ',', '.') }}</td>
                    <td>{{ isset($shift['actual_cash']) && $shift['actual_cash'] !== null ? 'Rp '.number_format($shift['actual_cash'], 0, ',', '.') : '-' }}</td>
                    <td>{{ isset($shift['cash_difference']) && $shift['cash_difference'] !== null ? 'Rp '.number_format($shift['cash_difference'], 0, ',', '.') : '-' }}</td>
                </tr>
            </tbody>
        </table>
        <table class="summary" style="margin-top: 8px;">
            <tr><td width="180">Transaksi tunai</td><td>: Rp {{ number_format($shift['cash_sales_total'] ?? 0, 0, ',', '.') }}</td></tr>
            <tr><td>Transaksi non tunai</td><td>: Rp {{ number_format($shift['non_cash_sales_total'] ?? 0, 0, ',', '.') }}</td></tr>
            <tr><td>Refund tunai</td><td>: Rp {{ number_format($shift['cash_refund_total'] ?? 0, 0, ',', '.') }}</td></tr>
            <tr><td>Refund non tunai</td><td>: Rp {{ number_format($shift['non_cash_refund_total'] ?? 0, 0, ',', '.') }}</td></tr>
            <tr><td>Hak tenant</td><td>: Rp {{ number_format($shift['base_sales_total'] ?? 0, 0, ',', '.') }}</td></tr>
            <tr><td>Markup owner</td><td>: Rp {{ number_format($shift['markup_total'] ?? 0, 0, ',', '.') }}</td></tr>
            <tr><td>Total transaksi lunas</td><td>: {{ number_format($shift['paid_transactions_count'] ?? 0, 0, ',', '.') }} transaksi</td></tr>
        </table>
    </div>

    <div class="section">
        <h3>Breakdown Pembayaran</h3>
        <table class="grid" style="margin-top: 8px;">
            <thead>
                <tr>
                    <th>Metode</th>
                    <th>Jumlah Transaksi</th>
                    <th>Total Penjualan</th>
                </tr>
            </thead>
            <tbody>
                @forelse($paymentMethodBreakdown as $row)
                    <tr>
                        <td>{{ $row['payment_method_label'] }}</td>
                        <td>{{ number_format($row['transactions_count'], 0, ',', '.') }}</td>
                        <td>Rp {{ number_format($row['gross_total'], 0, ',', '.') }}</td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="3">Belum ada transaksi lunas pada shift ini.</td>
                    </tr>
                @endforelse
            </tbody>
            <tfoot>
                <tr>
                    <td>Grand Total</td>
                    <td>{{ number_format(collect($paymentMethodBreakdown)->sum('transactions_count'), 0, ',', '.') }}</td>
                    <td>Rp {{ number_format(collect($paymentMethodBreakdown)->sum('gross_total'), 0, ',', '.') }}</td>
                </tr>
            </tfoot>
        </table>
    </div>

    <div class="section">
        <h3>Breakdown Penghasilan per Tenant</h3>
        <table class="grid" style="margin-top: 8px;">
            <thead>
                <tr>
                    <th>Tenant</th>
                    <th>Qty Terjual</th>
                    <th>Harga Customer</th>
                    <th>Hasil Tenant</th>
                    <th>Markup Owner</th>
                </tr>
            </thead>
            <tbody>
                @forelse($tenantBreakdown as $row)
                    <tr>
                        <td>{{ $row['tenant_name'] }}</td>
                        <td>{{ number_format($row['total_qty'], 0, ',', '.') }}</td>
                        <td>Rp {{ number_format($row['total_gross_sales'], 0, ',', '.') }}</td>
                        <td>Rp {{ number_format($row['total_tenant_sales'], 0, ',', '.') }}</td>
                        <td>Rp {{ number_format($row['total_owner_markup'], 0, ',', '.') }}</td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="5">Tidak ada data tenant pada transaksi shift ini.</td>
                    </tr>
                @endforelse
            </tbody>
            <tfoot>
                <tr>
                    <td>Grand Total</td>
                    <td>{{ number_format(collect($tenantBreakdown)->sum('total_qty'), 0, ',', '.') }}</td>
                    <td>Rp {{ number_format(collect($tenantBreakdown)->sum('total_gross_sales'), 0, ',', '.') }}</td>
                    <td>Rp {{ number_format(collect($tenantBreakdown)->sum('total_tenant_sales'), 0, ',', '.') }}</td>
                    <td>Rp {{ number_format(collect($tenantBreakdown)->sum('total_owner_markup'), 0, ',', '.') }}</td>
                </tr>
            </tfoot>
        </table>
    </div>

    <div class="section">
        <h3>Breakdown Penghasilan per Produk</h3>
        <table class="grid" style="margin-top: 8px;">
            <thead>
                <tr>
                    <th>Produk</th>
                    <th>Qty Terjual</th>
                    <th>Harga Customer</th>
                    <th>Hasil Tenant</th>
                    <th>Markup Owner</th>
                </tr>
            </thead>
            <tbody>
                @forelse($productBreakdown as $row)
                    <tr>
                        <td>{{ $row['product_title'] }}</td>
                        <td>{{ number_format($row['total_qty'], 0, ',', '.') }}</td>
                        <td>Rp {{ number_format($row['total_gross_sales'], 0, ',', '.') }}</td>
                        <td>Rp {{ number_format($row['total_tenant_sales'], 0, ',', '.') }}</td>
                        <td>Rp {{ number_format($row['total_owner_markup'], 0, ',', '.') }}</td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="5">Tidak ada data produk pada transaksi shift ini.</td>
                    </tr>
                @endforelse
            </tbody>
            <tfoot>
                <tr>
                    <td>Grand Total</td>
                    <td>{{ number_format(collect($productBreakdown)->sum('total_qty'), 0, ',', '.') }}</td>
                    <td>Rp {{ number_format(collect($productBreakdown)->sum('total_gross_sales'), 0, ',', '.') }}</td>
                    <td>Rp {{ number_format(collect($productBreakdown)->sum('total_tenant_sales'), 0, ',', '.') }}</td>
                    <td>Rp {{ number_format(collect($productBreakdown)->sum('total_owner_markup'), 0, ',', '.') }}</td>
                </tr>
            </tfoot>
        </table>
    </div>

    <div class="section">
        <h3>Daftar Transaksi</h3>
        <table class="grid" style="margin-top: 8px;">
            <thead>
                <tr>
                    <th>Invoice</th>
                    <th>Waktu</th>
                    <th>Kasir</th>
                    <th>Pelanggan</th>
                    <th>Pembayaran</th>
                    <th>Grand Total</th>
                    <th>Hak Tenant</th>
                    <th>Markup Owner</th>
                </tr>
            </thead>
            <tbody>
                @forelse($transactions as $transaction)
                    <tr>
                        <td>
                            <strong>{{ $transaction['invoice'] }}</strong><br>
                                <span class="muted">{{ $transaction['order_type'] ?: '-' }}</span>
                        </td>
                        <td>
                            {{ $transaction['created_at'] ? \Carbon\Carbon::parse($transaction['created_at'])->timezone(config('app.timezone'))->format('d/m/Y H:i:s') : '-' }}
                            <br><span class="muted">{{ $timezoneLabel }}</span>
                            @if($transaction['table_label'])
                                <br><span class="muted">{{ $transaction['table_label'] }}</span>
                            @endif
                        </td>
                        <td>{{ $transaction['cashier_name'] ?: '-' }}</td>
                        <td>{{ $transaction['customer_name'] }}</td>
                        <td>
                            <span class="pill">{{ $transaction['payment_method_label'] }}</span><br>
                            <span class="muted">{{ $transaction['payment_status'] ?: '-' }}</span>
                            @if(($transaction['payment_method'] ?? '') === 'cash')
                                <br><span class="muted">Bayar customer: Rp {{ number_format($transaction['cash_received'] ?? 0, 0, ',', '.') }}</span>
                                <br><span class="muted">Kembalian: Rp {{ number_format($transaction['cash_change'] ?? 0, 0, ',', '.') }}</span>
                                <br><span class="muted">Uang tunai transaksi: Rp {{ number_format($transaction['expected_cash_in'] ?? 0, 0, ',', '.') }}</span>
                                <br><span class="muted">Saldo kas setelah transaksi: Rp {{ number_format($transaction['running_expected_cash'] ?? 0, 0, ',', '.') }}</span>
                            @else
                                <br><span class="muted">Expected non tunai: Rp {{ number_format($transaction['expected_non_cash_in'] ?? 0, 0, ',', '.') }}</span>
                            @endif
                        </td>
                        <td>Rp {{ number_format($transaction['grand_total'], 0, ',', '.') }}</td>
                        <td>Rp {{ number_format($transaction['base_sales_total'], 0, ',', '.') }}</td>
                        <td>Rp {{ number_format($transaction['markup_total'], 0, ',', '.') }}</td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="8">Tidak ada transaksi yang cocok dengan filter.</td>
                    </tr>
                @endforelse
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="4">Grand Total</td>
                    <td>{{ number_format(collect($transactions)->count(), 0, ',', '.') }} trx</td>
                    <td>Rp {{ number_format(collect($transactions)->sum('grand_total'), 0, ',', '.') }}</td>
                    <td>Rp {{ number_format(collect($transactions)->sum('base_sales_total'), 0, ',', '.') }}</td>
                    <td>Rp {{ number_format(collect($transactions)->sum('markup_total'), 0, ',', '.') }}</td>
                </tr>
            </tfoot>
        </table>
    </div>
</body>
</html>
