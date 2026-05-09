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

/**
 * Get product image URL
 * @param {string} image - Product image
 * @param {string} title - Product title for placeholder label
 * @returns {string|null}
 */
export function getProductImageUrl(image, title = "Produk") {
    return resolveProductImageSrc(image, title);
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

export default { getImageUrl, getProductImageUrl, getCategoryImageUrl };
