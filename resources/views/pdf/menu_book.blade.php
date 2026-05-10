<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Buku Menu</title>
    <style>
        @page {
            margin: 22px 24px;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            color: #172033;
            font-family: DejaVu Sans, Arial, sans-serif;
            font-size: 11px;
            line-height: 1.45;
            background: #ffffff;
        }

        .cover {
            padding: 28px 30px 34px;
            border: 1px solid #dbe5f4;
            background: #f8fbff;
        }

        .cover-kicker {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 999px;
            background: #dbeafe;
            color: #1d4ed8;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
        }

        .cover-title {
            margin: 18px 0 8px;
            color: #0f172a;
            font-size: 28px;
            font-weight: 700;
            line-height: 1.2;
        }

        .cover-subtitle {
            margin: 0 0 16px;
            color: #475569;
            font-size: 12px;
        }

        .cover-meta {
            width: 100%;
            border-collapse: collapse;
            margin-top: 18px;
        }

        .cover-meta td {
            padding: 8px 0;
            border-bottom: 1px solid #dbe5f4;
            vertical-align: top;
        }

        .cover-meta .label {
            width: 110px;
            color: #64748b;
            font-weight: 700;
        }

        .section {
            page-break-before: always;
        }

        .section-header {
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 2px solid #dbe5f4;
        }

        .section-kicker {
            color: #2563eb;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
        }

        .section-title {
            margin: 8px 0 6px;
            color: #0f172a;
            font-size: 24px;
            font-weight: 700;
            line-height: 1.2;
        }

        .section-description {
            color: #64748b;
            font-size: 11px;
        }

        .product-card {
            margin-bottom: 14px;
            padding: 16px 18px;
            border: 1px solid #dbe5f4;
            background: #ffffff;
            page-break-inside: avoid;
        }

        .product-head {
            width: 100%;
            border-collapse: collapse;
        }

        .product-head td {
            vertical-align: top;
        }

        .product-title {
            margin: 8px 0 6px;
            color: #0f172a;
            font-size: 18px;
            font-weight: 700;
            line-height: 1.25;
        }

        .tenant-badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 999px;
            background: #eef4ff;
            color: #1d4ed8;
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
        }

        .product-description {
            margin: 0;
            color: #475569;
            font-size: 11px;
        }

        .price-box {
            width: 135px;
            padding-left: 16px;
            text-align: right;
        }

        .price-label {
            margin-bottom: 6px;
            color: #64748b;
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
        }

        .price-value {
            color: #0f172a;
            font-size: 18px;
            font-weight: 700;
        }

        .modifier-box {
            margin-top: 14px;
            padding: 12px 14px;
            border: 1px solid #e2e8f0;
            background: #f8fafc;
        }

        .modifier-title {
            margin: 0 0 8px;
            color: #334155;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
        }

        .modifier-table {
            width: 100%;
            border-collapse: collapse;
        }

        .modifier-table td {
            padding: 5px 0;
            border-top: 1px solid #e2e8f0;
            font-size: 11px;
        }

        .modifier-table tr:first-child td {
            border-top: none;
        }

        .modifier-price {
            width: 110px;
            text-align: right;
            color: #1d4ed8;
            font-weight: 700;
        }

        .modifier-empty {
            color: #94a3b8;
            font-size: 10px;
            font-style: italic;
        }

        .footer-note {
            margin-top: 20px;
            color: #94a3b8;
            font-size: 10px;
            text-align: right;
        }
    </style>
</head>
<body>
@php
    $formatPrice = fn ($value) => 'Rp ' . number_format((float) $value, 0, ',', '.');
@endphp

<div class="cover">
    <span class="cover-kicker">Buku Menu</span>
    <h1 class="cover-title">{{ $store['name'] ?? 'Outlet Menu Book' }}</h1>
    <p class="cover-subtitle">
        Daftar menu resmi per kategori lengkap dengan informasi tenant dapur serta pilihan topping atau tambahan.
    </p>

    <table class="cover-meta">
        @if (!empty($store['address']))
            <tr>
                <td class="label">Alamat</td>
                <td>{{ $store['address'] }}</td>
            </tr>
        @endif
        @if (!empty($store['phone']))
            <tr>
                <td class="label">Telepon</td>
                <td>{{ $store['phone'] }}</td>
            </tr>
        @endif
        @if (!empty($store['website']))
            <tr>
                <td class="label">Website</td>
                <td>{{ $store['website'] }}</td>
            </tr>
        @endif
        <tr>
            <td class="label">Dicetak</td>
            <td>{{ $generatedAt->format('d F Y H:i') }}</td>
        </tr>
        <tr>
            <td class="label">Kategori</td>
            <td>{{ $categories->count() }} kategori aktif</td>
        </tr>
    </table>
</div>

@foreach ($categories as $categoryIndex => $category)
    <div class="section">
        <div class="section-header">
            <div class="section-kicker">Kategori {{ str_pad((string) ($categoryIndex + 1), 2, '0', STR_PAD_LEFT) }}</div>
            <div class="section-title">{{ $category->name }}</div>
            @if (!empty($category->description))
                <div class="section-description">{{ $category->description }}</div>
            @endif
        </div>

        @foreach ($category->products as $product)
            <div class="product-card">
                <table class="product-head">
                    <tr>
                        <td>
                            <span class="tenant-badge">{{ $product->tenantOutlet->name ?? 'Tenant Outlet' }}</span>
                            <div class="product-title">{{ $product->title }}</div>
                            @if (!empty($product->description))
                                <p class="product-description">{{ $product->description }}</p>
                            @endif
                        </td>
                        <td class="price-box">
                            <div class="price-label">Harga Menu</div>
                            <div class="price-value">{{ $formatPrice($product->sell_price) }}</div>
                        </td>
                    </tr>
                </table>

                <div class="modifier-box">
                    <div class="modifier-title">Topping / Tambahan</div>
                    @if ($product->modifierOptions->isNotEmpty())
                        <table class="modifier-table">
                            @foreach ($product->modifierOptions as $modifier)
                                <tr>
                                    <td>{{ $modifier->name }}</td>
                                    <td class="modifier-price">{{ $formatPrice($modifier->price) }}</td>
                                </tr>
                            @endforeach
                        </table>
                    @else
                        <div class="modifier-empty">Tidak ada topping tambahan untuk menu ini.</div>
                    @endif
                </div>
            </div>
        @endforeach

        <div class="footer-note">Buku menu {{ $store['name'] ?? 'Outlet' }}</div>
    </div>
@endforeach
</body>
</html>
