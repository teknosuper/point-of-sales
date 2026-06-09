<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rekap Settlement Tenant</title>
    <style>
        @page { size: A4 portrait; margin: 12mm; }
        body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 0; }
        .header { border-bottom: 2px solid #1d4ed8; padding-bottom: 12px; margin-bottom: 16px; }
        .header small { text-transform: uppercase; letter-spacing: .16em; color: #64748b; }
        .header h1 { margin: 8px 0 4px; font-size: 28px; }
        .muted { color: #64748b; font-size: 12px; }
        .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
        .card { border: 1px solid #cbd5e1; border-radius: 12px; padding: 10px 12px; background: #f8fafc; }
        .card .label { font-size: 11px; text-transform: uppercase; letter-spacing: .12em; color: #64748b; }
        .card .value { margin-top: 6px; font-size: 16px; font-weight: 700; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border-bottom: 1px solid #e2e8f0; padding: 8px 10px; vertical-align: top; }
        th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .12em; color: #64748b; }
        td:last-child, th:last-child { text-align: right; }
        .badge { display: inline-block; border-radius: 999px; padding: 4px 8px; font-size: 10px; font-weight: 700; }
        .settled { background: #dcfce7; color: #166534; }
        .outstanding { background: #fef3c7; color: #92400e; }
        .footer { margin-top: 14px; font-size: 11px; color: #64748b; }
    </style>
</head>
<body @if($autoprint) onload="window.print(); setTimeout(() => window.close(), 300);" @endif>
@php
    $formatMoney = fn ($value) => 'Rp '.number_format((int) $value, 0, ',', '.');
@endphp
<div class="header">
    <small>GTC KASIR • Rekap Settlement Tenant</small>
    <h1>Batch Settlement</h1>
    <div class="muted">
        Dicetak {{ now()->format('d/m/Y H:i') }}
        @if(!empty($filters['start_date']) || !empty($filters['end_date']))
            • Periode {{ $filters['start_date'] ?: '-' }} s/d {{ $filters['end_date'] ?: '-' }}
        @endif
    </div>
</div>

<div class="summary">
    <div class="card"><div class="label">Allocation</div><div class="value">{{ $summary['allocation_count'] }}</div></div>
    <div class="card"><div class="label">Tenant</div><div class="value">{{ $summary['tenant_count'] }}</div></div>
    <div class="card"><div class="label">Payout Total</div><div class="value">{{ $formatMoney($summary['tenant_payout_total']) }}</div></div>
    <div class="card"><div class="label">Sudah Settled</div><div class="value">{{ $formatMoney($summary['settled_total']) }}</div></div>
    <div class="card"><div class="label">Outstanding</div><div class="value">{{ $formatMoney($summary['outstanding_total']) }}</div></div>
    <div class="card"><div class="label">Revenue</div><div class="value">{{ $formatMoney($summary['revenue_total']) }}</div></div>
    <div class="card"><div class="label">Profit</div><div class="value">{{ $formatMoney($summary['profit_total']) }}</div></div>
    <div class="card"><div class="label">Potongan Tenant</div><div class="value">{{ $formatMoney($summary['tenant_discount_total'] ?? 0) }}</div></div>
    <div class="card"><div class="label">Potongan Owner</div><div class="value">{{ $formatMoney($summary['owner_discount_total'] ?? 0) }}</div></div>
    <div class="card"><div class="label">Fee</div><div class="value">{{ $formatMoney($summary['management_fee_total']) }}</div></div>
</div>

<table>
    <thead>
        <tr>
            <th>Allocation</th>
            <th>Tenant</th>
            <th>Invoice</th>
            <th>Promo</th>
            <th>Split Promo</th>
            <th>Revenue</th>
            <th>Payout</th>
            <th>Breakdown</th>
            <th>Status</th>
        </tr>
    </thead>
    <tbody>
    @foreach($allocations as $allocation)
        <tr>
            <td>
                <strong>{{ $allocation->allocation_number }}</strong><br>
                <span class="muted">{{ optional($allocation->transaction?->created_at)->format('d/m/Y H:i') }}</span>
            </td>
            <td>
                {{ $allocation->tenantOutlet?->name ?? '-' }}<br>
                <span class="muted">{{ $allocation->tenantOutlet?->code ?? '-' }}</span>
            </td>
            <td>
                {{ $allocation->transaction?->invoice ?? '-' }}<br>
                <span class="muted">{{ $allocation->total_items ?? 0 }} item</span>
            </td>
            <td>{{ $formatMoney($allocation->total_discount_total ?? 0) }}</td>
            <td>
                Tenant {{ $formatMoney($allocation->tenant_discount_total ?? 0) }}<br>
                <span class="muted">Owner {{ $formatMoney($allocation->owner_discount_total ?? 0) }}</span>
            </td>
            <td>{{ $formatMoney($allocation->grand_total ?? 0) }}</td>
            <td>{{ $formatMoney($allocation->tenant_payout_total ?? 0) }}</td>
            <td>
                Cash {{ $formatMoney($allocation->payout_cash_amount ?? 0) }}<br>
                Transfer {{ $formatMoney($allocation->payout_transfer_amount ?? 0) }}
                @if(($allocation->payout_other_amount ?? 0) > 0)
                    <br>{{ $allocation->payout_other_label ?: 'Lainnya' }} {{ $formatMoney($allocation->payout_other_amount ?? 0) }}
                @endif
                @if($allocation->payout_reference)
                    <br><span class="muted">Ref {{ $allocation->payout_reference }}</span>
                @endif
            </td>
            <td>
                @if($allocation->settled_at)
                    <span class="badge settled">Settled</span><br>
                    <span class="muted">{{ $allocation->validatedBy?->name ?? '-' }}</span>
                @else
                    <span class="badge outstanding">Outstanding</span>
                @endif
            </td>
        </tr>
    @endforeach
    </tbody>
</table>

<div class="footer">
    Dokumen ini digunakan sebagai rekap batch settlement tenant. Revenue dan payout sudah mengikuti pricing rules tenant yang aktif pada transaksi.
</div>
</body>
</html>
