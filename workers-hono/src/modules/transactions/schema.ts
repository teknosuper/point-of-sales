import type { CheckoutInput, CheckoutItemInput } from "./dto";

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function validateItem(input: unknown, index: number): CheckoutItemInput {
    if (!input || typeof input !== "object") {
        throw new Error(`items[${index}] harus berupa object.`);
    }

    const candidate = input as Record<string, unknown>;

    if (!isNonEmptyString(candidate.productId)) {
        throw new Error(`items[${index}].productId wajib diisi.`);
    }

    if (!isNonEmptyString(candidate.productName)) {
        throw new Error(`items[${index}].productName wajib diisi.`);
    }

    const quantity = Number(candidate.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new Error(`items[${index}].quantity harus bilangan bulat > 0.`);
    }

    return {
        productId: candidate.productId.trim(),
        productName: candidate.productName.trim(),
        quantity,
        notes:
            typeof candidate.notes === "string" && candidate.notes.trim()
                ? candidate.notes.trim()
                : undefined,
    };
}

export function validateCheckoutInput(payload: unknown): CheckoutInput {
    if (!payload || typeof payload !== "object") {
        throw new Error("Payload checkout tidak valid.");
    }

    const candidate = payload as Record<string, unknown>;

    if (!isNonEmptyString(candidate.outletId)) {
        throw new Error("outletId wajib diisi.");
    }

    if (!isNonEmptyString(candidate.cashierId)) {
        throw new Error("cashierId wajib diisi.");
    }

    if (!Array.isArray(candidate.items) || candidate.items.length === 0) {
        throw new Error("items wajib diisi minimal 1 item.");
    }

    return {
        outletId: candidate.outletId.trim(),
        cashierId: candidate.cashierId.trim(),
        customerName:
            typeof candidate.customerName === "string" &&
            candidate.customerName.trim()
                ? candidate.customerName.trim()
                : undefined,
        items: candidate.items.map(validateItem),
    };
}
