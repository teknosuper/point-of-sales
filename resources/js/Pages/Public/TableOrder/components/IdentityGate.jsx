import { sanitizePhoneNumber } from "../utils/tableOrderHelpers";
import {
    IconArrowRight,
    IconLoader2,
    IconPhone,
    IconShoppingBag,
    IconUser,
} from "@/Utils/icons";

export default function IdentityGate({
    customer,
    pendingPhone,
    table,
    identifyForm,
    registerForm,
    submitIdentify,
    submitRegister,
    identifyPhoneInputRef,
    registerNameInputRef,
}) {
    if (customer) return null;

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.24),_transparent_36%),rgba(15,23,42,0.78)] px-4 py-6 backdrop-blur-md">
            <div className="w-full max-w-sm overflow-hidden rounded-[26px] border border-white/70 bg-white/95 p-5 shadow-[0_30px_80px_-32px_rgba(15,23,42,0.75)] backdrop-blur-xl sm:p-6">
                {!pendingPhone ? (
                    <>
                        <div className="text-center">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 ring-1 ring-primary-100">
                                <IconShoppingBag size={24} strokeWidth={1.8} />
                            </div>
                            <span className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">
                                Meja {table.code || table.name}
                            </span>
                            <h2 className="mt-3 text-xl font-bold tracking-[-0.02em] text-slate-950">
                                Masukkan nomor HP
                            </h2>
                        </div>

                        <form onSubmit={submitIdentify} className="mt-5 space-y-3.5">
                            <div>
                                <label className="mb-2 block text-xs font-semibold text-slate-600">
                                    Nomor HP
                                </label>
                                <div className="relative">
                                    <IconPhone
                                        size={19}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                                    />
                                    <input
                                        ref={identifyPhoneInputRef}
                                        type="tel"
                                        value={identifyForm.data.no_telp}
                                        onChange={(e) =>
                                            identifyForm.setData(
                                                "no_telp",
                                                sanitizePhoneNumber(e.target.value)
                                            )
                                        }
                                        placeholder="08xxxxxxxxxx"
                                        inputMode="numeric"
                                        autoComplete="tel"
                                        className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-base font-semibold tracking-wide text-slate-900 outline-none transition placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400 focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-100"
                                    />
                                </div>
                                {identifyForm.errors.no_telp && (
                                    <p className="mt-2 text-xs font-medium text-rose-600">
                                        {identifyForm.errors.no_telp}
                                    </p>
                                )}
                            </div>
                            <button
                                type="submit"
                                disabled={identifyForm.processing || !identifyForm.data.no_telp}
                                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-500 to-primary-600 px-5 text-sm font-semibold text-white shadow-lg shadow-primary-500/25 transition hover:from-primary-600 hover:to-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {identifyForm.processing ? (
                                    <>
                                        <IconLoader2 size={18} className="animate-spin" />
                                        Memeriksa...
                                    </>
                                ) : (
                                    <>
                                        Lanjutkan
                                        <IconArrowRight size={18} />
                                    </>
                                )}
                            </button>
                        </form>
                    </>
                ) : (
                    <>
                        <div className="text-center">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 ring-1 ring-primary-100">
                                <IconUser size={24} strokeWidth={1.8} />
                            </div>
                            <span className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                                {pendingPhone}
                            </span>
                            <h2 className="mt-3 text-xl font-bold tracking-[-0.02em] text-slate-950">
                                Isi nama Anda
                            </h2>
                        </div>

                        <form onSubmit={submitRegister} className="mt-5 space-y-3.5">
                            <div>
                                <label className="mb-2 block text-xs font-semibold text-slate-600">
                                    Nama pelanggan
                                </label>
                                <div className="relative">
                                    <IconUser
                                        size={19}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                                    />
                                    <input
                                        ref={registerNameInputRef}
                                        type="text"
                                        value={registerForm.data.name}
                                        onChange={(e) =>
                                            registerForm.setData("name", e.target.value)
                                        }
                                        placeholder="Nama Anda"
                                        autoComplete="name"
                                        className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-base font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-100"
                                    />
                                </div>
                                {registerForm.errors.name && (
                                    <p className="mt-2 text-xs font-medium text-rose-600">
                                        {registerForm.errors.name}
                                    </p>
                                )}
                            </div>
                            <button
                                type="submit"
                                disabled={registerForm.processing || !registerForm.data.name.trim()}
                                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-500 to-primary-600 px-5 text-sm font-semibold text-white shadow-lg shadow-primary-500/25 transition hover:from-primary-600 hover:to-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {registerForm.processing ? (
                                    <>
                                        <IconLoader2 size={18} className="animate-spin" />
                                        Menyimpan...
                                    </>
                                ) : (
                                    <>
                                        Mulai Pesan
                                        <IconArrowRight size={18} />
                                    </>
                                )}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
