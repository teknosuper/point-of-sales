<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>QR Meja {{ $table['name'] ?? 'Meja' }}</title>
    <style>
        @page { margin: 0; }
        html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            background: #ffffff;
        }
        .page {
            width: 432pt;
            height: 288pt;
            overflow: hidden;
        }
        .page img {
            display: block;
            width: 432pt;
            height: 288pt;
        }
    </style>
</head>
<body>
    <div class="page">
        <img src="{{ $svgDataUrl }}" alt="QR Meja {{ $table['name'] ?? 'Meja' }}">
    </div>
</body>
</html>
