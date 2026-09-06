import { IconX } from "@/Utils/icons";

export default function StoreClosedOverlay({ storeHours }) {
    if (!storeHours) return null;
    if (!storeHours.is_permanently_closed && storeHours.is_open !== false) return null;

    return (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-[28px] bg-white p-8 text-center shadow-2xl">
                <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${storeHours.is_permanently_closed ? "bg-slate-100 text-slate-500" : "bg-rose-100 text-rose-500"}`}>
                    <IconX size={28} />
                </div>
                <h2 className="text-xl font-bold text-slate-900">
                    {storeHours.is_permanently_closed ? "Outlet Tutup" : "Sedang Tutup"}
                </h2>
                {!storeHours.is_permanently_closed && (
                    <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500">Buka</span>
                            <span className="font-semibold text-slate-800">{storeHours.open_time || "08:00"}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-4">
                            <span className="text-slate-500">Tutup</span>
                            <span className="font-semibold text-slate-800">{storeHours.close_time || "22:00"}</span>
                        </div>
                        {storeHours.notes && (
                            <p className="mt-3 border-t border-slate-200 pt-3 text-xs text-slate-500">
                                {storeHours.notes}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
