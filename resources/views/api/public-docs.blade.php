<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $docs['title'] }}</title>
    <style>
        :root {
            color-scheme: light;
            --bg: #f6f3ea;
            --surface: #fffdf8;
            --text: #1f2937;
            --muted: #6b7280;
            --accent: #8a5a00;
            --accent-soft: #fff1cc;
            --border: #e5dcc8;
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: linear-gradient(180deg, #f6f3ea 0%, #efe5d0 100%);
            color: var(--text);
        }
        .wrap { max-width: 1120px; margin: 0 auto; padding: 32px 20px 64px; }
        .hero, .card {
            background: rgba(255, 253, 248, 0.96);
            border: 1px solid var(--border);
            border-radius: 20px;
            box-shadow: 0 14px 40px rgba(75, 54, 16, 0.08);
        }
        .hero { padding: 28px; margin-bottom: 20px; }
        .eyebrow {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 999px;
            background: var(--accent-soft);
            color: var(--accent);
            font-size: 12px;
            font-weight: 700;
            letter-spacing: .08em;
            text-transform: uppercase;
        }
        h1, h2, h3 { margin: 0; }
        h1 { margin-top: 16px; font-size: clamp(30px, 5vw, 52px); line-height: 1.02; }
        .lead { margin: 14px 0 0; max-width: 760px; color: var(--muted); line-height: 1.7; }
        .grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 20px; }
        .span-4 { grid-column: span 4; }
        .span-6 { grid-column: span 6; }
        .span-8 { grid-column: span 8; }
        .span-12 { grid-column: span 12; }
        .card { padding: 22px; }
        .section-title { margin-bottom: 14px; font-size: 20px; }
        .muted { color: var(--muted); }
        .list, .query-list { margin: 0; padding-left: 18px; }
        .list li, .query-list li { margin: 8px 0; line-height: 1.6; }
        .endpoint { padding: 18px 0; border-top: 1px solid var(--border); }
        .endpoint:first-child { border-top: 0; padding-top: 0; }
        .badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 999px;
            background: #1f2937;
            color: #fff;
            font-size: 12px;
            font-weight: 700;
            margin-right: 10px;
        }
        code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }
        code { background: #f6efe1; padding: 2px 6px; border-radius: 6px; }
        pre {
            overflow: auto;
            background: #1f2430;
            color: #f8f8f2;
            border-radius: 14px;
            padding: 16px;
            line-height: 1.55;
            font-size: 13px;
        }
        .mini { font-size: 13px; }
        @media (max-width: 900px) {
            .span-4, .span-6, .span-8, .span-12 { grid-column: span 12; }
            .wrap { padding: 20px 14px 42px; }
            .hero, .card { border-radius: 16px; }
        }
    </style>
</head>
<body>
    <div class="wrap">
        <section class="hero">
            <span class="eyebrow">Public API Docs</span>
            <h1>{{ $docs['title'] }}</h1>
            <p class="lead">
                API publik untuk katalog produk, harga promo, dan highlight produk. Tidak membutuhkan auth, bisa langsung dipakai dari aplikasi lain seperti Cloudflare Pages.
            </p>
            <p class="mini muted" style="margin-top: 14px;">
                Base URL: <code>{{ $docs['base_url'] }}</code><br>
                Docs JSON: <code>{{ $docs['docs_url'] }}?format=json</code>
            </p>
        </section>

        <div class="grid">
            <section class="card span-4">
                <h2 class="section-title">Quick Facts</h2>
                <ul class="list">
                    <li>Auth: <strong>tidak perlu</strong></li>
                    <li>CORS: <code>*</code> untuk <code>GET</code> dan <code>OPTIONS</code></li>
                    <li>Outlet selector: <code>outlet_id</code>, <code>outlet_code</code>, <code>outlet_slug</code></li>
                    <li>Stock utama: <code>product_outlet_stocks</code></li>
                    <li>Fallback stock: <code>products.stock</code></li>
                </ul>
            </section>

            <section class="card span-8">
                <h2 class="section-title">Promo Rule Types</h2>
                <ul class="list">
                    @foreach ($docs['promo_rule_types'] as $promoType)
                        <li><code>{{ $promoType['key'] }}</code> - {{ $promoType['description'] }}</li>
                    @endforeach
                </ul>
            </section>

            <section class="card span-12">
                <h2 class="section-title">Endpoints</h2>
                @foreach ($docs['endpoints'] as $endpoint)
                    <article class="endpoint">
                        <div>
                            <span class="badge">{{ $endpoint['method'] }}</span>
                            <strong>{{ $endpoint['path'] }}</strong>
                        </div>
                        <p class="muted">{{ $endpoint['description'] }}</p>
                        @if (!empty($endpoint['query']))
                            <h3 style="margin: 12px 0 8px;">Query Parameters</h3>
                            <ul class="query-list">
                                @foreach ($endpoint['query'] as $query)
                                    <li><code>{{ $query['name'] }}</code> ({{ $query['type'] }}, {{ $query['required'] ? 'required' : 'optional' }}) - {{ $query['description'] }}</li>
                                @endforeach
                            </ul>
                        @endif
                        @if (!empty($endpoint['example']))
                            <p class="mini muted" style="margin-top: 10px;">Example: <code>{{ $endpoint['example'] }}</code></p>
                        @endif
                    </article>
                @endforeach
            </section>

            <section class="card span-6">
                <h2 class="section-title">Fetch Examples</h2>
                <pre>{{ $docs['examples']['fetch_products'] }}</pre>
                <pre>{{ $docs['examples']['fetch_promos'] }}</pre>
                <pre>{{ $docs['examples']['fetch_highlights'] }}</pre>
            </section>

            <section class="card span-6">
                <h2 class="section-title">Response Notes</h2>
                <ul class="list">
                    @foreach ($docs['response_notes'] as $note)
                        <li>{{ $note }}</li>
                    @endforeach
                </ul>
            </section>

            <section class="card span-6">
                <h2 class="section-title">Sample Product Shape</h2>
                <pre>{{ json_encode($docs['sample_shapes']['product'], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) }}</pre>
            </section>

            <section class="card span-6">
                <h2 class="section-title">Sample Promo Shape</h2>
                <pre>{{ json_encode($docs['sample_shapes']['promo'], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) }}</pre>
            </section>
        </div>
    </div>
</body>
</html>
