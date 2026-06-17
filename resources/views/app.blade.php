<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">

<head>
    @php
        $path = '/'.ltrim(request()->path(), '/');
        $isMenuPwa = request()->is('daftarmenu');
        $isDashboardPwa = request()->is('dashboard') || request()->is('dashboard/*');

        $pwaConfig = $isMenuPwa
            ? [
                'kind' => 'menu',
                'name' => 'GTC Menu',
                'theme_color' => '#0f172a',
                'apple_title' => 'GTC Menu',
                'manifest' => '/menu-manifest.webmanifest',
                'icon' => '/menu-pwa-icon.svg',
                'apple_icon' => '/menu-apple-touch-icon.svg',
                'sw' => '/menu-sw.js',
                'scope' => '/daftarmenu',
                'splash_title' => 'Menyiapkan buku menu',
                'splash_description' => 'Memuat katalog, promo, dan cache menu terbaru.',
            ]
            : ($isDashboardPwa
                ? [
                    'kind' => 'dashboard',
                    'name' => 'GTC KASIR',
                    'theme_color' => '#4f46e5',
                    'apple_title' => 'GTC KASIR',
                    'manifest' => '/dashboard-manifest.webmanifest',
                    'icon' => '/pwa-icon.svg',
                    'apple_icon' => '/apple-touch-icon.svg',
                    'sw' => '/dashboard-sw.js',
                    'scope' => '/dashboard',
                    'splash_title' => 'Menyiapkan workspace',
                    'splash_description' => 'Memuat aplikasi, sesi perangkat, dan komponen kerja utama.',
                ]
                : null);
    @endphp
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
    <meta name="theme-color" content="{{ $pwaConfig['theme_color'] ?? '#4f46e5' }}">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <meta name="apple-mobile-web-app-title" content="{{ $pwaConfig['apple_title'] ?? 'GTC KASIR' }}">
    @if ($pwaConfig)
        <link rel="manifest" href="{{ $pwaConfig['manifest'] }}">
        <link rel="icon" type="image/svg+xml" href="{{ $pwaConfig['icon'] }}">
        <link rel="apple-touch-icon" href="{{ $pwaConfig['apple_icon'] }}">
        <meta name="x-pwa-scope" content="{{ $pwaConfig['scope'] }}">
    @endif

    <title inertia>{{ config('app.name', 'Laravel') }}</title>

    <!-- Fonts - Preconnect for performance -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        rel="stylesheet">

    <!-- Scripts -->
    @routes
    @viteReactRefresh
    @vite('resources/js/app.jsx')
    @inertiaHead
    <style>
        body.dark {
            background-color: rgb(2 6 23);
        }

        body.light {
            background-color: rgb(248 250 252);
        }
    </style>
</head>

<body class="font-sans antialiased bg-slate-50 transition-colors duration-200" onload="setInitialTheme()">

    @inertia
    <script>
        window.__PWA_CONFIG = @json($pwaConfig);

        function setInitialTheme() {
            const darkMode = localStorage.getItem('darkMode') === 'true';
            if (darkMode) {
                document.body.classList.add('dark');
                document.body.classList.remove('light');
            } else {
                document.body.classList.add('light');
                document.body.classList.remove('dark');
            }
        }
    </script>
</body>

</html>
