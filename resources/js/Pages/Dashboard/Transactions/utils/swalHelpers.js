/**
 * Centralized SweetAlert2 helpers untuk halaman Transactions.
 * Semua Swal.fire() config dikumpulkan di sini agar mudah dimodifikasi
 * dan tidak duplikat. Semua fungsi async agar Swal di-lazy-load.
 */

const loadSwal = () => import("sweetalert2").then((m) => m.default);

export const confirmOpenShift = async ({ openingCashFormatted }) => {
    const Swal = await loadSwal();
    return Swal.fire({
        title: "Buka shift kasir?",
        html: `Modal awal akan disimpan sebesar <strong>${openingCashFormatted}</strong>.`,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Buka Shift",
        cancelButtonText: "Batal",
        confirmButtonColor: "#2563eb",
        cancelButtonColor: "#64748b",
        reverseButtons: true,
    });
};

export const confirmQrisPayment = async () => {
    const Swal = await loadSwal();
    return Swal.fire({
        title: "Konfirmasi Pembayaran QRIS",
        html: "Pastikan pembayaran QRIS manual sudah berhasil diterima.<br/>Lanjutkan hanya jika dana sudah benar-benar masuk.",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Sudah Dibayar",
        cancelButtonText: "Periksa Lagi",
        confirmButtonColor: "#16a34a",
        cancelButtonColor: "#64748b",
        reverseButtons: true,
    });
};

export const confirmCashPayment = async ({ total, paid, formatPrice }) => {
    const Swal = await loadSwal();
    return Swal.fire({
        title: "Periksa Pembayaran Tunai",
        html: `
            <div style="text-align:left;display:grid;gap:8px;">
                <div style="display:flex;justify-content:space-between;gap:12px;"><span>Total</span><strong>${formatPrice(total)}</strong></div>
                <div style="display:flex;justify-content:space-between;gap:12px;"><span>Dibayar</span><strong>${formatPrice(paid)}</strong></div>
                <div style="display:flex;justify-content:space-between;gap:12px;"><span>Kembalian</span><strong>${formatPrice(Math.max(paid - total, 0))}</strong></div>
            </div>
            <p style="margin-top:16px;">Pastikan uang diterima dan kembalian sudah sesuai sebelum transaksi disimpan.</p>
        `,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sudah Sesuai",
        cancelButtonText: "Cek Lagi",
        confirmButtonColor: "#16a34a",
        cancelButtonColor: "#64748b",
        reverseButtons: true,
    });
};

export const showValidationErrorModal = async ({ title, message }) => {
    const Swal = await loadSwal();
    return Swal.fire({
        title: title || "Validasi Gagal",
        html: `<div style="text-align:left;font-size:14px;color:#334155;line-height:1.6;">${message}</div>`,
        icon: "warning",
        confirmButtonText: "Tutup",
        confirmButtonColor: "#2563eb",
    });
};
