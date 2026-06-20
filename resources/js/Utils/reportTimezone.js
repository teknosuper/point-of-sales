export const resolveReportTimezone = (reportMeta = {}) => ({
    timezone: reportMeta?.timezone || "Asia/Jakarta",
    timezoneLabel: reportMeta?.timezone_label || "GMT+7",
});

export const toTimeZoneDateInput = (date, timeZone) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);

    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;

    return [year, month, day].filter(Boolean).join("-");
};

export const shiftReportDateInput = (dateInput, days) => {
    if (!dateInput) {
        return "";
    }

    const [year, month, day] = dateInput.split("-").map(Number);

    if (!year || !month || !day) {
        return dateInput;
    }

    const shifted = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));

    return [
        shifted.getUTCFullYear(),
        String(shifted.getUTCMonth() + 1).padStart(2, "0"),
        String(shifted.getUTCDate()).padStart(2, "0"),
    ].join("-");
};

export const subtractOneMonthFromReportDateInput = (dateInput) => {
    if (!dateInput) {
        return "";
    }

    const [year, month, day] = dateInput.split("-").map(Number);

    if (!year || !month || !day) {
        return dateInput;
    }

    const shifted = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    shifted.setUTCMonth(shifted.getUTCMonth() - 1);

    return [
        shifted.getUTCFullYear(),
        String(shifted.getUTCMonth() + 1).padStart(2, "0"),
        String(shifted.getUTCDate()).padStart(2, "0"),
    ].join("-");
};
