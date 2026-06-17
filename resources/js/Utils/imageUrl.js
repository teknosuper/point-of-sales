import {
    resolveCategoryImageSrc,
    resolveProductImageSrc,
} from "@/Utils/imagePlaceholder";

/**
 * Get proper image URL - handles both full URLs and filenames
 * @param {string} image - Image path (can be filename or full URL)
 * @param {string} folder - Storage folder (products, categories, etc)
 * @returns {string|null} - Proper image URL or null
 */
export function getImageUrl(image, folder = "products") {
    if (!image) return null;

    // If already a full URL, return as-is
    if (
        image.startsWith("http://") ||
        image.startsWith("https://") ||
        image.startsWith("/storage/")
    ) {
        return image;
    }

    // Otherwise, prepend storage path
    return `/storage/${folder}/${image}`;
}

export function getImageVariantUrl(image, folder = "products", variant = "thumbs") {
    const original = getImageUrl(image, folder);
    if (!original || original.startsWith("data:")) {
        return original;
    }

    if (
        original.startsWith("http://") ||
        original.startsWith("https://")
    ) {
        try {
            const url = new URL(original);
            url.pathname = deriveVariantPath(url.pathname, folder, variant);
            return url.toString();
        } catch {
            return original;
        }
    }

    return deriveVariantPath(original, folder, variant);
}

function deriveVariantPath(path, folder, variant) {
    const normalizedFolder = String(folder || "products").replace(/^\/+|\/+$/g, "");
    const normalizedVariant = String(variant || "thumbs").replace(/^\/+|\/+$/g, "");
    const marker = `/storage/${normalizedFolder}/`;

    if (!path.startsWith(marker)) {
        return path;
    }

    const remainder = path.slice(marker.length);
    if (remainder.startsWith(`${normalizedVariant}/`)) {
        return path;
    }

    return `${marker}${normalizedVariant}/${remainder}`;
}

/**
 * Get product image URL
 * @param {string} image - Product image
 * @param {string} title - Product title for placeholder label
 * @returns {string|null}
 */
export function getProductImageUrl(image, title = "Produk") {
    return resolveProductImageSrc(image, title);
}

export function getProductThumbUrl(image, title = "Produk") {
    const resolved = resolveProductImageSrc(image, title);
    if (!resolved || resolved.startsWith("data:")) {
        return resolved;
    }

    return getImageVariantUrl(resolved, "products", "thumbs");
}

/**
 * Get category image URL
 * @param {string} image - Category image
 * @param {string} name - Category name for placeholder label
 * @returns {string|null}
 */
export function getCategoryImageUrl(image, name = "Kategori") {
    return resolveCategoryImageSrc(image, name);
}

export default {
    getImageUrl,
    getImageVariantUrl,
    getProductImageUrl,
    getProductThumbUrl,
    getCategoryImageUrl,
};
