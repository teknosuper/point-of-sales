import { Head, Link } from "@inertiajs/react";
import { useState } from "react";
import {
    IconArrowRight,
    IconBolt,
    IconBuildingStore,
    IconCashBanknote,
    IconChartHistogram,
    IconChefHat,
    IconChecks,
    IconDeviceMobile,
    IconLayoutDashboard,
    IconQrcode,
    IconReceipt2,
    IconShieldCheck,
    IconStack2,
    IconUsersGroup,
    IconMenu2,
    IconX,
} from "@/Utils/icons";

const highlights = [
    {
        value: "Kasir cepat",
        label: "Checkout, print struk, hold, dan resume transaksi tanpa hambatan.",
    },
    {
        value: "Operasional rapi",
        label: "Shift, stok, retur, piutang, dan approval tetap terkendali.",
    },
    {
        value: "Siap outlet & dapur",
        label: "Multi-outlet, routing kitchen, QR meja, dan dine-in yang lebih siap.",
    },
];

const featureGroups = [
    {
        title: "Frontline POS",
        summary: "Dirancang untuk transaksi yang cepat, jelas, dan nyaman di desktop maupun tablet.",
        icon: IconBolt,
        items: [
            "Penjualan tunai, transfer, gateway, dan nota barang",
            "Print struk thermal dan preview tanpa redirect berulang",
            "QR meja, dine-in, take away, dan pemilihan meja yang lebih ringan",
        ],
    },
    {
        title: "Inventory & Control",
        summary: "Mengurangi blind spot operasional dengan alur stok dan audit yang lebih disiplin.",
        icon: IconStack2,
        items: [
            "Manajemen produk, kategori, barcode, dan stok per outlet",
            "Stock opname, mutasi stok, retur penjualan, dan retur supplier",
            "Audit log aktivitas dan kontrol permission yang lebih ketat",
        ],
    },
    {
        title: "Growth & Insight",
        summary: "Bukan hanya mesin kasir, tapi fondasi untuk keputusan bisnis harian.",
        icon: IconChartHistogram,
        items: [
            "Laporan penjualan, profit, insight lanjutan, dan analytics outlet",
            "CRM, reminder, loyalty, voucher, dan segmentasi pelanggan",
            "PWA, mode offline tunai, dan kesiapan workflow tablet kasir",
        ],
    },
];

const workflow = [
    {
        step: "01",
        title: "Ambil order dengan cepat",
        desc: "Cari produk, scan barcode, pilih varian, modifier, meja, dan pelanggan tanpa memecah fokus kasir.",
        icon: IconReceipt2,
    },
    {
        step: "02",
        title: "Proses operasional di belakang layar",
        desc: "Shift, stok, kitchen routing, dan approval tetap tercatat tanpa menambah beban kerja manual.",
        icon: IconChefHat,
    },
    {
        step: "03",
        title: "Pantau performa harian",
        desc: "Lihat penjualan, margin, piutang, dan histori pelanggan dari dashboard dan laporan yang konsisten.",
        icon: IconLayoutDashboard,
    },
];

const useCases = [
    {
        title: "Retail & minimarket",
        icon: IconBuildingStore,
        desc: "Butuh transaksi cepat, stok rapi, dan kontrol outlet yang jelas.",
    },
    {
        title: "Cafe & resto",
        icon: IconQrcode,
        desc: "Cocok untuk dine-in, QR meja, kitchen flow, dan variasi pesanan.",
    },
    {
        title: "Tim owner & supervisor",
        icon: IconUsersGroup,
        desc: "Memantau cashflow, audit, dan performa outlet dari satu panel kerja.",
    },
];

const stats = [
    {
        value: "POS + Ops",
        label: "Transaksi, stok, shift, kitchen, dan laporan dalam satu alur kerja.",
    },
    {
        value: "Tablet Ready",
        label: "Nyaman dipakai di perangkat sentuh dan PWA.",
    },
    {
        value: "Offline Cash",
        label: "Transaksi tunai tetap jalan saat internet atau server bermasalah.",
    },
    {
        value: "Audit Friendly",
        label: "Permission, step-up, dan audit log menjaga kontrol operasional.",
    },
];

const trustStrip = [
    "Shift kasir dan cash closing",
    "QR meja dan kitchen routing",
    "Stock opname dan mutasi stok",
    "CRM, loyalty, voucher, piutang",
];

const switchingReasons = [
    {
        title: "Kurangi ketergantungan pada catatan manual",
        desc: "Saat stok, shift, dan piutang masih dicatat terpisah, masalah akan muncul di belakang layar. GTC KASIR merapikannya.",
    },
    {
        title: "Berhenti memakai POS yang hanya kuat di kasir",
        desc: "Banyak sistem cepat saat checkout, tetapi lemah untuk dapur, meja, outlet, approval, audit, dan laporan.",
    },
    {
        title: "Siapkan operasi untuk perangkat yang nyata",
        desc: "Desktop, tablet kasir, PWA, dan mode offline tunai adalah bagian dari operasi harian, bukan fitur tambahan.",
    },
];

const leadershipPoints = [
    {
        title: "Owner butuh visibilitas, bukan kejutan",
        desc: "Penjualan, margin, piutang, outlet, dan anomali operasional harus terlihat cukup cepat untuk diambil tindakan.",
    },
    {
        title: "Supervisor butuh kontrol yang bisa dijalankan",
        desc: "Approval, shift, stok, audit log, dan kontrol akses harus membantu disiplin operasional harian.",
    },
    {
        title: "Kasir butuh layar yang terasa ringan",
        desc: "Interaksi cepat, modal jelas, print yang stabil, dan dukungan tablet/PWA membuat frontline lebih tenang saat jam ramai.",
    },
];

export default function Welcome({ canLogin = true, canRegister = false }) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <>
            <Head title="GTC KASIR" />

            <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
                <div className="absolute inset-x-0 top-0 -z-10 h-[540px] bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_40%),radial-gradient(circle_at_top_right,_rgba(245,158,11,0.14),_transparent_34%),linear-gradient(180deg,_#ffffff,_#f5f7fb)]" />

                <nav className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/82 backdrop-blur-xl">
                    <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4 lg:px-10">
                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-900/10">
                                <IconBuildingStore size={22} />
                            </div>
                            <div>
                                <p className="text-base font-black tracking-[0.18em] text-slate-900 sm:text-lg">
                                    GTC KASIR
                                </p>
                                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                                    Smart Commerce OS
                                </p>
                            </div>
                        </div>

                        <div className="hidden items-center gap-8 lg:flex">
                            <a href="#capabilities" className="text-sm font-medium text-slate-600 transition hover:text-slate-900">
                                Kapabilitas
                            </a>
                            <a href="#workflow" className="text-sm font-medium text-slate-600 transition hover:text-slate-900">
                                Workflow
                            </a>
                            <a href="#industries" className="text-sm font-medium text-slate-600 transition hover:text-slate-900">
                                Kegunaan
                            </a>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() =>
                                    setIsMobileMenuOpen((state) => !state)
                                }
                                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 lg:hidden"
                            >
                                {isMobileMenuOpen ? (
                                    <IconX size={18} />
                                ) : (
                                    <IconMenu2 size={18} />
                                )}
                            </button>
                            {canRegister && (
                                <Link
                                    href="/register"
                                    className="hidden rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 md:inline-flex"
                                >
                                    Daftar
                                </Link>
                            )}
                            {canLogin && (
                                <Link
                                    href="/login"
                                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 sm:px-5"
                                >
                                    Masuk
                                    <IconArrowRight size={16} />
                                </Link>
                            )}
                        </div>
                    </div>

                    {isMobileMenuOpen && (
                        <div className="border-t border-slate-200 bg-white px-4 py-3 lg:hidden">
                            <div className="flex flex-wrap gap-2">
                                {[
                                    ["#capabilities", "Kapabilitas"],
                                    ["#why-switch", "Kenapa Pindah"],
                                    ["#workflow", "Workflow"],
                                    ["#industries", "Kegunaan"],
                                ].map(([href, label]) => (
                                    <a
                                        key={href}
                                        href={href}
                                        onClick={() =>
                                            setIsMobileMenuOpen(false)
                                        }
                                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
                                    >
                                        {label}
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </nav>

                <main>
                    <section className="px-4 pb-14 pt-8 sm:px-6 sm:pb-20 sm:pt-14 lg:px-10 lg:pb-24 lg:pt-20">
                        <div className="mx-auto grid max-w-7xl gap-6 sm:gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12">
                            <div className="animate-rise-in">
                                <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-[11px] font-semibold text-sky-700 sm:px-4 sm:py-2 sm:text-sm">
                                    <IconShieldCheck size={16} />
                                    POS modern untuk operasi toko yang lebih disiplin
                                </div>

                                <h1 className="mt-5 max-w-4xl text-3xl font-black leading-[0.95] tracking-[-0.04em] text-slate-950 sm:mt-6 sm:text-5xl md:mt-7 md:text-6xl xl:text-7xl">
                                    Satu sistem untuk kasir, stok, outlet, dan laporan yang siap dipakai bertumbuh.
                                </h1>

                                <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 sm:mt-7 sm:text-lg sm:leading-8">
                                    GTC KASIR membantu bisnis menjalankan transaksi lebih cepat, operasional lebih rapi, dan kontrol harian yang lebih jelas dalam satu workspace.
                                </p>

                                <div className="mt-6 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:gap-4">
                                    {canLogin && (
                                        <Link
                                            href="/login"
                                            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 sm:w-auto sm:px-7 sm:py-4 sm:text-base"
                                        >
                                            Masuk ke Workspace
                                            <IconArrowRight size={18} />
                                        </Link>
                                    )}
                                    <a
                                        href="#why-switch"
                                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 sm:w-auto sm:px-7 sm:py-4 sm:text-base"
                                    >
                                        Alasan memilih GTC KASIR
                                    </a>
                                </div>

                                <div className="mt-7 grid gap-3 sm:mt-10 sm:grid-cols-2 xl:grid-cols-3 xl:gap-4">
                                    {highlights.map((item) => (
                                        <div
                                            key={item.value}
                                            className="rounded-3xl border border-white/70 bg-white/80 p-4 shadow-[0_20px_60px_-28px_rgba(15,23,42,0.18)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-[0_26px_70px_-30px_rgba(15,23,42,0.22)] sm:p-5"
                                        >
                                            <p className="text-base font-bold text-slate-900">
                                                {item.value}
                                            </p>
                                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                                {item.label}
                                            </p>
                                        </div>
                                    ))}
                                </div>

                                <div className="-mx-1 mt-6 flex gap-2 overflow-x-auto px-1 pb-1 text-xs text-slate-500 [scrollbar-width:none] sm:mt-8 sm:flex-wrap sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0 sm:text-sm [&::-webkit-scrollbar]:hidden">
                                    {trustStrip.map((item) => (
                                        <span
                                            key={item}
                                            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 sm:py-2"
                                        >
                                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="relative animate-rise-in [animation-delay:120ms]">
                                <div className="absolute -left-8 top-10 hidden h-40 w-40 animate-float-slow rounded-full bg-sky-200/50 blur-3xl sm:block" />
                                <div className="absolute bottom-3 right-0 hidden h-36 w-36 animate-float-delayed rounded-full bg-amber-200/60 blur-3xl sm:block" />
                                <div className="absolute right-4 top-4 hidden rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-semibold text-slate-700 shadow-lg shadow-slate-900/10 transition duration-300 hover:-translate-y-0.5 sm:block lg:right-8 lg:top-6">
                                    Outlet aktif: GTC KASIR Flagship
                                </div>

                                <div className="relative overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_32px_90px_-34px_rgba(15,23,42,0.3)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_40px_100px_-36px_rgba(15,23,42,0.34)] sm:rounded-[34px]">
                                    <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/90 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
                                        <div>
                                            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
                                                GTC KASIR Workspace
                                            </p>
                                            <p className="mt-1 text-base font-bold text-slate-900 sm:text-lg">
                                                Commerce, cashier, and outlet control
                                            </p>
                                        </div>
                                        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 sm:px-3 sm:text-xs">
                                            <IconChecks size={14} />
                                            Sync normal
                                        </div>
                                    </div>

                                    <div className="grid gap-4 p-3.5 sm:p-6 lg:grid-cols-[0.92fr_1.08fr]">
                                        <div className="space-y-4">
                                            <div className="rounded-[24px] bg-slate-950 p-4 text-white transition duration-300 hover:-translate-y-1 sm:rounded-[28px] sm:p-5">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                                                            Cashier Today
                                                        </p>
                                                        <p className="mt-2 text-2xl font-black sm:text-3xl">
                                                            Rp 18.450.000
                                                        </p>
                                                        <p className="mt-2 text-sm text-slate-300">
                                                            148 transaksi, 3 outlet aktif, shift pagi masih berjalan.
                                                        </p>
                                                    </div>
                                                    <div className="rounded-2xl bg-white/10 p-3">
                                                        <IconCashBanknote size={24} />
                                                    </div>
                                                </div>

                                                <div className="mt-5 grid grid-cols-3 gap-2 sm:mt-6 sm:gap-3">
                                                    {[
                                                        ["Tunai", "Rp 7,4 jt"],
                                                        ["QR & Gateway", "Rp 8,8 jt"],
                                                        ["Piutang", "Rp 2,2 jt"],
                                                    ].map(([label, value]) => (
                                                        <div
                                                            key={label}
                                                            className="rounded-2xl bg-white/8 px-3 py-2.5 sm:px-4 sm:py-3"
                                                        >
                                                            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400 sm:text-[11px] sm:tracking-[0.18em]">
                                                                {label}
                                                            </p>
                                                            <p className="mt-1.5 text-xs font-semibold text-slate-100 sm:mt-2 sm:text-sm">
                                                                {value}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 transition duration-300 hover:-translate-y-1 sm:hidden">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-900">
                                                            Status Operasional
                                                        </p>
                                                        <p className="text-xs text-slate-500">
                                                            Kasir, kitchen, dan sinkronisasi berjalan rapi
                                                        </p>
                                                    </div>
                                                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                                                        Stabil
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="hidden rounded-[28px] border border-slate-200 bg-slate-50 p-5 transition duration-300 hover:-translate-y-1 sm:block">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-900">
                                                            Kinerja Hari Ini
                                                        </p>
                                                        <p className="text-xs text-slate-500">
                                                            Penjualan, kitchen, dan sinkronisasi outlet
                                                        </p>
                                                    </div>
                                                    <IconChartHistogram size={20} className="text-slate-500" />
                                                </div>
                                                <div className="mt-5 flex h-28 items-end gap-2">
                                                    {[42, 58, 46, 72, 68, 86, 74, 92, 81].map((height, index) => (
                                                        <div
                                                            key={index}
                                                            className="flex-1 rounded-t-2xl bg-gradient-to-t from-slate-900 via-sky-700 to-sky-300"
                                                            style={{ height: `${height}%` }}
                                                        />
                                                    ))}
                                                </div>
                                                <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                                                    <span>08.00</span>
                                                    <span>12.00</span>
                                                    <span>16.00</span>
                                                    <span>20.00</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="hidden rounded-[28px] border border-slate-200 bg-white p-5 transition duration-300 hover:-translate-y-1 sm:block">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-900">
                                                            Monitor Operasional
                                                        </p>
                                                        <p className="text-xs text-slate-500">
                                                            Antrian transaksi, kitchen, dan kesiapan outlet
                                                        </p>
                                                    </div>
                                                    <div className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                                                        4 butuh perhatian
                                                    </div>
                                                </div>

                                                <div className="mt-5 space-y-3">
                                                    {[
                                                        {
                                                            title: "QR meja menunggu kasir",
                                                            detail: "7 order belum dibayar tunai di kasir",
                                                            tag: "Frontline",
                                                        },
                                                        {
                                                            title: "Kitchen routing berjalan",
                                                            detail: "Dapur ayam, ramen, dan minuman online normal",
                                                            tag: "Kitchen",
                                                        },
                                                        {
                                                            title: "Sinkronisasi offline",
                                                            detail: "2 transaksi tunai tersimpan lokal dan siap dikirim",
                                                            tag: "Offline",
                                                        },
                                                    ].map((item) => (
                                                        <div
                                                            key={item.title}
                                                            className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3"
                                                        >
                                                            <div>
                                                                <p className="text-sm font-semibold text-slate-900">
                                                                    {item.title}
                                                                </p>
                                                                <p className="mt-1 text-xs leading-5 text-slate-500">
                                                                    {item.detail}
                                                                </p>
                                                            </div>
                                                            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                                                                {item.tag}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
                                                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 transition duration-300 hover:-translate-y-1 sm:rounded-[28px] sm:p-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="rounded-2xl bg-white p-3 text-slate-900 shadow-sm">
                                                            <IconDeviceMobile size={20} />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-900">
                                                                Tablet Kasir
                                                            </p>
                                                            <p className="text-xs text-slate-500">
                                                                PWA, modal tunai, offline cash
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 transition duration-300 hover:-translate-y-1 sm:rounded-[28px] sm:p-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="rounded-2xl bg-white p-3 text-slate-900 shadow-sm">
                                                            <IconChefHat size={20} />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-900">
                                                                Dapur & Meja
                                                            </p>
                                                            <p className="text-xs text-slate-500">
                                                                QR order dan routing station
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="rounded-[24px] bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_100%)] p-4 text-white transition duration-300 hover:-translate-y-1 sm:rounded-[28px] sm:p-5">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                                                            Multi Outlet Control
                                                        </p>
                                                        <p className="mt-2 text-lg font-bold sm:text-xl">
                                                            3 outlet, 12 staf aktif, 0 anomali shift kritis
                                                        </p>
                                                    </div>
                                                    <div className="rounded-2xl bg-white/10 p-3">
                                                        <IconBuildingStore size={22} />
                                                    </div>
                                                </div>
                                                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                                                    {[
                                                        "Stock per outlet",
                                                        "Shift control",
                                                        "Audit log",
                                                        "Outlet analytics",
                                                    ].map((item) => (
                                                        <span
                                                            key={item}
                                                            className="rounded-full bg-white/10 px-3 py-1.5 font-semibold text-slate-200"
                                                        >
                                                            {item}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section id="capabilities" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20 lg:px-10">
                        <div className="mx-auto max-w-7xl">
                            <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                {stats.map((item) => (
                                    <div
                                        key={item.value}
                                        className="rounded-[28px] border border-slate-200 bg-white px-6 py-5 shadow-[0_20px_50px_-36px_rgba(15,23,42,0.25)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_26px_60px_-34px_rgba(15,23,42,0.24)]"
                                    >
                                        <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
                                            {item.value}
                                        </p>
                                        <p className="mt-3 text-sm leading-7 text-slate-600">
                                            {item.label}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            <div className="mb-10 max-w-3xl">
                                <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-700">
                                    Kapabilitas Inti
                                </p>
                                <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] text-slate-950 sm:text-4xl lg:text-[2.85rem]">
                                    Lebih dari sekadar kasir digital.
                                </h2>
                                <p className="mt-4 text-lg leading-8 text-slate-600">
                                    GTC KASIR menyatukan transaksi, stok, dapur, pelanggan, dan laporan agar operasional tetap konsisten dari kasir sampai owner.
                                </p>
                            </div>

                            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                                {featureGroups.map((group) => (
                                    <div
                                        key={group.title}
                                        className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-[0_22px_60px_-34px_rgba(15,23,42,0.18)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_-34px_rgba(15,23,42,0.22)]"
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-bold text-slate-900">
                                                    {group.title}
                                                </p>
                                                <p className="mt-3 text-sm leading-7 text-slate-600">
                                                    {group.summary}
                                                </p>
                                            </div>
                                            <div className="rounded-2xl bg-slate-950 p-3 text-white">
                                                <group.icon size={22} />
                                            </div>
                                        </div>

                                        <div className="mt-6 space-y-3">
                                            {group.items.map((item) => (
                                                <div
                                                    key={item}
                                                    className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3"
                                                >
                                                    <div className="mt-0.5 rounded-full bg-emerald-100 p-1 text-emerald-700">
                                                        <IconChecks size={14} />
                                                    </div>
                                                    <p className="text-sm leading-6 text-slate-700">
                                                        {item}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    <section
                        id="why-switch"
                        className="scroll-mt-24 border-y border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-4 py-16 sm:px-6 sm:py-20 lg:px-10"
                    >
                        <div className="mx-auto max-w-7xl">
                            <div className="mb-10 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
                                <div>
                                    <p className="text-sm font-bold uppercase tracking-[0.22em] text-amber-700">
                                        Kenapa Pindah
                                    </p>
                                    <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] text-slate-950 sm:text-4xl lg:text-[2.85rem]">
                                        Upgrade terbaik bukan sekadar tampilan.
                                    </h2>
                                </div>
                                <p className="max-w-2xl text-base leading-8 text-slate-600">
                                    Owner biasanya pindah sistem bukan karena bosan, tapi karena operasi mulai bocor: transaksi tidak sinkron dengan stok, tablet kasir tidak nyaman, approval berantakan, atau laporan terlalu lambat dipakai mengambil keputusan.
                                </p>
                            </div>

                            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                                {switchingReasons.map((item, index) => (
                                    <div
                                        key={item.title}
                                        className="rounded-[30px] border border-slate-200 bg-white p-7 shadow-[0_22px_60px_-34px_rgba(15,23,42,0.18)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_-34px_rgba(15,23,42,0.22)]"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white">
                                                0{index + 1}
                                            </span>
                                            <p className="text-lg font-bold leading-tight text-slate-900">
                                                {item.title}
                                            </p>
                                        </div>
                                        <p className="mt-5 text-sm leading-7 text-slate-600">
                                            {item.desc}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    <section id="workflow" className="scroll-mt-24 border-y border-slate-200 bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-10">
                        <div className="mx-auto max-w-7xl">
                            <div className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                                <div className="max-w-3xl">
                                    <p className="text-sm font-bold uppercase tracking-[0.22em] text-amber-700">
                                        Workflow
                                    </p>
                                    <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] text-slate-950 sm:text-4xl lg:text-[2.85rem]">
                                        Dari order ke laporan, alurnya tetap konsisten.
                                    </h2>
                                </div>
                                <p className="max-w-2xl text-base leading-7 text-slate-600">
                                    Bukan UI yang ramai. Yang dibutuhkan kasir dan supervisor adalah kejelasan langkah, kecepatan aksi, dan data yang tetap sinkron.
                                </p>
                            </div>

                            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                                {workflow.map((item) => (
                                    <div
                                        key={item.step}
                                        className="rounded-[28px] bg-slate-950 p-7 text-white transition duration-300 hover:-translate-y-1 hover:bg-slate-900"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-bold tracking-[0.28em] text-slate-400">
                                                {item.step}
                                            </span>
                                            <div className="rounded-2xl bg-white/10 p-3">
                                                <item.icon size={20} />
                                            </div>
                                        </div>
                                        <h3 className="mt-8 text-2xl font-bold leading-tight">
                                            {item.title}
                                        </h3>
                                        <p className="mt-4 text-sm leading-7 text-slate-300">
                                            {item.desc}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-10">
                        <div className="mx-auto max-w-7xl">
                            <div className="mb-10 max-w-3xl">
                                <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-700">
                                    Untuk Tim Inti
                                </p>
                                <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] text-slate-950 sm:text-4xl lg:text-[2.85rem]">
                                    Sistem yang baik membantu setiap peran bekerja lebih tenang.
                                </h2>
                                <p className="mt-4 text-lg leading-8 text-slate-600">
                                    Dari kasir sampai owner, semua butuh tampilan yang jelas, alur yang cepat, dan data yang siap dipakai.
                                </p>
                            </div>

                            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                                {leadershipPoints.map((item) => (
                                    <div
                                        key={item.title}
                                        className="rounded-[30px] border border-slate-200 bg-white p-7 shadow-[0_22px_60px_-34px_rgba(15,23,42,0.18)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_-34px_rgba(15,23,42,0.22)]"
                                    >
                                        <p className="text-lg font-bold leading-tight text-slate-900">
                                            {item.title}
                                        </p>
                                        <p className="mt-4 text-sm leading-7 text-slate-600">
                                            {item.desc}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    <section id="industries" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20 lg:px-10">
                        <div className="mx-auto max-w-7xl">
                            <div className="mb-10 max-w-3xl">
                                <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-700">
                                    Kegunaan
                                </p>
                                <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] text-slate-950 sm:text-4xl lg:text-[2.85rem]">
                                    Cocok untuk bisnis yang ingin operasi lebih rapi dan lebih tenang.
                                </h2>
                            </div>

                            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                                {useCases.map((item) => (
                                    <div
                                        key={item.title}
                                        className="rounded-[28px] border border-slate-200 bg-white p-7 transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_-36px_rgba(15,23,42,0.2)]"
                                    >
                                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-900">
                                            <item.icon size={22} />
                                        </div>
                                        <h3 className="mt-6 text-xl font-bold text-slate-900">
                                            {item.title}
                                        </h3>
                                        <p className="mt-3 text-sm leading-7 text-slate-600">
                                            {item.desc}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    <section className="px-4 pb-16 pt-6 sm:px-6 sm:pb-20 sm:pt-8 lg:px-10">
                        <div className="mx-auto max-w-7xl">
                            <div className="overflow-hidden rounded-[30px] bg-slate-950 px-5 py-8 text-white sm:px-8 sm:py-10 lg:rounded-[36px] lg:px-12 lg:py-14">
                                <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
                                    <div>
                                        <p className="text-sm font-bold uppercase tracking-[0.24em] text-slate-400">
                                            Next Step
                                        </p>
                                        <h2 className="mt-4 max-w-3xl text-3xl font-black leading-tight tracking-[-0.03em] sm:text-4xl lg:text-[2.85rem]">
                                            Jika Anda mencari sistem kasir yang lebih rapi, lebih cepat, dan siap untuk operasional harian, GTC KASIR dibuat ke arah itu.
                                        </h2>
                                        <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
                                            Masuk ke dashboard untuk mulai dari transaksi, outlet, pelanggan, kitchen flow, atau laporan dalam satu workspace kerja.
                                        </p>
                                    </div>

                                    <div className="flex flex-col gap-3 md:max-w-md md:flex-row lg:max-w-none lg:flex-col">
                                        {canLogin && (
                                            <Link
                                                href="/login"
                                                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-7 py-4 text-base font-semibold text-slate-950 transition hover:bg-slate-100 sm:w-auto"
                                            >
                                                Masuk Sekarang
                                                <IconArrowRight size={18} />
                                            </Link>
                                        )}
                                        <a
                                            href="#why-switch"
                                            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-7 py-4 text-base font-semibold text-white transition hover:bg-white/10 sm:w-auto"
                                        >
                                            Pelajari lebih lanjut
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <footer className="border-t border-slate-200 bg-white px-4 py-8 sm:px-6 lg:px-10">
                        <div className="mx-auto flex max-w-7xl flex-col gap-6 text-center lg:flex-row lg:items-center lg:justify-between lg:text-left">
                            <div className="flex items-center justify-center gap-3 lg:justify-start">
                                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
                                    <IconBuildingStore size={18} />
                                </div>
                                <div>
                                    <p className="text-sm font-black tracking-[0.18em] text-slate-900">
                                        GTC KASIR
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        POS modern untuk transaksi, operasional, dan kontrol outlet.
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-500">
                                <a href="#capabilities" className="transition hover:text-slate-900">
                                    Kapabilitas
                                </a>
                                <a href="#workflow" className="transition hover:text-slate-900">
                                    Workflow
                                </a>
                                <a href="#industries" className="transition hover:text-slate-900">
                                    Kegunaan
                                </a>
                            </div>

                            <p className="text-sm text-slate-500">
                                © {new Date().getFullYear()} GTC KASIR. Dibuat untuk operasional toko yang lebih rapi.
                            </p>
                        </div>
                    </footer>
                </main>
            </div>
        </>
    );
}
