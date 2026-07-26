import { Head, useForm, usePage } from "@inertiajs/react";
import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import toast from "react-hot-toast";
import {
    IconStar,
    IconStarFilled,
    IconAlertTriangle,
    IconAlertCircle,
    IconCircleCheck,
    IconMessageCircle,
    IconClock,
    IconPackage,
    IconClipboardText,
    IconReceipt,
    IconUser,
    IconBolt,
    IconSend,
    IconInfoCircle,
} from "@tabler/icons-react";

const STAR_VALUES = [1, 2, 3, 4, 5];

const showToast = (title, description, tone = "rose") => {
    const styles = {
        rose: {
            container: "border-rose-300 bg-rose-50 text-slate-900",
            iconBg: "bg-rose-100 text-rose-600",
            title: "text-rose-800",
            Icon: IconAlertCircle,
        },
        amber: {
            container: "border-amber-300 bg-amber-50 text-slate-900",
            iconBg: "bg-amber-100 text-amber-600",
            title: "text-amber-800",
            Icon: IconAlertTriangle,
        },
        emerald: {
            container: "border-emerald-300 bg-emerald-50 text-slate-900",
            iconBg: "bg-emerald-100 text-emerald-600",
            title: "text-emerald-800",
            Icon: IconCircleCheck,
        },
        slate: {
            container: "border-slate-300 bg-slate-50 text-slate-900",
            iconBg: "bg-slate-100 text-slate-600",
            title: "text-slate-800",
            Icon: IconInfoCircle,
        },
    };

    const style = styles[tone] || styles.rose;
    const IconComponent = style.Icon;

    toast.custom((t) => (
        <div
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-xl ${style.container}`}
        >
            <span
                className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${style.iconBg}`}
            >
                <IconComponent size={18} />
            </span>
            <div className="min-w-0">
                <p className={`text-sm font-semibold ${style.title}`}>{title}</p>
                {description && (
                    <p className="mt-0.5 text-xs text-slate-600">{description}</p>
                )}
            </div>
        </div>
    ));
};

export default function TransactionFeedback({ transaction }) {
    const { flash, errors } = usePage().props;

    const form = useForm({
        items: (transaction?.items || []).map((item) => ({
            transaction_detail_id: item.id,
            rating: item.rating || 0,
            feedback_text: item.feedback_text || "",
            not_received: item.delivery_status === "not_received",
            customer_alert_message: item.customer_alert_message || "",
        })),
    });

    useEffect(() => {
        if (flash?.success) {
            showToast("Berhasil terkirim", flash.success, "emerald");
        }
    }, [flash]);

    useEffect(() => {
        if (!errors || typeof errors !== "object") return;

        const messages = Object.values(errors).flatMap((value) =>
            Array.isArray(value) ? value : value ? [value] : []
        );

        if (messages.length > 0) {
            showToast(
                "Validasi gagal",
                messages.length === 1
                    ? messages[0]
                    : `${messages.length} kesalahan ditemukan. Periksa form di bawah.`,
                "rose"
            );
        }
    }, [errors]);

    const [validationErrors, setValidationErrors] = useState([]);

    const selectedCount = useMemo(
        () =>
            form.data.items.filter(
                (item) =>
                    Number(item.rating || 0) > 0 ||
                    String(item.feedback_text || "").trim() !== "" ||
                    item.not_received
            ).length,
        [form.data.items]
    );

    const hasExistingSubmission = useMemo(
        () =>
            (transaction?.items || []).some(
                (item) =>
                    Number(item.rating || 0) > 0 ||
                    String(item.feedback_text || "").trim() !== "" ||
                    item.delivery_status === "not_received"
            ),
        [transaction?.items]
    );

    const alertCount = useMemo(
        () => form.data.items.filter((item) => item.not_received).length,
        [form.data.items]
    );

    const fullyFilledCount = useMemo(
        () =>
            form.data.items.filter(
                (item) =>
                    Number(item.rating || 0) > 0 &&
                    !item.not_received
            ).length,
        [form.data.items]
    );

    const partialTextOnlyCount = useMemo(
        () =>
            form.data.items.filter(
                (item) =>
                    Number(item.rating || 0) === 0 &&
                    String(item.feedback_text || "").trim() !== "" &&
                    !item.not_received
            ).length,
        [form.data.items]
    );

    const errorMessages = useMemo(() => {
        if (!errors || typeof errors !== "object") return [];

        return Object.values(errors).flatMap((value) =>
            Array.isArray(value) ? value : value ? [value] : []
        );
    }, [errors]);

    const updateItem = (detailId, key, value) => {
        form.setData(
            "items",
            form.data.items.map((item) =>
                Number(item.transaction_detail_id) === Number(detailId)
                    ? { ...item, [key]: value }
                    : item
            )
        );

        setValidationErrors((prev) =>
            prev.filter((err) => err.detailId !== detailId)
        );
    };

    const fieldError = (index, key) => errors?.[`items.${index}.${key}`] || null;

    const getItemState = (item) => {
        const state = form.data.items.find(
            (entry) => Number(entry.transaction_detail_id) === Number(item.id)
        ) || {};

        const hasRating = Number(state.rating || 0) > 0;
        const hasFeedback = String(state.feedback_text || "").trim() !== "";
        const isAlert = state.not_received;

        if (isAlert) return "alert";
        if (hasRating && hasFeedback) return "complete";
        if (hasRating || hasFeedback) return "partial";
        return "empty";
    };

    const stateVariant = {
        alert: {
            border: "border-rose-300",
            ring: "ring-rose-100",
            bg: "bg-rose-50/40",
            badge: "bg-rose-100 text-rose-700 border-rose-200",
            iconBg: "bg-rose-100 text-rose-600",
            icon: IconAlertTriangle,
            label: "Belum diterima",
        },
        complete: {
            border: "border-emerald-200",
            ring: "ring-emerald-50",
            bg: "bg-emerald-50/30",
            badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
            iconBg: "bg-emerald-100 text-emerald-600",
            icon: IconCircleCheck,
            label: "Siap kirim",
        },
        partial: {
            border: "border-amber-200",
            ring: "ring-amber-50",
            bg: "bg-amber-50/30",
            badge: "bg-amber-100 text-amber-700 border-amber-200",
            iconBg: "bg-amber-100 text-amber-600",
            icon: IconBolt,
            label: "Sebagian terisi",
        },
        empty: {
            border: "border-slate-200",
            ring: "ring-slate-50",
            bg: "bg-white",
            badge: "bg-slate-100 text-slate-600 border-slate-200",
            iconBg: "bg-slate-100 text-slate-500",
            icon: IconClock,
            label: "Belum diisi",
        },
    };

    const validateForm = () => {
        const errors = [];
        form.data.items.forEach((item) => {
            const detailId = item.transaction_detail_id;
            const hasRating = Number(item.rating || 0) > 0;
            const hasFeedback = String(item.feedback_text || "").trim() !== "";
            const isAlert = item.not_received;

            if (!hasRating && !hasFeedback && !isAlert) {
                errors.push({
                    detailId,
                    index: transaction.items.findIndex((tx) => tx.id === detailId),
                    message: "Isi minimal rating, saran, atau aktifkan alert untuk item ini.",
                });
            }

            if (isAlert && !String(item.customer_alert_message || "").trim()) {
                errors.push({
                    detailId,
                    index: transaction.items.findIndex((tx) => tx.id === detailId),
                    field: "customer_alert_message",
                    message: "Tulis detail masalah agar dapur bisa tindaklanjuti.",
                });
            }
        });

        return errors;
    };

    const scrollToElement = (selector) => {
        const el = document.querySelector(selector);
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    const submit = async (event) => {
        event.preventDefault();
        setValidationErrors([]);

        const errors = validateForm();

        if (errors.length > 0) {
            setValidationErrors(errors);
            showToast(
                `${errors.length} item belum diisi`,
                "Scroll otomatis ke form yang perlu diperbaiki.",
                "rose"
            );
            const firstDetailId = errors[0].detailId;
            scrollToElement(`[data-item-id="${firstDetailId}"]`);
            return;
        }

        if (selectedCount === 0) {
            setValidationErrors([
                {
                    detailId: form.data.items[0]?.transaction_detail_id,
                    index: 0,
                    message:
                        "Isi minimal satu rating, saran, atau centang alert item belum diterima.",
                },
            ]);
            showToast(
                "Belum ada feedback",
                "Pilih minimal satu rating, saran, atau centang alert item belum diterima.",
                "amber"
            );
            scrollToElement('[data-item-id="' + form.data.items[0]?.transaction_detail_id + '"]');
            return;
        }

        const result = await Swal.fire({
            title: "Kirim feedback?",
            html: `
                <div style="text-align:left;font-size:14px;line-height:1.7;color:#334155;">
                    <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#047857;margin-bottom:8px;">Konfirmasi pengiriman</div>
                    <p style="margin:0 0 6px;">Anda akan mengirim <strong>${selectedCount} item</strong> untuk invoice <strong>${transaction.invoice}</strong>.</p>
                    <p style="margin:0 0 6px;"><strong>${fullyFilledCount} item</strong> sudah diberi rating.</p>
                    <p style="margin:0 0 6px;"><strong>${partialTextOnlyCount} item</strong> hanya mengisi catatan tanpa rating.</p>
                    <p style="margin:0;"><strong>${alertCount} item</strong> mendapatkan alert ke dapur.</p>
                </div>
            `,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Ya, kirim sekarang",
            cancelButtonText: "Periksa lagi",
            confirmButtonColor: "#047857",
            cancelButtonColor: "#64748b",
            reverseButtons: true,
            focusCancel: true,
        });

        if (!result.isConfirmed) return;

        form.post(route("feedback.transactions.store", transaction.invoice), {
            preserveScroll: true,
        });
    };

    return (
        <>
            <Head title={`Feedback ${transaction.invoice}`} />

            <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#d1fae5,_#ffffff_28%,_#f8fafc_72%)] px-4 py-4 text-slate-900 sm:px-6 sm:py-6">
                <div className="mx-auto max-w-3xl space-y-5">
                    <section className="overflow-hidden rounded-[32px] border border-emerald-200 bg-white/95 shadow-sm">
                        <div className="bg-[linear-gradient(135deg,_rgba(16,185,129,0.12),_rgba(52,211,153,0.04)_55%,_rgba(255,255,255,0.95))] p-5 sm:p-6">
                            <div className="flex items-center gap-2">
                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                                    <IconClipboardText size={18} />
                                </span>
                                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
                                    Feedback Transaksi
                                </p>
                            </div>
                            <h1 className="mt-3 text-2xl font-bold tracking-[-0.03em] sm:text-[2rem]">
                                Beri penilaian untuk item ini
                            </h1>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                                Bantu kami meningkatkan kualitas pelayanan. Beri bintang, tulis saran, atau aktifkan alert jika ada item yang belum diterima.
                            </p>
                        </div>

                        <div className="grid gap-3 p-4 sm:grid-cols-4 sm:p-5">
                            <Stat label="Invoice" value={transaction.invoice} icon={IconReceipt} />
                            <Stat label="Pelanggan" value={transaction.customer_name} icon={IconUser} />
                            <Stat label="Item terisi" value={`${selectedCount}/${transaction.items.length}`} icon={IconClipboardText} />
                            <Stat label="Alert dapur" value={`${alertCount} item`} icon={IconAlertTriangle} />
                        </div>

                        <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-3 sm:px-5">
                            <div className="flex flex-col gap-2 text-xs text-slate-600 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                                <StatusPill tone="emerald" icon={IconCircleCheck} text={`Sudah rating: ${fullyFilledCount}`} />
                                <StatusPill tone="amber" icon={IconBolt} text={`Cuma catatan: ${partialTextOnlyCount}`} />
                                <StatusPill tone="rose" icon={IconAlertTriangle} text={`Alert: ${alertCount}`} />
                                <StatusPill tone="slate" icon={IconClock} text={`Kosong: ${transaction.items.length - selectedCount}`} />
                            </div>
                        </div>
                    </section>

                    {flash?.success ? (
                        <section className="rounded-[28px] border border-emerald-200 bg-emerald-50/90 p-4 shadow-sm">
                            <div className="flex items-center gap-2">
                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                                    <IconCircleCheck size={18} />
                                </span>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                                        Berhasil terkirim
                                    </p>
                                    <p className="text-sm font-medium text-emerald-900">
                                        {flash.success}
                                    </p>
                                </div>
                            </div>
                        </section>
                    ) : hasExistingSubmission ? (
                        <section className="rounded-[28px] border border-sky-200 bg-sky-50/90 p-4 shadow-sm">
                            <div className="flex items-center gap-2">
                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                                    <IconMessageCircle size={18} />
                                </span>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                                        Feedback sebelumnya ada
                                    </p>
                                    <p className="text-sm text-sky-900">
                                        Anda bisa meninjau kembali isi masukan yang sudah tersimpan lalu kirim ulang jika ada perubahan.
                                    </p>
                                </div>
                            </div>
                        </section>
                    ) : null}

                    {errorMessages.length > 0 ? (
                        <section className="rounded-[28px] border border-rose-200 bg-rose-50/90 p-4 shadow-sm">
                            <div className="flex items-center gap-2">
                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                                    <IconAlertCircle size={18} />
                                </span>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">
                                    Validasi gagal
                                </p>
                            </div>
                            <div className="mt-3 space-y-2 text-sm text-rose-800">
                                {errorMessages.map((message, index) => (
                                    <p key={`${message}-${index}`} className="flex items-start gap-2">
                                        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
                                            <span className="text-[10px] font-bold">{index + 1}</span>
                                        </span>
                                        {message}
                                    </p>
                                ))}
                            </div>
                        </section>
                    ) : null}

                    {validationErrors.length > 0 ? (
                        <section className="rounded-[28px] border border-rose-200 bg-rose-50/90 p-4 shadow-sm">
                            <div className="flex items-center gap-2">
                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                                    <IconAlertCircle size={18} />
                                </span>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">
                                    Item belum diisi
                                </p>
                            </div>
                            <div className="mt-3 space-y-2 text-sm text-rose-800">
                                {validationErrors.map((err, idx) => (
                                    <p key={`${err.detailId}-${idx}`} className="flex items-start gap-2">
                                        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
                                            <span className="text-[10px] font-bold">{idx + 1}</span>
                                        </span>
                                        <span>
                                            Item <strong>#{err.index + 1}</strong>: {err.message}
                                        </span>
                                    </p>
                                ))}
                            </div>
                        </section>
                    ) : null}

                    <form onSubmit={submit} className="space-y-4 pb-28">
                        {transaction.items.map((item, index) => {
                            const itemState = getItemState(item);
                            const variant = stateVariant[itemState];
                            const StateIcon = variant.icon;

                            const state = form.data.items.find(
                                (entry) => Number(entry.transaction_detail_id) === Number(item.id)
                            ) || {};

                                const itemValidationErrors =
                                    validationErrors.filter(
                                        (err) => err.detailId === item.id
                                    ) || [];
                                const hasItemError =
                                    itemValidationErrors.length > 0;

                                return (
                                    <section
                                        key={item.id}
                                        data-item-id={item.id}
                                        className={`rounded-[28px] border bg-white p-4 shadow-sm transition sm:p-5 ${
                                            hasItemError || itemState === "alert"
                                                ? "border-rose-300 ring-2 ring-rose-100"
                                                : itemState === "complete"
                                                  ? "border-emerald-200 ring-2 ring-emerald-50"
                                                  : itemState === "partial"
                                                    ? "border-amber-200 ring-2 ring-amber-50"
                                                    : `${variant.border} ring-2 ${variant.ring}`
                                        }`}
                                    >
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-semibold ${variant.iconBg}`}>
                                                    #{index + 1}
                                                </span>
                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 border border-slate-200">
                                                    <IconPackage size={12} />
                                                    {item.qty}x
                                                </span>

                                                {Number(state.rating || 0) > 0 ? (
                                                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold border ${state.rating >= 4 ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-slate-100 text-slate-700 border-slate-200"}`}>
                                                        <IconStarFilled size={12} />
                                                        {state.rating}/5
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-400 border border-slate-200">
                                                        <IconStar size={12} />
                                                        Belum bintang
                                                    </span>
                                                )}

                                                {state.not_received ? (
                                                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold border ${variant.badge}`}>
                                                        <IconAlertTriangle size={12} />
                                                        Alert dapur aktif
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-400 border border-slate-200">
                                                        <IconClock size={12} />
                                                        Diterima
                                                    </span>
                                                )}
                                            </div>

                                            {hasItemError ? (
                                                <div className="mt-3 space-y-2">
                                                    {itemValidationErrors.map((err, idx) => (
                                                        <p
                                                            key={idx}
                                                            className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700"
                                                        >
                                                            <IconAlertCircle
                                                                size={14}
                                                                className="mt-0.5 shrink-0 text-rose-500"
                                                            />
                                                            {err.message}
                                                        </p>
                                                    ))}
                                                </div>
                                            ) : null}

                                            <h2 className="mt-2.5 flex items-center gap-2 text-lg font-semibold text-slate-900">
                                                <StateIcon size={20} className={variant.iconBg.replace("bg-", "text-").replace("text-", "text-")} />
                                                {item.product_name}
                                            </h2>

                                            {item.notes ? (
                                                <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-500">
                                                    <IconClipboardText size={14} className="mt-0.5 shrink-0 text-slate-400" />
                                                    Catatan pesanan: {item.notes}
                                                </p>
                                            ) : null}

                                            {item.customer_alert_requested_at ? (
                                                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-rose-600">
                                                    <IconAlertCircle size={14} />
                                                    Alert terakhir sudah dikirim ke dapur.
                                                </p>
                                            ) : null}
                                        </div>

                                        <div className={`shrink-0 rounded-2xl border bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600 sm:min-w-[200px] ${variant.border}`}>
                                            <p className="flex items-center gap-1.5 font-semibold text-slate-800">
                                                <StateIcon size={14} />
                                                {variant.label}
                                            </p>
                                            <p className="mt-1 leading-relaxed">
                                                {itemState === "alert"
                                                    ? "Item ini belum diterima. Beri detail masalah agar dapur bisa segera tindaklanjuti."
                                                    : itemState === "complete"
                                                        ? "Semua data sudah terisi. Pastikan ulasan sesuai sebelum dikirim."
                                                        : itemState === "partial"
                                                            ? "Lanjutkan isi rating atau catatan untuk melengkapi feedback."
                                                            : "Pilih minimal 1 bintang atau tulis catatan untuk item ini."}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-6">
                                        <div className="flex items-center justify-between">
                                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                                <IconStar size={16} className="text-amber-500" />
                                                Rating item
                                            </label>
                                            {Number(state.rating || 0) > 0 && (
                                                <span className="text-xs font-medium text-amber-600">
                                                    {state.rating}/5 bintang
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {STAR_VALUES.map((value) => {
                                                const active = Number(state.rating || 0) >= value;

                                                return (
                                                    <button
                                                        key={value}
                                                        type="button"
                                                        onClick={() => updateItem(item.id, "rating", value)}
                                                        className={`inline-flex h-11 min-w-11 items-center justify-center rounded-2xl border text-lg transition sm:h-12 sm:min-w-12 ${
                                                            active
                                                                ? "border-amber-400 bg-amber-50 text-amber-500 shadow-sm shadow-amber-100"
                                                                : "border-slate-200 bg-white text-slate-300 hover:border-amber-200 hover:text-amber-300"
                                                        }`}
                                                    >
                                                        {active ? <IconStarFilled size={20} /> : <IconStar size={20} />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {fieldError(index, "rating") ? (
                                            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-rose-600">
                                                <IconAlertCircle size={14} />
                                                {fieldError(index, "rating")}
                                            </p>
                                        ) : null}
                                    </div>

                                    <div className="mt-6">
                                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                            <IconMessageCircle size={16} className="text-sky-500" />
                                            Kritik atau saran item ini
                                        </label>
                                        <textarea
                                            rows={4}
                                            value={state.feedback_text || ""}
                                            onChange={(event) => updateItem(item.id, "feedback_text", event.target.value)}
                                            placeholder="Contoh: rasa terlalu manis, suhu kurang dingin, porsi sudah pas, pelayanan ramah"
                                            className={`mt-3 w-full rounded-2xl border bg-slate-50 px-4 py-3 text-sm outline-none transition focus:ring-4 ${
                                                fieldError(index, "feedback_text")
                                                    ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
                                                    : "border-slate-200 focus:border-sky-400 focus:ring-sky-100"
                                            }`}
                                        />
                                        {fieldError(index, "feedback_text") ? (
                                            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-rose-600">
                                                <IconAlertCircle size={14} />
                                                {fieldError(index, "feedback_text")}
                                            </p>
                                        ) : null}
                                    </div>

                                    <div className={`mt-6 rounded-2xl border bg-rose-50/70 p-4 ${state.not_received ? "border-rose-300 ring-2 ring-rose-100" : "border-rose-200"}`}>
                                        <label className="flex items-start gap-3">
                                            <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-md border-2 bg-white">
                                                <input
                                                    type="checkbox"
                                                    checked={Boolean(state.not_received)}
                                                    onChange={(event) => updateItem(item.id, "not_received", event.target.checked)}
                                                    className="h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                                                />
                                            </div>
                                            <span>
                                                <span className="flex items-center gap-1.5 text-sm font-semibold text-rose-800">
                                                    <IconAlertTriangle size={16} />
                                                    Item ini belum diterima
                                                </span>
                                                <span className="mt-1 block text-xs text-rose-700">
                                                    Aktifkan jika pembeli masih menunggu item ini. Dapur akan menerima notifikasi.
                                                </span>
                                            </span>
                                        </label>

                                        {state.not_received ? (
                                            <div className="mt-3">
                                                <label className="flex items-center gap-2 text-sm font-semibold text-rose-700">
                                                    <IconMessageCircle size={15} />
                                                    Detail masalah (untuk dapur)
                                                </label>
                                                <textarea
                                                    rows={3}
                                                    value={state.customer_alert_message || ""}
                                                    onChange={(event) => updateItem(item.id, "customer_alert_message", event.target.value)}
                                                    placeholder="Contoh: Es teh belum sampai ke meja kami, nasi terlalu keras, Mie Goreng baru digoreng sekali."
                                                    className={`mt-3 w-full rounded-2xl border bg-white px-4 py-3 text-sm outline-none transition focus:ring-4 ${
                                                        fieldError(index, "customer_alert_message")
                                                            ? "border-rose-300 focus:border-rose-500 focus:ring-rose-100"
                                                            : "border-rose-200 focus:border-rose-400 focus:ring-rose-100"
                                                    }`}
                                                />
                                                {fieldError(index, "customer_alert_message") ? (
                                                    <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-rose-600">
                                                        <IconAlertCircle size={14} />
                                                        {fieldError(index, "customer_alert_message")}
                                                    </p>
                                                ) : null}
                                            </div>
                                        ) : null}
                                    </div>
                                </section>
                            );
                        })}
                    </form>
                </div>

                <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
                    <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${selectedCount > 0 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                                <IconSend size={20} />
                            </div>
                            <div>
                                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                                    Siap dikirim
                                </p>
                                <p className="text-sm font-semibold text-slate-900">
                                    {selectedCount} item sudah diisi
                                </p>
                                <p className="text-xs text-slate-500">
                                    {alertCount} item dengan alert dapur
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={submit}
                            disabled={form.processing}
                            className="inline-flex h-12 items-center justify-center rounded-2xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                        >
                            {form.processing
                                ? "Mengirim..."
                                : flash?.success || hasExistingSubmission
                                  ? "Kirim Ulang"
                                  : "Kirim Feedback"}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}

function Stat({ label, value, icon: Icon }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {Icon && <Icon size={12} />}
                {label}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
        </div>
    );
}

function StatusPill({ tone = "slate", icon: Icon, text }) {
    const styles = {
        emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
        amber: "border-amber-200 bg-amber-50 text-amber-800",
        rose: "border-rose-200 bg-rose-50 text-rose-800",
        slate: "border-slate-200 bg-white text-slate-700",
    };

    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 ${styles[tone] || styles.slate}`}>
            {Icon && <Icon size={13} />}
            {text}
        </span>
    );
}
