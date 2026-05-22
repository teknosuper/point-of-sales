<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bukti Setoran {{ $settlement['request_number'] ?? 'Kasir' }}</title>
    <style>
        @page { size: A5 portrait; margin: 14mm; }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            font-family: Arial, Helvetica, sans-serif;
            background: #ffffff;
            color: #0f172a;
        }
        .sheet {
            border: 1px solid #cbd5e1;
            border-radius: 18px;
            overflow: hidden;
        }
        .header {
            padding: 22px 24px;
            background: linear-gradient(135deg, #0f172a, #2563eb);
            color: #fff;
        }
        .eyebrow {
            text-transform: uppercase;
            letter-spacing: 0.16em;
            font-size: 11px;
            opacity: 0.8;
        }
        .header h1 {
            margin: 10px 0 6px;
            font-size: 28px;
        }
        .header p {
            margin: 0;
            font-size: 13px;
            opacity: 0.9;
        }
        .content {
            padding: 24px;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
        }
        .card {
            border: 1px solid #e2e8f0;
            border-radius: 14px;
            background: #f8fafc;
            padding: 14px 16px;
        }
        .label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            color: #64748b;
            margin-bottom: 6px;
        }
        .value {
            font-size: 16px;
            font-weight: 700;
        }
        .value.small {
            font-size: 13px;
            font-weight: 500;
        }
        .section {
            margin-top: 20px;
        }
        .section h2 {
            margin: 0 0 12px;
            font-size: 14px;
            letter-spacing: 0.12em;
            text-transform: uppercase;
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
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            color: #64748b;
        }
        td:last-child, th:last-child {
            text-align: right;
        }
        .note {
            margin-top: 12px;
            padding: 12px 14px;
            border-radius: 12px;
            border: 1px solid #dbeafe;
            background: #eff6ff;
            color: #1e3a8a;
            font-size: 12px;
            line-height: 1.6;
        }
        .footer {
            padding: 16px 24px 24px;
            font-size: 12px;
            color: #475569;
        }
    </style>
</head>
<body @if($autoprint) onload="window.print(); setTimeout(() => window.close(), 300);" @endif>
@php
    $money = fn ($value) => 'Rp '.number_format((int) $value, 0, ',', '.');
    $dateTime = fn ($value) => $value ? \Carbon\Carbon::parse($value)->format('d/m/Y H:i') : '-';
    $isTenantRequest = (bool) ($settlement['is_tenant_request'] ?? false);
@endphp
<div class="sheet">
    <div class="header">
        <div class="eyebrow">{{ $isTenantRequest ? 'Bukti Pencairan Tenant' : 'Bukti Setoran Kasir' }}</div>
        <h1>{{ $settlement['request_number'] ?? '-' }}</h1>
        <p>{{ $isTenantRequest ? 'Approval pencairan dana tenant ke owner outlet' : 'Approval setoran dasar kasir ke admin / owner' }}</p>
    </div>

    <div class="content">
        <div class="grid">
            <div class="card">
                <div class="label">Kasir</div>
                <div class="value">{{ $settlement['cashier']['name'] ?? '-' }}</div>
                <div class="value small">Shift #{{ $settlement['cashier_shift']['id'] ?? '-' }}</div>
            </div>
            <div class="card">
                <div class="label">Tanggal Bisnis</div>
                <div class="value">{{ $settlement['business_date'] ?? '-' }}</div>
                <div class="value small">Dibuat {{ $dateTime($settlement['created_at'] ?? null) }}</div>
            </div>
            <div class="card">
                <div class="label">Penerima</div>
                <div class="value">{{ $settlement['recipient_name'] ?? '-' }}</div>
                <div class="value small">Dibayar {{ $dateTime($settlement['paid_at'] ?? null) }}</div>
            </div>
            <div class="card">
                <div class="label">Validator</div>
                <div class="value">{{ $settlement['approved_by']['name'] ?? '-' }}</div>
                <div class="value small">Disetujui {{ $dateTime($settlement['approved_at'] ?? null) }}</div>
            </div>
        </div>

        <div class="section">
            <h2>Ringkasan Setoran</h2>
            <table>
                <tbody>
                    <tr>
                        <th>{{ $isTenantRequest ? 'Penjualan Setelah Promo' : 'Penjualan Bruto' }}</th>
                        <td>{{ $money($settlement['settlement_reference_total'] ?? $settlement['gross_sales_total'] ?? 0) }}</td>
                    </tr>
                    <tr>
                        <th>{{ $isTenantRequest ? 'Harga Dasar Tenant' : 'Nilai Dasar' }}</th>
                        <td>{{ $money($settlement['pricing_basis_total'] ?? $settlement['base_sales_total'] ?? 0) }}</td>
                    </tr>
                    <tr>
                        <th>{{ $isTenantRequest ? 'Diskon Pricing Rules' : 'Markup Owner' }}</th>
                        <td>{{ $money($settlement['pricing_adjustment_total'] ?? $settlement['markup_total'] ?? 0) }}</td>
                    </tr>
                    <tr>
                        <th>Nominal Diminta</th>
                        <td>{{ $money($settlement['requested_amount'] ?? 0) }}</td>
                    </tr>
                    <tr>
                        <th>Nominal Disetujui</th>
                        <td><strong>{{ $money($settlement['approved_amount'] ?? 0) }}</strong></td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>Metode Pembayaran</h2>
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
                        <td>{{ $money($settlement['approved_cash_amount'] ?? 0) }}</td>
                    </tr>
                    <tr>
                        <td>Transfer</td>
                        <td>{{ $money($settlement['approved_transfer_amount'] ?? 0) }}</td>
                    </tr>
                    <tr>
                        <td>{{ $settlement['approved_other_label'] ?: 'Lainnya' }}</td>
                        <td>{{ $money($settlement['approved_other_amount'] ?? 0) }}</td>
                    </tr>
                    <tr>
                        <td><strong>Total Dibayar</strong></td>
                        <td><strong>{{ $money($settlement['approved_amount'] ?? 0) }}</strong></td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>Catatan</h2>
            <div class="note">
                Referensi: {{ $settlement['approval_reference'] ?: '-' }}<br>
                Catatan pengajuan: {{ $settlement['requested_notes'] ?: 'Tidak ada catatan pengajuan.' }}<br>
                Catatan approval: {{ $settlement['approval_notes'] ?: 'Tidak ada catatan approval.' }}
            </div>
        </div>
    </div>

    <div class="footer">
        Bukti ini dicetak dari sistem POINZA sebagai konfirmasi approval setoran kasir atau pencairan dana tenant.
    </div>
</div>
</body>
</html>
