<?php

namespace App\Support;

class ImagePlaceholder
{
    public static function product(?string $label = null): string
    {
        $safeLabel = trim((string) ($label ?: 'Produk'));
        $safeLabel = mb_substr($safeLabel, 0, 18);

        $svg = <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640" fill="none">
  <defs>
    <linearGradient id="bg" x1="64" y1="48" x2="576" y2="592" gradientUnits="userSpaceOnUse">
      <stop stop-color="#E0F2FE"/>
      <stop offset="1" stop-color="#DBEAFE"/>
    </linearGradient>
  </defs>
  <rect width="640" height="640" rx="56" fill="url(#bg)"/>
  <rect x="96" y="96" width="448" height="448" rx="40" fill="#ffffff" fill-opacity="0.88"/>
  <path d="M232 240C232 218.909 249.909 201 271 201H369C390.091 201 408 218.909 408 240V264H432C448.569 264 462 277.431 462 294V397C462 413.569 448.569 427 432 427H208C191.431 427 178 413.569 178 397V294C178 277.431 191.431 264 208 264H232V240ZM271 225C263.268 225 257 231.268 257 239V264H383V239C383 231.268 376.732 225 369 225H271Z" fill="#0F172A" fill-opacity="0.12"/>
  <circle cx="246" cy="336" r="34" fill="#38BDF8" fill-opacity="0.28"/>
  <path d="M223 392L286 326L337 377L375 340L426 392H223Z" fill="#2563EB" fill-opacity="0.25"/>
  <text x="320" y="490" text-anchor="middle" fill="#334155" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700">{$safeLabel}</text>
</svg>
SVG;

        return 'data:image/svg+xml;base64,'.base64_encode($svg);
    }

    public static function category(?string $label = null): string
    {
        $safeLabel = trim((string) ($label ?: 'Kategori'));
        $safeLabel = mb_substr($safeLabel, 0, 18);

        $svg = <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640" fill="none">
  <defs>
    <linearGradient id="bg" x1="80" y1="52" x2="860" y2="588" gradientUnits="userSpaceOnUse">
      <stop stop-color="#EDE9FE"/>
      <stop offset="1" stop-color="#DBEAFE"/>
    </linearGradient>
  </defs>
  <rect width="960" height="640" rx="48" fill="url(#bg)"/>
  <rect x="84" y="84" width="792" height="472" rx="36" fill="#ffffff" fill-opacity="0.86"/>
  <path d="M284 233C284 211.909 301.909 194 323 194H419L451 226H637C658.091 226 676 243.909 676 265V407C676 428.091 658.091 446 637 446H323C301.909 446 284 428.091 284 407V233Z" fill="#0F172A" fill-opacity="0.12"/>
  <circle cx="376" cy="305" r="34" fill="#8B5CF6" fill-opacity="0.22"/>
  <path d="M336 404L421 322L485 378L544 338L624 404H336Z" fill="#2563EB" fill-opacity="0.24"/>
  <text x="480" y="522" text-anchor="middle" fill="#334155" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700">{$safeLabel}</text>
</svg>
SVG;

        return 'data:image/svg+xml;base64,'.base64_encode($svg);
    }
}
