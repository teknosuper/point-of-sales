import LazyImage from "@/Components/Dashboard/LazyImage";
import { getProductImageUrl, getProductThumbUrl } from "@/Utils/imageUrl";
import {
    IconCalendarEvent,
    IconChevronLeft,
    IconChevronRight,
    IconArrowsMaximize,
    IconPhoto,
    IconX,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";

const AUTO_PLAY_MS = 5000;
const REFRESH_INTERVAL = 60 * 1000;

const formatPrice = (value = 0) =>
    Number(value || 0).toLocaleString("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    });

// Label tanggal promo dari schedule backend (`starts_at`/`ends_at` ISO UTC).
function promoDateLabel(slide) {
    if (!slide) return null;

    const starts = slide.starts_at || slide.schedule?.starts_at;
    const ends = slide.ends_at || slide.schedule?.ends_at;

    const fmt = (iso) => {
        if (!iso) return null;
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return null;
        return new Intl.DateTimeFormat("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
        }).format(d);
    };

    const startLabel = fmt(starts);
    const endLabel = fmt(ends);

    if (startLabel && endLabel && startLabel === endLabel) {
        return `Berlaku ${startLabel}`;
    }
    if (startLabel && endLabel) {
        return `${startLabel} – ${endLabel}`;
    }
    if (endLabel) {
        return `Sampai ${endLabel}`;
    }
    if (startLabel) {
        return `Mulai ${startLabel}`;
    }

    if (Array.isArray(slide.schedule?.active_days) && slide.schedule.active_days.length === 7) {
        return "Berlaku setiap hari";
    }
    if (Array.isArray(slide.schedule?.active_days) && slide.schedule.active_days.length > 0) {
        const dayNames = {
            sun: "Minggu", mon: "Senin", tue: "Selasa", wed: "Rabu",
            thu: "Kamis", fri: "Jumat", sat: "Sabtu",
        };
        return `Tiap ${slide.schedule.active_days.map((d) => dayNames[d] || d).join(", ")}`;
    }

    return null;
}

const THEME_MAP = {
    emerald: {
        gradient: "bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700",
        glow: "shadow-emerald-500/30",
        ring: "ring-emerald-300/60",
        badge: "bg-emerald-100 text-emerald-700",
    },
    amber: {
        gradient: "bg-gradient-to-br from-amber-500 via-orange-500 to-amber-700",
        glow: "shadow-amber-500/30",
        ring: "ring-amber-300/60",
        badge: "bg-amber-100 text-amber-700",
    },
    sky: {
        gradient: "bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-700",
        glow: "shadow-sky-500/30",
        ring: "ring-sky-300/60",
        badge: "bg-sky-100 text-sky-700",
    },
    rose: {
        gradient: "bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-700",
        glow: "shadow-rose-500/30",
        ring: "ring-rose-300/60",
        badge: "bg-rose-100 text-rose-700",
    },
};

const fallbackTheme = {
    gradient: "bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-700",
    glow: "shadow-rose-500/30",
    ring: "ring-rose-300/60",
    badge: "bg-rose-100 text-rose-700",
};

// Normalize `display-feed` slides (promo rule rich payload atau fallback produk).
function normalizeSlide(slide) {
    if (!slide) return null;

    const isPromo = Boolean(slide.visual) || Boolean(slide.kind);

    if (isPromo) {
        const pricing = slide.pricing || {};
        const originalPrice = pricing.original_price ?? null;
        const promoPrice = pricing.promo_price ?? null;
        const savingsPercent = pricing.savings_percentage ?? null;

        return {
            id: `promo-${slide.id}`,
            kind: slide.kind,
            headline: slide.visual?.headline || slide.name || "Promo",
            subheadline: slide.visual?.subheadline || slide.name || null,
            pill: slide.visual?.pill || slide.badge?.text || "Promo",
            image: slide.hero_image || slide.highlight_products?.[0]?.image || null,
            theme: {
                key: slide.theme?.key || "rose",
            },
            originalPrice: pricing.original_price ?? null,
            promoPrice,
            savingsPercent,
            visualType: slide.visual?.type || "standard_discount",
            startsAt: slide.starts_at || slide.schedule?.starts_at || null,
            endsAt: slide.ends_at || slide.schedule?.ends_at || null,
            scheduleDays: slide.schedule?.active_days || null,
        };
    }

    const badge = slide.pricing_badge || {};
    const hasPromoPrice =
        badge.promo_price !== null && badge.promo_price !== undefined;
    const originalPrice = badge.base_price ?? null;
    const promoPrice = hasPromoPrice ? badge.promo_price : null;
    const discountPercent =
        originalPrice && promoPrice && promoPrice < originalPrice
            ? Math.round(((originalPrice - promoPrice) / originalPrice) * 100)
            : null;

    return {
        id: `product-${slide.id}`,
        kind: badge.kind || "standard_discount",
        headline: slide.title || slide.name,
        subheadline: badge.detail || badge.label,
        pill: badge.label || "Promo",
        image: slide.image || null,
        theme: {
            key: "rose",
        },
        originalPrice,
        promoPrice,
        discountPercent,
        hasPrice: true,
        originalType: "standard_discount",
    };
}

export default function PromoCarousel({ outlet }) {
    const [slides, setSlides] = useState([]);
    const [loading, setLoading] = useState(true);
    const [index, setIndex] = useState(0);
    const [fullscreen, setFullscreen] = useState(false);
    const [paused, setPaused] = useState(false);

    const viewportRef = useRef(null);
    const touchStartX = useRef(null);

    useEffect(() => {
        const fetchSlides = async () => {
            try {
                const params = new URLSearchParams();
                if (outlet?.code) params.append("outlet_code", outlet.code);
                const response = await fetch(`/api/public/catalog/display-feed?${params.toString()}`);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const payload = await response.json();
                const raw = Array.isArray(payload?.data?.slides) ? payload.data.slides : [];
                setSlides(raw.map(normalizeSlide).filter(Boolean));
                setIndex(0);
            } catch (error) {
                console.error("Failed to fetch promo display feed:", error);
                setSlides([]);
            } finally {
                setLoading(false);
            }
        };

        fetchSlides();
        const id = window.setInterval(fetchSlides, REFRESH_INTERVAL);
        return () => window.clearInterval(id);
    }, [outlet?.code]);

    const total = slides.length;

    // Autoplay — jeda saat kursor hover / sentuh.
    useEffect(() => {
        if (total <= 1 || paused) return;
        const id = window.setInterval(() => setIndex((prev) => (prev + 1) % total), AUTO_PLAY_MS);
        return () => window.clearInterval(id);
    }, [total, paused]);

    const scrollToSlide = (i) => {
        const viewport = viewportRef.current;
        const child = viewport?.children?.[i];
        if (!viewport || !child) return;
        viewport.scrollTo({ left: child.offsetLeft - viewport.offsetLeft, behavior: "smooth" });
    };

    useEffect(() => {
        if (fullscreen) return;
        scrollToSlide(index);
    }, [index, fullscreen]);

    // Tutup fullscreen dengan Escape + kunci scroll body.
    useEffect(() => {
        if (!fullscreen) return;
        const onKey = (e) => e.key === "Escape" && setFullscreen(false);
        window.addEventListener("keydown", onKey);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            window.removeEventListener("keydown", onKey);
            document.body.style.overflow = previousOverflow;
        };
    }, [fullscreen]);

    const next = () => setIndex((prev) => (prev + 1) % total);
    const prev = () => setIndex((prev) => (prev - 1 + total) % total);

    const handleTouchStart = (e) => {
        touchStartX.current = e.touches?.[0]?.clientX ?? null;
    };
    const handleTouchEnd = (e) => {
        if (touchStartX.current === null) return;
        const delta = (e.changedTouches?.[0]?.clientX ?? touchStartX.current) - touchStartX.current;
        if (delta <= -40) next();
        else if (delta >= 40) prev();
        touchStartX.current = null;
    };

    if (loading || total === 0) return null;

    return (
        <>
            {/* ── Shelf: kompak di antara toolbar & grid produk ── */}
            <section className="relative mb-4 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_16px_34px_-24px_rgba(15,23,42,0.35)]">
                <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-rose-50 via-white to-white px-4 py-3">
                    <div className="flex items-center gap-2.5">
                        <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-rose-500 shadow-[0_0_0_4px_rgba(244,63,94,0.15)]" />
                        <h2 className="text-sm font-extrabold tracking-tight text-slate-800">
                            Sedang Promo
                        </h2>
                        <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-extrabold text-white shadow-sm shadow-rose-600/30">
                            {total}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setFullscreen(true)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-slate-900/20 transition hover:bg-slate-700"
                    >
                        <IconArrowsMaximize size={15} />
                        Tampil Layar Penuh
                    </button>
                </div>

                <div
                    ref={viewportRef}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                    onMouseEnter={() => setPaused(true)}
                    onMouseLeave={() => setPaused(false)}
                    className="relative flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-4 pt-1 [&::-webkit-scrollbar]:hidden"
                >
                    {slides.map((slide) => {
                        const theme = THEME_MAP[slide.theme?.key] || fallbackTheme;
                        const hasDiscount = slide.originalPrice && slide.promoPrice && slide.promoPrice < slide.originalPrice;
                        const pct =
                            slide.discountPercent ??
                            (hasDiscount
                                ? Math.round(
                                      ((slide.originalPrice - slide.promoPrice) / slide.originalPrice) * 100
                                  )
                                : null);

                        return (
                            <div
                                key={slide.id}
                                className="group relative h-32 w-52 shrink-0 snap-center overflow-hidden rounded-2xl bg-slate-900 shadow-lg shadow-black/10 ring-1 ring-white/10 transition duration-300 hover:-translate-y-0.5 hover:shadow-xl"
                            >
                                {/* Gambar + overlay */}
                                {slide.image ? (
                                    <LazyImage
                                        src={getProductThumbUrl(slide.image, slide.headline)}
                                        fallbackSrc={getProductImageUrl(slide.image, slide.headline)}
                                        alt={slide.headline}
                                        className="absolute inset-0 h-full w-full opacity-80 transition duration-500 group-hover:scale-105 group-hover:opacity-100"
                                        imgClassName="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                                        <IconPhoto size={30} className="text-white/30" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/5" />

                                {/* Disk kalangan besar */}
                                {pct ? (
                                    <span className="absolute right-2.5 top-2.5 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-2.5 py-1 text-sm font-black text-white shadow-lg shadow-rose-500/40 ring-2 ring-white/30">
                                        -{pct}%
                                    </span>
                                ) : (
                                    <span className="absolute right-2.5 top-2.5 rounded-full bg-white/95 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-700 shadow">
                                        {slide.pill}
                                    </span>
                                )}

                                {/* Konten bawah */}
                                <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-3">
                                    <span className="w-fit rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white/90 backdrop-blur-sm ring-1 ring-white/20">
                                        {slide.pill}
                                    </span>
                                    <p className="line-clamp-1 text-sm font-extrabold text-white drop-shadow">
                                        {slide.headline}
                                    </p>
                                    {slide.promoPrice && slide.kind !== "buy_x_get_y" ? (
                                        <div className="flex items-baseline gap-2">
                                            {hasDiscount ? (
                                                <span className="text-xs text-white/55 line-through">
                                                    {formatPrice(slide.originalPrice)}
                                                </span>
                                            ) : null}
                                            <span className="text-sm font-black text-white">
                                                {formatPrice(slide.promoPrice)}
                                            </span>
                                        </div>
                                    ) : null}
                                    {slide.kind === "buy_x_get_y" || slide.visualType === "buy_get" ? (
                                        <p className="line-clamp-1 text-[11px] font-semibold text-emerald-300">
                                            {slide.subheadline}
                                        </p>
                                    ) : null}
                                    {promoDateLabel(slide) ? (
                                        <p className="flex items-center gap-1 text-[10px] font-medium text-white/65">
                                            <IconCalendarEvent size={11} className="shrink-0" />
                                            {promoDateLabel(slide)}
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* ── Fullscreen showcase ── */}
            {fullscreen ? (
                <div className="fixed inset-0 z-[120] flex flex-col bg-slate-950/95 backdrop-blur-sm">
                    <div className="flex items-center justify-between px-4 py-3">
                        <span className="text-sm font-semibold text-white">
                            Sedang Promo — {index + 1}/{total}
                        </span>
                        <button
                            type="button"
                            onClick={() => setFullscreen(false)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                            aria-label="Tutup layar penuh"
                        >
                            <IconX size={20} />
                        </button>
                    </div>

                    <div className="relative min-h-0 flex-1 overflow-hidden">
                        <div
                            className="flex h-full w-full transition-transform duration-600 ease-out"
                            style={{ transform: `translateX(-${index * 100}%)` }}
                        >
                            {slides.map((slide) => {
                                const theme = THEME_MAP[slide.theme?.key] || fallbackTheme;
                                const hasDiscount =
                                    slide.originalPrice && slide.promoPrice && slide.promoPrice < slide.originalPrice;
                                const pct =
                                    slide.discountPercent ??
                                    (hasDiscount
                                        ? Math.round(
                                              ((slide.originalPrice - slide.promoPrice) / slide.originalPrice) * 100
                                          )
                                        : null);

                                return (
                                    <div
                                        key={slide.id}
                                        className="relative flex h-full w-full shrink-0 items-center overflow-hidden bg-slate-950"
                                    >
                                        {/* Background image full-bleed */}
                                        {slide.image ? (
                                            <LazyImage
                                                src={getProductImageUrl(slide.image, slide.headline)}
                                                fallbackSrc={getProductImageUrl(slide.image, slide.headline)}
                                                alt={slide.headline}
                                                className="absolute inset-0 h-full w-full"
                                                imgClassName="h-full w-full object-cover"
                                            />
                                        ) : null}
                                        {/* Gradient theme dari kiri, buram ke kanan utk teks */}
                                        <div
                                            className="absolute inset-0 opacity-90"
                                            style={{ background: slide.theme?.background }}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/75 to-slate-950/40" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/30 to-transparent" />
                                        {/* Dekorasi soft */}
                                        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
                                        <div className="pointer-events-none absolute -bottom-20 -left-10 h-80 w-80 rounded-full bg-black/25 blur-3xl" />

                                        {/* Konten */}
                                        <div className="relative z-10 mx-auto w-full max-w-4xl px-5 py-6 sm:px-8 sm:py-10">
                                            {/* Pill + discount */}
                                            <div className="flex flex-wrap items-end gap-3">
                                                <span className={`inline-flex items-center rounded-full px-4 py-1.5 text-xs font-extrabold uppercase tracking-[0.16em] text-white ring-2 ring-white/30 ${theme.gradient}`}>
                                                    {slide.pill}
                                                </span>
                                                {pct ? (
                                                    <span className="inline-flex items-center rounded-2xl bg-white px-4 py-1.5 text-2xl font-black text-rose-600 shadow-xl shadow-black/30">
                                                        Diskon -{pct}%
                                                    </span>
                                                ) : null}
                                            </div>

                                            <h2 className="mt-4 max-w-xl text-4xl font-black leading-[1.05] tracking-tight text-white drop-shadow-lg sm:text-6xl">
                                                {slide.headline}
                                            </h2>
                                            {slide.subheadline ? (
                                                <p className="mt-3 max-w-lg text-sm font-medium leading-relaxed text-white/85 sm:text-lg">
                                                    {slide.subheadline}
                                                </p>
                                            ) : null}

                                            {/* Harga */}
                                            {slide.promoPrice ? (
                                                <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-3xl border border-white/15 bg-black/30 px-5 py-4 backdrop-blur-md">
                                                    {hasDiscount ? (
                                                        <span className="text-xl text-white/55 line-through sm:text-2xl">
                                                            {formatPrice(slide.originalPrice)}
                                                        </span>
                                                    ) : null}
                                                    <span className="text-3xl font-black text-white sm:text-5xl">
                                                        {formatPrice(slide.promoPrice)}
                                                    </span>
                                                    {pct ? (
                                                        <span className="rounded-full bg-emerald-400 px-3 py-1 text-xs font-black text-emerald-950">
                                                            Hemat {pct}%
                                                        </span>
                                                    ) : null}
                                                </div>
                                            ) : null}

                                            {/* Tanggal promo */}
                                            {promoDateLabel(slide) ? (
                                                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/25 px-4 py-2 text-sm font-semibold text-white/90 backdrop-blur-md">
                                                    <IconCalendarEvent size={16} className="text-white/70" />
                                                    {promoDateLabel(slide)}
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <button
                            type="button"
                            onClick={prev}
                            aria-label="Promo sebelumnya"
                            className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white shadow-lg backdrop-blur-sm transition hover:bg-white/20"
                        >
                            <IconChevronLeft size={26} />
                        </button>
                        <button
                            type="button"
                            onClick={next}
                            aria-label="Promo berikutnya"
                            className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white shadow-lg backdrop-blur-sm transition hover:bg-white/20"
                        >
                            <IconChevronRight size={26} />
                        </button>
                        <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
                            {slides.map((s, i) => (
                                <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => setIndex(i)}
                                    aria-label={`Promo ${i + 1}`}
                                    className={`h-2 rounded-full transition-all ${
                                        i === index ? "w-6 bg-white" : "w-2 bg-white/40 hover:bg-white/70"
                                    }`}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}