import { sanitizePhoneNumber } from "../utils/tableOrderHelpers";

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
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
                {!pendingPhone ? (
                    <>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-600">
                            Self Order
                        </p>
                        <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-slate-950">
                            Masukkan nomor HP
                        </h2>
                        <p className="mt-1 text-xs font-medium text-slate-400">
                            Meja {table.code || table.name}
                        </p>

                        <form onSubmit={submitIdentify} className="mt-5 space-y-4">
                            <div>
                                <input
                                    ref={identifyPhoneInputRef}
                                    type="text"
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
                                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
                                />
                                {identifyForm.errors.no_telp && (
                                    <p className="mt-2 text-sm text-rose-600">
                                        {identifyForm.errors.no_telp}
                                    </p>
                                )}
                            </div>
                            <button
                                type="submit"
                                disabled={identifyForm.processing}
                                className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-primary-500 px-5 text-sm font-semibold text-white shadow-lg shadow-primary-500/20 disabled:opacity-50"
                            >
                                {identifyForm.processing ? "Memeriksa nomor..." : "Masuk ke POS Self Order"}
                            </button>
                        </form>
                    </>
                ) : (
                    <>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-600">
                            Lengkapi Profil
                        </p>
                        <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-slate-950">
                            Nomor belum terdaftar
                        </h2>
                        <p className="mt-1 text-xs font-medium text-slate-400">
                            Nomor: {pendingPhone}
                        </p>

                        <form onSubmit={submitRegister} className="mt-5 space-y-4">
                            <div>
                                <input
                                    ref={registerNameInputRef}
                                    type="text"
                                    value={registerForm.data.name}
                                    onChange={(e) =>
                                        registerForm.setData("name", e.target.value)
                                    }
                                    placeholder="Nama pelanggan"
                                    autoComplete="name"
                                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
                                />
                                {registerForm.errors.name && (
                                    <p className="mt-2 text-sm text-rose-600">
                                        {registerForm.errors.name}
                                    </p>
                                )}
                            </div>
                            <button
                                type="submit"
                                disabled={registerForm.processing}
                                className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-primary-500 px-5 text-sm font-semibold text-white shadow-lg shadow-primary-500/20 disabled:opacity-50"
                            >
                                {registerForm.processing ? "Menyimpan profil..." : "Masuk dan mulai order"}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
