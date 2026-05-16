<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bukti Settlement {{ $allocation->allocation_number }}</title>
    <style>
        @page { size: A5 portrait; margin: 14mm; }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            font-family: Arial, Helvetica, sans-serif;
            color: #0f172a;
            background: #ffffff;
        }
        .sheet {
            border: 1px solid #cbd5e1;
            border-radius: 18px;
            overflow: hidden;
        }
        .header {
            padding: 20px 24px;
            background: linear-gradient(135deg, #0f172a, #1d4ed8);
            color: white;
        }
        .header small {
            letter-spacing: 0.18em;
            text-transform: uppercase;
            opacity: 0.8;
        }
        .header h1 {
            margin: 10px 0 0;
            font-size: 28px;
        }
        .content {
            padding: 24px;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 20px;
        }
        .card {
            border: 1px solid #e2e8f0;
            border-radius: 14px;
            padding: 14px 16px;
            background: #f8fafc;
        }
        .label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            color: #64748b;
            margin-bottom: 8px;
        }
        .value {
            font-size: 16px;
            font-weight: 700;
        }
        .value.small {
            font-size: 14px;
        }
        .section {
            margin-top: 20px;
        }
        .section h2 {
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            margin: 0 0 12px;
            color: #334155;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }
        th, td {
            padding: 10px 12px;
            border-bottom: 1px solid #e2e8f0;
        }
        th {
            text-align: left;
            color: #64748b;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.12em;
        }
        td:last-child, th:last-child {
            text-align: right;
        }
        .footer {
            padding: 16px 24px 24px;
            color: #475569;
            font-size: 12px;
        }
        .note {
            margin-top: 12px;
            padding: 12px 14px;
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            border-radius: 12px;
            font-size: 12px;
            color: #1e3a8a;
        }
    </style>
</head>
<body @if($autoprint) onload="window.print(); setTimeout(() => window.close(), 300);" @endif>
@php
    $formatMoney = fn ($value) => 'Rp '.number_format((int) $value, 0, ',', '.');
@endphp
<div class="sheet">
    <div class="header">
        <small>Bukti Settlement Tenant</small>
        <h1>{{ $allocation->allocation_number }}</h1>
    </div>
    <div class="content">
        <div class="grid">
            <div class="card">
                <div class="label">Tenant</div>
                <div class="value">{{ $allocation->tenantOutlet?->name ?? '-' }}</div>
                <div class="value small">{{ $allocation->tenantOutlet?->code ?? '-' }}</div>
            </div>
            <div class="card">
                <div class="label">Invoice</div>
                <div class="value">{{ $allocation->transaction?->invoice ?? '-' }}</div>
                <div class="value small">{{ optional($allocation->transaction?->created_at)->format('d/m/Y H:i') }}</div>
            </div>
            <div class="card">
                <div class="label">Divalidasi Oleh</div>
                <div class="value">{{ $allocation->validatedBy?->name ?? '-' }}</div>
                <div class="value small">{{ optional($allocation->validated_at)->format('d/m/Y H:i') }}</div>
            </div>
            <div class="card">
                <div class="label">Penerima</div>
                <div class="value">{{ $allocation->payout_recipient_name ?? '-' }}</div>
                <div class="value small">{{ optional($allocation->payout_paid_at)->format('d/m/Y H:i') }}</div>
            </div>
        </div>

        <div class="section">
            <h2>Ringkasan Settlement</h2>
            <table>
                <tbody>
                    <tr>
                        <th>Revenue Tenant</th>
                        <td>{{ $formatMoney($allocation->grand_total ?? 0) }}</td>
                    </tr>
                    <tr>
                        <th>Cost Tenant</th>
                        <td>{{ $formatMoney($allocation->cost_total ?? 0) }}</td>
                    </tr>
                    <tr>
                        <th>Profit Tenant</th>
                        <td>{{ $formatMoney($allocation->profit_total ?? 0) }}</td>
                    </tr>
                    <tr>
                        <th>Management Fee</th>
                        <td>{{ $formatMoney($allocation->management_fee_total ?? 0) }}</td>
                    </tr>
                    <tr>
                        <th>Payout Tenant</th>
                        <td><strong>{{ $formatMoney($allocation->tenant_payout_total ?? 0) }}</strong></td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>Metode Pembayaran Settlement</h2>
            <table>
                <thead>
                    <tr>
                        <th>Metode</th>
                        <th>Nominal</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Cash</td>
                        <td>{{ $formatMoney($allocation->payout_cash_amount ?? 0) }}</td>
                    </tr>
                    <tr>
                        <td>Transfer</td>
                        <td>{{ $formatMoney($allocation->payout_transfer_amount ?? 0) }}</td>
                    </tr>
                    <tr>
                        <td>{{ $allocation->payout_other_label ?: 'Lainnya' }}</td>
                        <td>{{ $formatMoney($allocation->payout_other_amount ?? 0) }}</td>
                    </tr>
                    <tr>
                        <td><strong>Total Dibayarkan</strong></td>
                        <td><strong>{{ $formatMoney($allocation->payout_breakdown_total ?? 0) }}</strong></td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>Catatan</h2>
            <div class="note">
                Referensi: {{ $allocation->payout_reference ?: '-' }}<br>
                Catatan: {{ $allocation->payout_notes ?: 'Tidak ada catatan settlement.' }}
            </div>
        </div>
    </div>
    <div class="footer">
        Bukti ini dicetak dari sistem POINZA sebagai konfirmasi payout settlement tenant.
    </div>
</div>
</body>
</html>
