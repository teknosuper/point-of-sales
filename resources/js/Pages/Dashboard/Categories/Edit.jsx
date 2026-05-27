import React, { useState } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, useForm, usePage, Link } from "@inertiajs/react";
import Input from "@/Components/Dashboard/Input";
import Textarea from "@/Components/Dashboard/TextArea";
import toast from "react-hot-toast";
import {
    IconCategory,
    IconDeviceFloppy,
    IconArrowLeft,
    IconPhoto,
} from "@/Utils/icons";
import {
    categoryPlaceholderDataUri,
    resolveCategoryImageSrc,
} from "@/Utils/imagePlaceholder";

const IMAGE_MAX_SIZE = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
];

export default function Edit({ category }) {
    const { errors } = usePage().props;

    const { data, setData, post, processing } = useForm({
        id: category.id,
        name: category.name,
        description: category.description,
        image: "",
        _method: "PUT",
    });

    const [imagePreview, setImagePreview] = useState(
        resolveCategoryImageSrc(category.image, category.name)
    );
    const [localErrors, setLocalErrors] = useState({});
    const [selectedImageName, setSelectedImageName] = useState("");

    const handleImageChange = (e) => {
        const file = e.target.files[0];

        if (!file) {
            setData("image", "");
            setSelectedImageName("");
            setLocalErrors((current) => ({ ...current, image: "" }));
            return;
        }

        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
            setData("image", "");
            setSelectedImageName("");
            setLocalErrors((current) => ({
                ...current,
                image: "Format gambar harus jpeg, jpg, png, atau webp.",
            }));
            return;
        }

        if (file.size > IMAGE_MAX_SIZE) {
            setData("image", "");
            setSelectedImageName("");
            setLocalErrors((current) => ({
                ...current,
                image: "Ukuran gambar maksimal 2MB.",
            }));
            return;
        }

        setLocalErrors((current) => ({ ...current, image: "" }));
        setSelectedImageName(file.name);
        setData("image", file);
        setImagePreview(URL.createObjectURL(file));
    };

    const submit = (e) => {
        e.preventDefault();

        const nextErrors = {};

        if (!String(data.name || "").trim()) {
            nextErrors.name = "Nama kategori wajib diisi.";
        }

        if (!String(data.description || "").trim()) {
            nextErrors.description = "Deskripsi kategori wajib diisi.";
        }

        if (data.image && !selectedImageName) {
            nextErrors.image = "File gambar belum valid.";
        }

        setLocalErrors(nextErrors);

        if (Object.keys(nextErrors).length > 0) {
            toast.error("Periksa kembali form kategori.");
            return;
        }

        post(route("categories.update", category.id), {
            forceFormData: true,
            onSuccess: () => toast.success("Kategori berhasil diperbarui"),
            onError: () => toast.error("Gagal memperbarui kategori"),
        });
    };

    return (
        <>
            <Head title="Edit Kategori" />

            <div className="mb-6">
                <Link
                    href={route("categories.index")}
                    className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary-600 mb-3"
                >
                    <IconArrowLeft size={16} />
                    Kembali ke Kategori
                </Link>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <IconCategory size={28} className="text-primary-500" />
                    Edit Kategori
                </h1>
                <p className="text-sm text-slate-500 mt-1">{category.name}</p>
            </div>

            <form onSubmit={submit}>
                <div className="max-w-2xl">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                                    <IconPhoto size={16} />
                                    Gambar
                                </h3>
                                <div className="aspect-video rounded-xl bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center overflow-hidden mb-3">
                                    {imagePreview ? (
                                        <img
                                            src={imagePreview}
                                            alt="Preview"
                                            className="w-full h-full object-cover"
                                            onError={() =>
                                                setImagePreview(
                                                    categoryPlaceholderDataUri(
                                                        data.name || category.name
                                                    )
                                                )
                                            }
                                        />
                                    ) : (
                                        <IconPhoto
                                            size={32}
                                            className="text-slate-400"
                                        />
                                    )}
                                </div>
                                <Input
                                    type="file"
                                    onChange={handleImageChange}
                                    errors={localErrors.image || errors.image}
                                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                                />
                                <div className="mt-2 space-y-1 text-xs text-slate-500">
                                    <p>
                                        {selectedImageName
                                            ? `File baru: ${selectedImageName}`
                                            : "Belum memilih gambar baru. Gambar lama tetap dipakai."}
                                    </p>
                                    <p>Format: JPG, PNG, WEBP. Maksimal 2MB.</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <Input
                                    type="text"
                                    label="Nama Kategori"
                                    placeholder="Masukkan nama"
                                    errors={localErrors.name || errors.name}
                                    onChange={(e) =>
                                        setData("name", e.target.value)
                                    }
                                    value={data.name}
                                />
                                <Textarea
                                    label="Deskripsi"
                                    placeholder="Deskripsi kategori"
                                    errors={
                                        localErrors.description ||
                                        errors.description
                                    }
                                    onChange={(e) =>
                                        setData("description", e.target.value)
                                    }
                                    value={data.description}
                                    rows={4}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                            <Link
                                href={route("categories.index")}
                                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors"
                            >
                                Batal
                            </Link>
                            <button
                                type="submit"
                                disabled={processing}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors disabled:opacity-50"
                            >
                                <IconDeviceFloppy size={18} />
                                {processing
                                    ? "Menyimpan..."
                                    : "Simpan Perubahan"}
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </>
    );
}

Edit.layout = (page) => <DashboardLayout children={page} />;
