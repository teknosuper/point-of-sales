import React, { useState, useEffect, useRef } from "react";
import { IconPhoto } from "@/Utils/icons";
import { resolveProductImageSrc } from "@/Utils/imagePlaceholder";

/**
 * LazyImage - Image component with lazy loading and placeholder
 *
 * @param {string} src - Image source URL
 * @param {string} alt - Alt text
 * @param {string} className - Additional classes
 * @param {string} placeholderClass - Classes for placeholder state
 * @param {React.ReactNode} fallback - Fallback content when no image
 */
export default function LazyImage({
    src,
    fallbackSrc = null,
    alt = "",
    className = "",
    imgClassName = "",
    placeholderClass = "",
    fallback = null,
    ...props
}) {
    const [isLoaded, setIsLoaded] = useState(false);
    const [isInView, setIsInView] = useState(false);
    const [error, setError] = useState(false);
    const [activeSrc, setActiveSrc] = useState(src);
    const imgRef = useRef(null);
    const hasHandledErrorRef = useRef(false);

    useEffect(() => {
        hasHandledErrorRef.current = false;
        setActiveSrc(src);
        setError(false);
        setIsLoaded(false);
    }, [src]);

    useEffect(() => {
        if (!activeSrc) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsInView(true);
                    observer.disconnect();
                }
            },
            {
                rootMargin: "100px", // Start loading 100px before visible
                threshold: 0,
            }
        );

        if (imgRef.current) {
            observer.observe(imgRef.current);
        }

        return () => observer.disconnect();
    }, [activeSrc]);

    const handleLoad = () => {
        setIsLoaded(true);
    };

    const handleError = () => {
        if (hasHandledErrorRef.current && (!fallbackSrc || activeSrc === fallbackSrc)) {
            return;
        }

        if (fallbackSrc && activeSrc !== fallbackSrc) {
            hasHandledErrorRef.current = true;
            setActiveSrc(fallbackSrc);
            return;
        }

        hasHandledErrorRef.current = true;
        setError(true);
        setIsLoaded(true);
    };

    // No source provided
    if (!activeSrc || error) {
        return (
            <div
                ref={imgRef}
                className={`flex items-center justify-center bg-slate-100 dark:bg-slate-800 ${className} ${placeholderClass}`}
                {...props}
            >
                {fallback || <IconPhoto size={24} className="text-slate-400" />}
            </div>
        );
    }

    return (
        <div
            ref={imgRef}
            className={`relative overflow-hidden ${className}`}
            {...props}
        >
            {/* Placeholder / Skeleton */}
            {!isLoaded && (
                <div
                    className={`absolute inset-0 bg-slate-200 dark:bg-slate-700 animate-pulse ${placeholderClass}`}
                />
            )}

            {/* Actual Image (only load when in view) */}
            {isInView && (
                <img
                    src={activeSrc}
                    alt={alt}
                    onLoad={handleLoad}
                    onError={handleError}
                    loading="lazy"
                    decoding="async"
                    className={`w-full h-full object-cover transition-opacity duration-300 ${imgClassName} ${
                        isLoaded ? "opacity-100" : "opacity-0"
                    }`}
                />
            )}
        </div>
    );
}

/**
 * ProductImage - Specialized lazy image for products
 */
export function ProductImage({
    image,
    title = "Product",
    className = "",
    size = "md",
}) {
    const sizes = {
        sm: "w-12 h-12",
        md: "w-16 h-16",
        lg: "w-24 h-24",
        full: "w-full aspect-square",
    };

    const src = resolveProductImageSrc(image, title);

    return (
        <LazyImage
            src={src}
            alt={title}
            className={`rounded-lg ${sizes[size]} ${className}`}
            fallback={
                <div className="w-full h-full flex items-center justify-center">
                    <IconPhoto
                        size={size === "sm" ? 16 : 24}
                        className="text-slate-400"
                    />
                </div>
            }
        />
    );
}

/**
 * CategoryImage - Specialized lazy image for categories
 */
export function CategoryImage({ image, name = "Category", className = "" }) {
    const src = image ? `/storage/categories/${image}` : null;

    return (
        <LazyImage
            src={src}
            alt={name}
            className={`w-full aspect-video rounded-xl ${className}`}
            fallback={<IconPhoto size={32} className="text-slate-400" />}
        />
    );
}
