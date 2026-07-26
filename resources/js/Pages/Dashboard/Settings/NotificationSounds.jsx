import { useState, useEffect } from 'react';
import { router, usePage } from '@inertiajs/react';
import { IconBell, IconUpload, IconPlayerPlay, IconTrash, IconCheck, IconX, IconEdit } from '@tabler/icons-react';
import Swal from 'sweetalert2';
import toast from 'react-hot-toast';
import DashboardLayout from '@/Layouts/DashboardLayout';

export default function NotificationSounds() {
    const { props } = usePage();
    const [sounds, setSounds] = useState([]);
    const [types, setTypes] = useState({});
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingSound, setEditingSound] = useState(null);
    const [filterType, setFilterType] = useState('');
    const [selectedOutletId, setSelectedOutletId] = useState(
        props.active_outlet?.id ? String(props.active_outlet.id) : ''
    );

    const [formData, setFormData] = useState({
        name: '',
        type: 'general',
        file: null,
    });

    const [editData, setEditData] = useState({
        name: '',
        type: '',
        sort_order: 0,
    });

    const activeOutlet = props.active_outlet || null;
    const outlets = props.outlets || [];
    const isSuperAdmin = props.is_super_admin || false;

    useEffect(() => {
        fetchSounds();
    }, []);

    useEffect(() => {
        fetchSounds();
    }, [filterType, selectedOutletId]);

    const fetchSounds = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filterType) params.set('type', filterType);
            if (selectedOutletId) params.set('outlet_id', selectedOutletId);

            const url = params.toString()
                ? route('settings.notification-sounds.data') + '?' + params.toString()
                : route('settings.notification-sounds.data');

            const response = await fetch(url);
            const data = await response.json();

            if (data.success) {
                setSounds(data.data);
                setTypes(data.types);
            }
        } catch (error) {
            toast.error('Gagal memuat daftar suara');
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Auto-fill name from filename if empty
            if (!formData.name) {
                const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
                setFormData(prev => ({ 
                    ...prev, 
                    file,
                    name: nameWithoutExt.replace(/[-_]/g, ' ')
                }));
            } else {
                setFormData(prev => ({ ...prev, file }));
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.name || !formData.type || !formData.file) {
            toast.error('Lengkapi semua field yang diperlukan');
            return;
        }

        setUploading(true);
        
        router.post(route('settings.notification-sounds.store'), {
            name: formData.name,
            type: formData.type,
            file: formData.file,
            replace_existing: true,
            outlet_id: selectedOutletId ? Number(selectedOutletId) : undefined,
        }, {
            forceFormData: true,
            replace: true,
            onSuccess: () => {
                toast.success('Suara berhasil diupload');
                setShowUploadModal(false);
                setFormData({ name: '', type: 'general', file: null });
                fetchSounds();
            },
            onError: (errors) => {
                const firstError = Object.values(errors).flat()[0];
                toast.error(firstError || 'Gagal upload suara');
            },
            onFinish: () => {
                setUploading(false);
            },
        });
    };

    const handleSetActive = async (sound) => {
        router.patch(route('settings.notification-sounds.set-active', { sound: sound.id }), {}, {
            onSuccess: () => {
                toast.success("Suara aktif berhasil diubah");
                fetchSounds();
            },
            onError: () => {
                toast.error('Gagal mengatur suara aktif');
            },
        });
    };

    const handleDelete = async (sound) => {
        const result = await Swal.fire({
            title: 'Hapus Suara?',
            text: `Yakin ingin menghapus "${sound.name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'Ya, Hapus',
            cancelButtonText: 'Batal',
        });

        if (!result.isConfirmed) return;

        router.delete(route('settings.notification-sounds.destroy', { sound: sound.id }), {
            onSuccess: () => {
                toast.success('Suara berhasil dihapus');
                fetchSounds();
            },
            onError: () => {
                toast.error('Gagal menghapus suara');
            },
        });
    };

    const handlePlay = (sound) => {
        const audio = new Audio(sound.url);
        audio.volume = 1;
        audio.play().catch(err => {
            toast.error('Tidak dapat memutar audio');
        });
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        
        if (!editData.name || !editData.type) {
            toast.error('Lengkapi semua field yang diperlukan');
            return;
        }

        setUploading(true);

        try {
            const response = await fetch(route('settings.notification-sounds.update', { sound: editingSound.id }), {
                method: 'PUT',
                body: JSON.stringify({
                    name: editData.name,
                    type: editData.type,
                    sort_order: editData.sort_order,
                }),
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();

            if (data.success) {
                toast.success(data.message || 'Suara berhasil diperbarui');
                setShowEditModal(false);
                setEditingSound(null);
                fetchSounds();
            } else {
                toast.error(data.message || 'Gagal update suara');
            }
        } catch (error) {
            toast.error('Terjadi kesalahan saat update');
        } finally {
            setUploading(false);
        }
    };

    const groupedSounds = sounds.reduce((acc, sound) => {
        if (!acc[sound.type]) {
            acc[sound.type] = [];
        }
        acc[sound.type].push(sound);
        return acc;
    }, {});

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Suara Notifikasi
                        </h1>
                        {activeOutlet && (
                            <span className="inline-flex w-fit items-center rounded-full bg-primary-100 px-2.5 py-1 text-xs font-medium text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                                {activeOutlet.name} {activeOutlet.code ? `(${activeOutlet.code})` : ''}
                            </span>
                        )}
                    </div>
                    <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {activeOutlet
                                ? `Kelola suara notifikasi untuk outlet ${activeOutlet.name}. Suara global juga ditampilkan sebagai fallback.`
                                : 'Kelola suara notifikasi global untuk berbagai jenis event'}
                        </p>

                        {isSuperAdmin && outlets.length > 0 && (
                            <select
                                value={selectedOutletId}
                                onChange={(e) => setSelectedOutletId(e.target.value)}
                                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            >
                                <option value="">Semua Outlet / Global</option>
                                {outlets.map((outlet) => (
                                    <option key={outlet.id} value={String(outlet.id)}>
                                        {outlet.name} {outlet.code ? `(${outlet.code})` : ''} {outlet.outlet_type === 'tenant' ? '[Tenant]' : ''}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>
                
                <button
                    onClick={() => setShowUploadModal(true)}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
                >
                    <IconUpload size={18} />
                    Upload Suara Baru
                </button>
            </div>

            {/* Filters */}
            <div className="mb-6 flex flex-wrap gap-2">
                <button
                    onClick={() => setFilterType('')}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                        filterType === ''
                            ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                >
                    Semua
                </button>
                {Object.entries(types).map(([key, label]) => (
                    <button
                        key={key}
                        onClick={() => setFilterType(key)}
                        className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                            filterType === key
                                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Loading State */}
            {loading && (
                <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600"></div>
                </div>
            )}

            {/* Sound Groups */}
            {!loading && Object.keys(groupedSounds).length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center dark:border-slate-700 dark:bg-slate-900/50">
                    <IconBell size={48} className="mx-auto mb-4 text-slate-400" />
                    <p className="text-slate-500 dark:text-slate-400">
                        Belum ada suara notifikasi. Upload suara pertama Anda!
                    </p>
                </div>
            )}

            {!loading && Object.entries(groupedSounds).map(( [type, typeSounds]) => (
                <div key={type} className="mb-8">
                    <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-200">
                        {types[type] || type}
                    </h2>
                    
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {typeSounds.map((sound) => (
                            <div
                                key={sound.id}
                                className={`rounded-xl border p-4 transition ${
                                    sound.is_active
                                        ? 'border-primary-300 bg-primary-50 dark:border-primary-700 dark:bg-primary-900/20'
                                        : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
                                }`}
                            >
                                <div className="mb-3 flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-medium text-slate-900 dark:text-white">
                                                {sound.name}
                                            </h3>
                                            {sound.is_global && (
                                                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                    Global
                                                </span>
                                            )}
                                            {!sound.is_global && sound.outlet_name && (
                                                <span className="inline-flex items-center rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                                                    {sound.outlet_name}
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                            {sound.original_name || sound.file_path.split('/').pop()} • {sound.file_size_human}
                                        </p>
                                    </div>
                                    
                                    {sound.is_active && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                                            <IconCheck size={12} />
                                            Aktif
                                        </span>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handlePlay(sound)}
                                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                                    >
                                        <IconPlayerPlay size={16} />
                                        Putar
                                    </button>
                                    
                                    {!sound.is_active && (
                                        <button
                                            onClick={() => handleSetActive(sound)}
                                            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
                                        >
                                            <IconCheck size={16} />
                                            Aktifkan
                                        </button>
                                    )}
                                    
                                    <button
                                        onClick={() => {
                                            setEditingSound(sound);
                                            setEditData({
                                                name: sound.name,
                                                type: sound.type,
                                                sort_order: sound.sort_order || 0,
                                            });
                                            setShowEditModal(true);
                                        }}
                                        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                                    >
                                        <IconEdit size={16} />
                                    </button>
                                    
                                    <button
                                        onClick={() => handleDelete(sound)}
                                        className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:border-rose-800 dark:bg-slate-800 dark:text-rose-400 dark:hover:bg-rose-900/20"
                                    >
                                        <IconTrash size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                Upload Suara Baru
                            </h2>
                            <button
                                onClick={() => {
                                    setShowUploadModal(false);
                                    setFormData({ name: '', type: 'general', file: null });
                                }}
                                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <IconX size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Nama Suara
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                    placeholder="Contoh: Notifikasi Cashier"
                                    required
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Tipe Suara
                                </label>
                                <select
                                    value={formData.type}
                                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                    required
                                >
                                    {Object.entries(types).map(([key, label]) => (
                                        <option key={key} value={key}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    File Audio
                                </label>
                                <div className="rounded-lg border-2 border-dashed border-slate-300 p-6 text-center transition hover:border-primary-400 dark:border-slate-700">
                                    <input
                                        type="file"
                                        accept="audio/mp3,audio/wav,audio/ogg,audio/webm"
                                        onChange={handleFileChange}
                                        className="hidden"
                                        id="sound-file"
                                        required
                                    />
                                    <label
                                        htmlFor="sound-file"
                                        className="cursor-pointer"
                                    >
                                        {formData.file ? (
                                            <div>
                                                <p className="font-medium text-primary-600">{formData.file.name}</p>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    {(formData.file.size / 1024 / 1024).toFixed(2)} MB
                                                </p>
                                            </div>
                                        ) : (
                                            <div>
                                                <IconUpload className="mx-auto mb-2 text-slate-400" size={32} />
                                                <p className="text-sm text-slate-500">
                                                    Klik untuk pilih file audio
                                                </p>
                                                <p className="mt-1 text-xs text-slate-400">
                                                    MP3, WAV, OGG, WebM (max 5MB)
                                                </p>
                                            </div>
                                        )}
                                    </label>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowUploadModal(false);
                                        setFormData({ name: '', type: 'general', file: null });
                                    }}
                                    className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={uploading}
                                    className="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-50"
                                >
                                    {uploading ? 'Mengupload...' : 'Upload'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && editingSound && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                Edit Suara
                            </h2>
                            <button
                                onClick={() => {
                                    setShowEditModal(false);
                                    setEditingSound(null);
                                }}
                                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <IconX size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleEditSubmit} className="space-y-4">
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Nama Suara
                                </label>
                                <input
                                    type="text"
                                    value={editData.name}
                                    onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                    placeholder="Nama suara"
                                    required
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Tipe Suara
                                </label>
                                <select
                                    value={editData.type}
                                    onChange={(e) => setEditData(prev => ({ ...prev, type: e.target.value }))}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                    required
                                >
                                    {Object.entries(types).map(([key, label]) => (
                                        <option key={key} value={key}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Urutan (Sort Order)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={editData.sort_order}
                                    onChange={(e) => setEditData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowEditModal(false);
                                        setEditingSound(null);
                                    }}
                                    className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={uploading}
                                    className="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-50"
                                >
                                    {uploading ? 'Menyimpan...' : 'Simpan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

NotificationSounds.layout = (page) => <DashboardLayout children={page} />;
