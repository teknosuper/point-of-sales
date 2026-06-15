<svg xmlns="http://www.w3.org/2000/svg" width="576" height="384" viewBox="0 0 576 384" role="img" aria-label="QR Meja {{ $table['name'] ?? 'Meja' }}">
    <defs>
        <linearGradient id="leftBg" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stop-color="#0f172a" />
            <stop offset="48%" stop-color="#0f3b68" />
            <stop offset="100%" stop-color="#0b7ea1" />
        </linearGradient>
        <style>
            .title { font: 700 13px Arial, sans-serif; letter-spacing: 3px; text-transform: uppercase; fill: #bae6fd; }
            .code { font: 700 34px Arial, sans-serif; fill: #ffffff; }
            .name { font: 400 16px Arial, sans-serif; fill: #cbd5e1; }
            .badge { font: 700 12px Arial, sans-serif; fill: #ffffff; }
            .section { font: 700 12px Arial, sans-serif; letter-spacing: 2px; text-transform: uppercase; fill: #0f172a; }
            .stepNum { font: 700 12px Arial, sans-serif; fill: #ffffff; text-anchor: middle; dominant-baseline: middle; }
            .stepTitle { font: 700 14px Arial, sans-serif; fill: #0f172a; }
            .stepDesc { font: 400 11px Arial, sans-serif; fill: #64748b; }
            .footer { font: 700 10px Arial, sans-serif; letter-spacing: 2px; text-transform: uppercase; fill: #047857; }
        </style>
    </defs>
    <rect width="576" height="384" rx="28" fill="#ffffff" />
    <rect x="0" y="0" width="288" height="384" rx="28" fill="url(#leftBg)" />
    <text x="144" y="34" text-anchor="middle" class="title">SELF ORDER</text>
    <text x="144" y="78" text-anchor="middle" class="code">{{ $table['code'] ?? $table['name'] ?? 'Meja' }}</text>
    <text x="144" y="102" text-anchor="middle" class="name">{{ $table['name'] ?? 'Meja' }}</text>
    <rect x="20" y="118" width="248" height="188" rx="16" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" />
    <image href="{{ $qrImageDataUrl }}" x="32" y="130" width="224" height="164" preserveAspectRatio="xMidYMid meet" />
    <rect x="20" y="322" rx="999" ry="999" width="96" height="28" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.15)" />
    <text x="68" y="340" text-anchor="middle" class="badge">{{ $outlet['name'] ?? 'Outlet' }}</text>
    <rect x="126" y="322" rx="999" ry="999" width="72" height="28" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.15)" />
    <text x="162" y="340" text-anchor="middle" class="badge">{{ (int) ($table['capacity'] ?? 0) }} kursi</text>
    <circle cx="314" cy="29" r="12" fill="#020617" />
    <text x="314" y="33" text-anchor="middle" style="font:700 13px Arial, sans-serif; fill:#ffffff;">i</text>
    <text x="336" y="33" class="section">PANDUAN ORDER</text>
    <line x1="304" y1="47" x2="556" y2="47" stroke="#e2e8f0" />
    @foreach ($steps as $index => $step)
        @php($y = 60 + ($index * 47))
        <rect x="304" y="{{ $y }}" width="252" height="39" rx="12" fill="#f8fafc" stroke="#f1f5f9" />
        <circle cx="322" cy="{{ $y + 19.5 }}" r="10" fill="#020617" />
        <text x="322" y="{{ $y + 21 }}" class="stepNum">{{ $step['num'] }}</text>
        <text x="340" y="{{ $y + 16 }}" class="stepTitle">{{ $step['title'] }}</text>
        <text x="340" y="{{ $y + 31 }}" class="stepDesc">{{ $step['desc'] }}</text>
    @endforeach
    <rect x="304" y="337" width="252" height="27" rx="10" fill="#ecfdf5" />
    <text x="430" y="354" text-anchor="middle" class="footer">NIKMATI PESANAN ANDA!</text>
</svg>
