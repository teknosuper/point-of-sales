export const IMAGE_UPLOAD_MAX_BYTES = 2 * 1024 * 1024;
export const IMAGE_UPLOAD_ACCEPT =
    ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";
export const ALLOWED_IMAGE_MIME_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
];

const loadImageElement = (src) =>
    new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = src;
    });

export const validateImageFile = (
    file,
    {
        maxBytes = IMAGE_UPLOAD_MAX_BYTES,
        allowedMimeTypes = ALLOWED_IMAGE_MIME_TYPES,
    } = {}
) => {
    if (!file) {
        return { ok: true, error: "" };
    }

    if (!allowedMimeTypes.includes(file.type)) {
        return {
            ok: false,
            error: "Format gambar harus JPG, JPEG, PNG, atau WEBP.",
        };
    }

    if (file.size > maxBytes) {
        return {
            ok: false,
            error: "Ukuran gambar maksimal 2MB.",
        };
    }

    return { ok: true, error: "" };
};

export const compressImageFile = async (
    file,
    {
        maxWidth = 1600,
        maxHeight = 1600,
        outputType = "image/webp",
        targetMaxBytes = IMAGE_UPLOAD_MAX_BYTES,
    } = {}
) => {
    if (!file || !ALLOWED_IMAGE_MIME_TYPES.includes(file.type)) {
        return file;
    }

    const objectUrl = URL.createObjectURL(file);

    try {
        const image = await loadImageElement(objectUrl);
        const qualitySteps = [0.86, 0.8, 0.74, 0.68, 0.62, 0.56];
        const scaleSteps = [1, 0.9, 0.8, 0.72, 0.64];
        let bestFile = file;

        for (const scale of scaleSteps) {
            const ratio = Math.min(
                1,
                (maxWidth / image.width || 1) * scale,
                (maxHeight / image.height || 1) * scale
            );
            const targetWidth = Math.max(1, Math.round(image.width * ratio));
            const targetHeight = Math.max(1, Math.round(image.height * ratio));

            const canvas = document.createElement("canvas");
            canvas.width = targetWidth;
            canvas.height = targetHeight;

            const context = canvas.getContext("2d");
            if (!context) {
                return file;
            }

            context.drawImage(image, 0, 0, targetWidth, targetHeight);

            for (const quality of qualitySteps) {
                const blob = await new Promise((resolve) =>
                    canvas.toBlob(resolve, outputType, quality)
                );

                if (!blob) {
                    continue;
                }

                const normalizedName = file.name.replace(
                    /\.(jpe?g|png|webp)$/i,
                    ""
                );
                const candidate = new File(
                    [blob],
                    `${normalizedName || "image"}.webp`,
                    {
                        type: outputType,
                        lastModified: Date.now(),
                    }
                );

                if (candidate.size < bestFile.size) {
                    bestFile = candidate;
                }

                if (candidate.size <= targetMaxBytes) {
                    return candidate;
                }
            }
        }

        return bestFile;
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
};

export const prepareImageUpload = async (
    file,
    {
        maxBytes = IMAGE_UPLOAD_MAX_BYTES,
        allowedMimeTypes = ALLOWED_IMAGE_MIME_TYPES,
        maxWidth = 1600,
        maxHeight = 1600,
    } = {}
) => {
    if (!file) {
        return { ok: true, error: "", file: null };
    }

    if (!allowedMimeTypes.includes(file.type)) {
        return {
            ok: false,
            error: "Format gambar harus JPG, JPEG, PNG, atau WEBP.",
            file: null,
        };
    }

    const processedFile = await compressImageFile(file, {
        maxWidth,
        maxHeight,
        targetMaxBytes: maxBytes,
    });
    const validation = validateImageFile(processedFile, {
        maxBytes,
        allowedMimeTypes,
    });

    if (!validation.ok) {
        return {
            ok: false,
            error:
                processedFile.size > maxBytes
                    ? "Gambar tidak bisa dikompres di bawah 2MB. Pilih file lain."
                    : validation.error,
            file: null,
        };
    }

    return {
        ok: true,
        error: "",
        file: processedFile,
    };
};
