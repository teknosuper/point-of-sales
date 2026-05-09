export function productPlaceholderDataUri(label = "Produk") {
    const safeLabel = String(label || "Produk").trim().slice(0, 18);
    const svg = `
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
  <text x="320" y="490" text-anchor="middle" fill="#334155" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700">${safeLabel}</text>
</svg>`;

    return `data:image/svg+xml;base64,${btoa(
        unescape(encodeURIComponent(svg))
    )}`;
}

export function categoryPlaceholderDataUri(label = "Kategori") {
    const safeLabel = String(label || "Kategori").trim().slice(0, 18);
    const svg = `
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
  <text x="480" y="522" text-anchor="middle" fill="#334155" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700">${safeLabel}</text>
</svg>`;

    return `data:image/svg+xml;base64,${btoa(
        unescape(encodeURIComponent(svg))
    )}`;
}

export function avatarPlaceholderDataUri(label = "User") {
    const safeLabel = String(label || "User").trim();
    const initial = safeLabel.charAt(0).toUpperCase() || "U";
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320" fill="none">
  <defs>
    <linearGradient id="bg" x1="24" y1="16" x2="296" y2="304" gradientUnits="userSpaceOnUse">
      <stop stop-color="#DBEAFE"/>
      <stop offset="1" stop-color="#E9D5FF"/>
    </linearGradient>
  </defs>
  <rect width="320" height="320" rx="160" fill="url(#bg)"/>
  <circle cx="160" cy="126" r="54" fill="#ffffff" fill-opacity="0.92"/>
  <path d="M76 274C90.1491 220.23 134.257 188 160 188C185.743 188 229.851 220.23 244 274H76Z" fill="#ffffff" fill-opacity="0.92"/>
  <text x="160" y="184" text-anchor="middle" fill="#4F46E5" font-family="Arial, Helvetica, sans-serif" font-size="72" font-weight="700">${initial}</text>
</svg>`;

    return `data:image/svg+xml;base64,${btoa(
        unescape(encodeURIComponent(svg))
    )}`;
}

export function brandPlaceholderDataUri(label = "Toko") {
    const safeLabel = String(label || "Toko").trim();
    const initial = safeLabel.charAt(0).toUpperCase() || "T";
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320" fill="none">
  <defs>
    <linearGradient id="bg" x1="24" y1="24" x2="296" y2="296" gradientUnits="userSpaceOnUse">
      <stop stop-color="#4F46E5"/>
      <stop offset="1" stop-color="#0EA5E9"/>
    </linearGradient>
  </defs>
  <rect width="320" height="320" rx="56" fill="url(#bg)"/>
  <rect x="58" y="66" width="204" height="188" rx="28" fill="white" fill-opacity="0.14"/>
  <path d="M94 120H226V142H94V120ZM110 164H210V186H110V164ZM128 208H192V230H128V208Z" fill="white" fill-opacity="0.9"/>
  <text x="160" y="286" text-anchor="middle" fill="white" font-family="Arial, Helvetica, sans-serif" font-size="72" font-weight="700">${initial}</text>
</svg>`;

    return `data:image/svg+xml;base64,${btoa(
        unescape(encodeURIComponent(svg))
    )}`;
}

export function bankPlaceholderDataUri(label = "Bank") {
    const safeLabel = String(label || "Bank").trim();
    const initial = safeLabel.charAt(0).toUpperCase() || "B";
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200" fill="none">
  <rect width="320" height="200" rx="28" fill="#F8FAFC"/>
  <rect x="18" y="18" width="284" height="164" rx="22" fill="#E2E8F0"/>
  <path d="M72 92L160 50L248 92V106H72V92Z" fill="#475569"/>
  <path d="M94 116H114V144H94V116ZM150 116H170V144H150V116ZM206 116H226V144H206V116Z" fill="#64748B"/>
  <path d="M70 150H250V162H70V150Z" fill="#475569"/>
  <text x="160" y="182" text-anchor="middle" fill="#334155" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="700">${initial}</text>
</svg>`;

    return `data:image/svg+xml;base64,${btoa(
        unescape(encodeURIComponent(svg))
    )}`;
}

export function setFallbackImage(event, fallbackSrc) {
    if (!event?.currentTarget || !fallbackSrc) {
        return;
    }

    event.currentTarget.onerror = null;
    event.currentTarget.src = fallbackSrc;
}

export function resolveProductImageSrc(image, title = "Produk") {
    if (!image) {
        return productPlaceholderDataUri(title);
    }

    const normalized = String(image).trim();
    const lower = normalized.toLowerCase();

    if (["default.jpg", "default.jpeg", "default.png"].includes(lower)) {
        return productPlaceholderDataUri(title);
    }

    if (
        normalized.startsWith("data:") ||
        normalized.startsWith("http://") ||
        normalized.startsWith("https://") ||
        normalized.startsWith("/storage/") ||
        normalized.startsWith("/assets/") ||
        normalized.startsWith("/media/")
    ) {
        return normalized;
    }

    return `/storage/products/${normalized}`;
}

export function resolveCategoryImageSrc(image, name = "Kategori") {
    if (!image) {
        return categoryPlaceholderDataUri(name);
    }

    const normalized = String(image).trim();
    const lower = normalized.toLowerCase();

    if (["default.jpg", "default.jpeg", "default.png"].includes(lower)) {
        return categoryPlaceholderDataUri(name);
    }

    if (
        normalized.startsWith("data:") ||
        normalized.startsWith("http://") ||
        normalized.startsWith("https://") ||
        normalized.startsWith("/storage/") ||
        normalized.startsWith("/assets/") ||
        normalized.startsWith("/media/")
    ) {
        return normalized;
    }

    return `/storage/categories/${normalized}`;
}
