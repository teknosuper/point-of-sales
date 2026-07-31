// Helper murni (pure functions) untuk POS Transactions.
// Dipisah dari Pages/Dashboard/Transactions/Index.jsx agar file halaman tidak
// membawa definisi ini setiap kali dibaca/diedit (hemat token).

export const formatPrice = (value = 0) =>
    Number(value || 0).toLocaleString("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    });

export const normalizeModifierGroupName = (value) => {
    const normalized = String(value || "").trim();

    return normalized !== "" ? normalized : "Topping";
};

export const formatApiErrorMessage = (error, fallbackMessage) => {
    const responseData = error?.response?.data;
    const baseMessage =
        responseData?.message || error?.message || fallbackMessage;
    const detailMessage =
        responseData?.details ||
        responseData?.error?.message ||
        responseData?.error;

    if (
        detailMessage &&
        typeof detailMessage === "string" &&
        detailMessage !== baseMessage
    ) {
        return `${baseMessage}\n${detailMessage}`;
    }

    return baseMessage;
};

export const formatInertiaErrorBag = (errors, fallbackMessage) => {
    if (!errors || typeof errors !== "object") {
        return fallbackMessage;
    }

    const messages = Object.values(errors)
        .flatMap((value) =>
            Array.isArray(value) ? value : value ? [value] : []
        )
        .filter(Boolean);

    if (messages.length === 0) {
        return fallbackMessage;
    }

    return messages.join("\n");
};

export const decodeEscPosPreviewText = (rawBase64) => {
    if (!rawBase64 || typeof window === "undefined" || typeof window.atob !== "function") {
        return "";
    }

    try {
        const binary = window.atob(rawBase64);
        let output = "";

        for (let index = 0; index < binary.length; index += 1) {
            const byte = binary.charCodeAt(index);

            if (byte === 0x1b) {
                const command = binary.charCodeAt(index + 1);

                if (command === 0x40 || command === 0x61 || command === 0x4d) {
                    index += 2;
                    continue;
                }

                index += 1;
                continue;
            }

            if (
                byte === 0x1d &&
                binary.charCodeAt(index + 1) === 0x28 &&
                binary.charCodeAt(index + 2) === 0x6b
            ) {
                const pL = binary.charCodeAt(index + 3) || 0;
                const pH = binary.charCodeAt(index + 4) || 0;
                const dataLength = pL + pH * 256;

                index += 4 + dataLength;
                continue;
            }

            if (byte === 0x1d) {
                const command = binary.charCodeAt(index + 1);

                if (command === 0x56) {
                    break;
                }

                index += 1;
                continue;
            }

            if (byte === 0x0a) {
                output += "\n";
                continue;
            }

            if (byte === 0x0d || byte === 0x09) {
                continue;
            }

            if (byte >= 0x20 && byte <= 0x7e) {
                output += binary[index];
            }
        }

        return output
            .replace(/\n{3,}/g, "\n\n")
            .trim();
    } catch (error) {
        return "";
    }
};

export const buildParkingTicketPreviewBase64 = ({
    storeName = "",
    storeAddress = "",
    ticketCode = "PARK-0001",
    printedAt = "",
    printedBy = "",
} = {}) => {
    if (typeof window === "undefined" || typeof window.btoa !== "function") {
        return "";
    }

    const header = [storeName, storeAddress].filter(Boolean).join(" - ");
    const footer = [printedAt, printedBy].filter(Boolean).join(" • ");
    const lines = [
        "\x1B\x40",
        "\x1B\x61\x01",
        header,
        "\x1B\x45\x01",
        `KARCIS PARKIR ${ticketCode}`,
        "\x1B\x45\x00",
        "--------------------------------",
        "\x1B\x61\x00",
        "PLAT No. ____ ____ ______ MOBIL / MOTOR",
        "--------------------------------",
        "\x1B\x61\x01",
        "........................",
        "--------------------------------",
        footer,
        "\x1B\x64\x02",
        "\x1D\x56\x00",
    ].filter(Boolean);

    const source = lines.join("\n");
    const encoded = new TextEncoder().encode(source);
    let binary = "";

    encoded.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });

    return window.btoa(binary);
};

export const resolveFreshnessMeta = (timestamp) => {
    if (!timestamp) {
        return {
            label: "belum ada",
            className:
                "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
        };
    }

    const ageMinutes = Math.max(
        0,
        Math.round((Date.now() - new Date(timestamp).getTime()) / 60000)
    );

    if (ageMinutes <= 5) {
        return {
            label: "baru",
            className:
                "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
        };
    }

    if (ageMinutes <= 30) {
        return {
            label: "perlu cek",
            className:
                "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
        };
    }

    return {
        label: "lama",
        className:
            "bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300",
    };
};

export const WALK_IN_CUSTOMER = {
    id: "walk_in",
    name: "Pelanggan Umum",
    no_telp: "",
    member_code: "",
    is_loyalty_member: false,
    is_walk_in: true,
    loyalty_tier: null,
    loyalty_points: 0,
};

export const resolvedProductDisplayPrice = (product) =>
    Number(product?.pricing_badge?.promo_price ?? product?.sell_price ?? 0);

export const buildCartConsistencySignature = (items = []) =>
    (Array.isArray(items) ? items : [])
        .map((item) => {
            const modifierSignature = (item.modifiers || [])
                .map((modifier) =>
                    [
                        Number(modifier.product_modifier_option_id || 0),
                        String(modifier.name || "").trim(),
                        Number(modifier.qty || 0),
                        Number(modifier.unit_price || 0),
                        Number(modifier.base_price || 0),
                        Number(modifier.markup_price || 0),
                    ].join(":")
                )
                .sort()
                .join("|");

            return [
                Number(item.product_id || 0),
                Number(item.tenant_outlet_id || 0),
                Number(item.qty || 0),
                Number(item.price || 0),
                String(item.notes || "").trim(),
                String(item.promo_reward_meta?.rule_name || ""),
                String(item.promo_reward_meta?.reward_label || ""),
                modifierSignature,
            ].join("::");
        })
        .sort()
        .join("##");
