import { Head, useForm, usePage } from "@inertiajs/react";
import { useEffect, useMemo } from "react";
import Swal from "sweetalert2";
import toast from "react-hot-toast";

const starValues = [1, 2, 3, 4, 5];

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
            toast.success(flash.success);
        }
    }, [flash]);

    useEffect(() => {
        if (!errors || typeof errors !== "object") {
            return;
        }

        const messages = Object.values(errors).flatMap((value) =>
            Array.isArray(value) ? value : value ? [value] : []
        );

        if (messages.length > 0) {
            toast.error(messages[0]);
        }
    }, [errors]);

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

    const errorMessages = useMemo(() => {
        if (!errors || typeof errors !== "object") {
            return [];
        }

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
    };

    const fieldError = (index, key) => errors?.[`items.${index}.${key}`] || null;

    const submit = async (event) => {
        event.preventDefault();

        if (selectedCount === 0) {
            toast.error(
                "Isi minimal satu rating, saran, atau alert item belum diterima."
            );
            return;
        }

        const result = await Swal.fire({
            title: "Kirim kritik dan saran?",
            html: `
                <div style="text-align:left;font-size:14px;line-height:1.6;color:#334155;">
                    <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#b45309;">Konfirmasi feedback</div>
                    <p style="margin:10px 0 0;">Anda akan mengirim <strong>${selectedCount} item</strong> untuk invoice <strong>${transaction.invoice}</strong>.</p>
                    <p style="margin:8px 0 0;">Alert ke dapur aktif untuk <strong>${alertCount} item</strong>.</p>
                </div>
            `,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Ya, kirim sekarang",
            cancelButtonText: "Periksa lagi",
            confirmButtonColor: "#f59e0b",
            cancelButtonColor: "#64748b",
            reverseButtons: true,
            focusCancel: true,
        });

        if (!result.isConfirmed) {
            return;
        }

        form.post(route("feedback.transactions.store", transaction.invoice), {
            preserveScroll: true,
        });
    };

    return (
        <>
            <Head title={`Kritik & Saran ${transaction.invoice}`} />

            <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fde68a,_#fff_24%,_#f8fafc_72%)] px-4 py-4 text-slate-900 sm:px-6 sm:py-6">
                <div className="mx-auto max-w-3xl space-y-5">
                    <section className="overflow-hidden rounded-[32px] border border-amber-200 bg-white/95 shadow-sm">
                        <div className="bg-[linear-gradient(135deg,_rgba(245,158,11,0.14),_rgba(251,191,36,0.04)_55%,_rgba(255,255,255,0.9))] p-5 sm:p-6">
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
                                Kritik & Saran
                            </p>
                            <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] sm:text-[2rem]">
                                Bantu kami evaluasi pesanan ini
                            </h1>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                                Beri bintang dan catatan untuk tiap item. Jika ada item yang belum diterima, aktifkan alert agar dapur menerima pemberitahuan.
                            </p>
                        </div>
                        <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
                            <Stat label="Invoice" value={transaction.invoice} />
                            <Stat label="Pelanggan" value={transaction.customer_name} />
                            <Stat label="Item terisi" value={`${selectedCount}/${transaction.items.length}`} />
                        </div>
                        <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-3 sm:px-5">
                            <div className="flex flex-col gap-2 text-xs text-slate-600 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                                <GuidePill tone="amber" text="1. Pilih rating tiap item yang ingin dinilai" />
                                <GuidePill tone="slate" text="2. Tulis catatan jika perlu" />
                                <GuidePill tone="rose" text="3. Aktifkan alert bila item belum diterima" />
                            </div>
                        </div>
                    </section>

                    {flash?.success ? (
                        <section className="rounded-[28px] border border-emerald-200 bg-emerald-50/90 p-4 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                                Berhasil terkirim
                            </p>
                            <p className="mt-2 text-sm font-medium text-emerald-900">
                                {flash.success}
                            </p>
                            <p className="mt-1 text-xs text-emerald-700">
                                Pembeli bisa memperbarui isi feedback kapan saja lewat tombol kirim ulang di bawah.
                            </p>
                        </section>
                    ) : hasExistingSubmission ? (
                        <section className="rounded-[28px] border border-sky-200 bg-sky-50/90 p-4 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                                Feedback sebelumnya sudah ada
                            </p>
                            <p className="mt-2 text-sm text-sky-900">
                                Anda bisa meninjau kembali isi masukan yang sudah tersimpan lalu kirim ulang jika ada perubahan.
                            </p>
                        </section>
                    ) : null}

                    {errorMessages.length > 0 ? (
                        <section className="rounded-[28px] border border-rose-200 bg-rose-50/90 p-4 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">
                                Perlu diperbaiki
                            </p>
                            <div className="mt-2 space-y-1 text-sm text-rose-800">
                                {errorMessages.map((message, index) => (
                                    <p key={`${message}-${index}`}>• {message}</p>
                                ))}
                            </div>
                        </section>
                    ) : null}

                    <form onSubmit={submit} className="space-y-4 pb-28">
                        {transaction.items.map((item, index) => {
                            const state =
                                form.data.items.find(
                                    (entry) =>
                                        Number(entry.transaction_detail_id) ===
                                        Number(item.id)
                                ) || {};

                            return (
                                <section
                                    key={item.id}
                                    className={`rounded-[28px] border bg-white p-4 shadow-sm transition sm:p-5 ${
                                        state.not_received || Number(state.rating || 0) > 0
                                            ? "border-amber-300 ring-2 ring-amber-100"
                                            : "border-slate-200"
                                    }`}
                                >
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <div className="mb-2 flex items-center gap-2">
                                                <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-slate-100 px-2 text-xs font-semibold text-slate-700">
                                                    {index + 1}
                                                </span>
                                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                                                    Qty {item.qty}
                                                </span>
                                                {Number(state.rating || 0) > 0 ? (
                                                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                                                        {state.rating}/5 bintang
                                                    </span>
                                                ) : null}
                                                {state.not_received ? (
                                                    <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
                                                        Alert ke dapur aktif
                                                    </span>
                                                ) : null}
                                            </div>
                                            <h2 className="text-lg font-semibold">
                                                {item.product_name}
                                            </h2>
                                            {item.notes ? (
                                                <p className="mt-1 text-sm text-slate-500">
                                                    Catatan pesanan: {item.notes}
                                                </p>
                                            ) : null}
                                            {item.customer_alert_requested_at ? (
                                                <p className="mt-2 text-xs font-medium text-rose-600">
                                                    Alert terakhir sudah dikirim ke dapur.
                                                </p>
                                            ) : null}
                                        </div>
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 sm:min-w-[180px]">
                                            <p className="font-semibold text-slate-800">
                                                Panduan singkat
                                            </p>
                                            <p className="mt-1">
                                                Nilai item ini, lalu tambahkan catatan bila ada detail rasa, suhu, porsi, atau layanan.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-5">
                                        <label className="mb-2 block text-sm font-medium text-slate-700">
                                            Rating item
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {starValues.map((value) => {
                                                const active =
                                                    Number(state.rating || 0) >=
                                                    value;

                                                return (
                                                    <button
                                                        key={value}
                                                        type="button"
                                                        onClick={() =>
                                                            updateItem(
                                                                item.id,
                                                                "rating",
                                                                value
                                                            )
                                                        }
                                                        className={`inline-flex h-11 min-w-11 items-center justify-center rounded-2xl border text-xl transition sm:h-12 sm:min-w-12 ${
                                                            active
                                                                ? "border-amber-400 bg-amber-50 text-amber-500"
                                                                : "border-slate-200 bg-white text-slate-300"
                                                        }`}
                                                    >
                                                        ★
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {fieldError(index, "rating") ? (
                                            <p className="mt-2 text-xs font-medium text-rose-600">
                                                {fieldError(index, "rating")}
                                            </p>
                                        ) : null}
                                    </div>

                                    <div className="mt-5">
                                        <label className="mb-2 block text-sm font-medium text-slate-700">
                                            Kritik atau saran item ini
                                        </label>
                                        <textarea
                                            rows={4}
                                            value={state.feedback_text || ""}
                                            onChange={(event) =>
                                                updateItem(
                                                    item.id,
                                                    "feedback_text",
                                                    event.target.value
                                                )
                                            }
                                            placeholder="Contoh: rasa terlalu manis, suhu kurang dingin, porsi sudah pas"
                                            className={`w-full rounded-2xl border bg-slate-50 px-4 py-3 text-sm outline-none transition focus:ring-4 ${
                                                fieldError(index, "feedback_text")
                                                    ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
                                                    : "border-slate-200 focus:border-amber-400 focus:ring-amber-100"
                                            }`}
                                        />
                                        {fieldError(index, "feedback_text") ? (
                                            <p className="mt-2 text-xs font-medium text-rose-600">
                                                {fieldError(index, "feedback_text")}
                                            </p>
                                        ) : null}
                                    </div>

                                    <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50/70 p-4">
                                        <label className="flex items-start gap-3">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(state.not_received)}
                                                onChange={(event) =>
                                                    updateItem(
                                                        item.id,
                                                        "not_received",
                                                        event.target.checked
                                                    )
                                                }
                                                className="mt-1 h-5 w-5 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                                            />
                                            <span>
                                                <span className="block text-sm font-semibold text-rose-800">
                                                    Item ini belum saya terima
                                                </span>
                                                <span className="mt-1 block text-xs text-rose-700">
                                                    Aktifkan jika pembeli masih menunggu item ini. Dapur akan menerima popup alert.
                                                </span>
                                            </span>
                                        </label>

                                        {state.not_received ? (
                                            <textarea
                                                rows={3}
                                                value={state.customer_alert_message || ""}
                                                onChange={(event) =>
                                                    updateItem(
                                                        item.id,
                                                        "customer_alert_message",
                                                        event.target.value
                                                    )
                                                }
                                                placeholder="Contoh: Es teh belum sampai ke meja kami"
                                                className={`mt-3 w-full rounded-2xl border bg-white px-4 py-3 text-sm outline-none transition focus:ring-4 ${
                                                    fieldError(
                                                        index,
                                                        "customer_alert_message"
                                                    )
                                                        ? "border-rose-300 focus:border-rose-500 focus:ring-rose-100"
                                                        : "border-rose-200 focus:border-rose-400 focus:ring-rose-100"
                                                }`}
                                            />
                                        ) : null}
                                        {fieldError(index, "customer_alert_message") ? (
                                            <p className="mt-2 text-xs font-medium text-rose-600">
                                                {
                                                    fieldError(
                                                        index,
                                                        "customer_alert_message"
                                                    )
                                                }
                                            </p>
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
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-lg text-amber-700">
                                ★
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
                            type="submit"
                            onClick={submit}
                            disabled={form.processing}
                            className="inline-flex h-12 items-center justify-center rounded-2xl bg-amber-500 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:opacity-50"
                        >
                            {form.processing
                                ? "Mengirim..."
                                : flash?.success || hasExistingSubmission
                                  ? "Kirim Ulang"
                                  : "Kirim kritik, saran, dan alert"}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}

function Stat({ label, value }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {label}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
        </div>
    );
}

function GuidePill({ tone = "slate", text }) {
    const styles = {
        amber: "border-amber-200 bg-amber-50 text-amber-800",
        rose: "border-rose-200 bg-rose-50 text-rose-800",
        slate: "border-slate-200 bg-white text-slate-700",
    };

    return (
        <span
            className={`inline-flex rounded-full border px-3 py-1.5 ${styles[tone] || styles.slate}`}
        >
            {text}
        </span>
    );
}
