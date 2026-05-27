import React from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, Link, useForm, usePage } from "@inertiajs/react";
import Textarea from "@/Components/Dashboard/TextArea";
import Button from "@/Components/Dashboard/Button";
import { IconArrowLeft, IconClipboardCheck } from "@/Utils/icons";
import toast from "react-hot-toast";

export default function Create() {
    const { errors } = usePage().props;
    const { data, setData, post, processing } = useForm({
        notes: "",
    });

    const submit = (event) => {
        event.preventDefault();

        post(route("stock-opnames.store"), {
            onError: () => toast.error("Gagal membuat sesi stock opname"),
        });
    };

    return (
        <>
            <Head title="Buat Stock Opname" />

            <div className="mb-6">
                <Link
                    href={route("stock-opnames.index")}
                    className="mb-3 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary-600"
                >
                    <IconArrowLeft size={16} />
                    Kembali ke daftar stock opname
                </Link>
                <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
                    <IconClipboardCheck size={28} className="text-primary-500" />
                    Buat Sesi Stock Opname
                </h1>
            </div>

            <form onSubmit={submit} className="max-w-3xl">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <Textarea
                        label="Catatan Sesi"
                        placeholder="Contoh: opname bulanan gudang depan"
                        value={data.notes}
                        onChange={(event) => setData("notes", event.target.value)}
                        errors={errors.notes}
                        rows={5}
                    />

                    <div className="mt-5 flex justify-end">
                        <Button
                            type="submit"
                            icon={<IconClipboardCheck size={18} />}
                            className="bg-primary-500 hover:bg-primary-600 text-white shadow-lg shadow-primary-500/30"
                            label={processing ? "Menyimpan..." : "Buat Sesi"}
                            disabled={processing}
                        />
                    </div>
                </div>
            </form>
        </>
    );
}

Create.layout = (page) => <DashboardLayout children={page} />;
