import { useState, useEffect, useMemo } from 'react';
import { router, usePage } from '@inertiajs/react';
import {
    IconBell, IconUpload, IconPlayerPlay, IconTrash, IconCheck,
    IconX, IconEdit, IconAlertCircle, IconInfoCircle, IconVolume,
    IconSpeakerphone, IconSettings, IconClock,
} from '@tabler/icons-react';
import Swal from 'sweetalert2';
import toast from 'react-hot-toast';
import DashboardLayout from '@/Layouts/DashboardLayout';

const SCOPE_LABELS = {
    station: 'Station',
    outlet: 'Outlet',
    global: 'Global',
};

const SCOPE_COLORS = {
    station: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    outlet: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    global: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

const SCOPE_RING = {
    station: 'border-blue-300 dark:border-blue-700',
    outlet: 'border-amber-300 dark:border-amber-700',
    global: 'border-slate-200 dark:border-slate-700',
};

const TYPE_ICONS = {
    new_order: IconBell,
    print_pending: IconSpeakerphone,
    print_failed: IconAlertCircle,
    print_success: IconCheck,
    reminder: IconBell,
    error: IconAlertCircle,
    general: IconVolume,
};

function PosReminderSetting() {
    const [minutes, setMinutes] = useState(2);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(route('settings.pos-reminder.get'), {
            credentials: 'include',
            headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' },
        })
            .then(r => r.json())
            .then(data => {
                if (data.success) setMinutes(data.data.remind_minutes);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const xsrfToken = document.cookie
                .split('; ')
                .find(row => row.startsWith('XSRF-TOKEN='))
                ?.split('=')[1];

            const response = await fetch(route('settings.pos-reminder.update'), {
                method: 'PUT',
                credentials: 'include',
                body: JSON.stringify({ remind_minutes: minutes }),
                headers: {
                    'X-XSRF-TOKEN': xsrfToken ? decodeURIComponent(xsrfToken) : '',
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
            });
            const data = await response.json();
            if (data.success) {
                toast.success(data.message || 'Pengingat POS berhasil disimpan');
            } else {
                toast.error(data.message || 'Gagal menyimpan');
            }
        } catch {
            toast.error('Gagal menyimpan pengingat POS');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return null;

    return (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-2">
                <IconClock size={20} className="text-slate-600 dark:text-slate-400" />
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                    Pengingat POS — Printer Gagal Cetak
                </h2>
            </div>
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
                Atur berapa lama (dalam menit) pengingat "Ingatkan Nanti" ditampilkan kembali setelah ditutup di halaman kasir.
            </p>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Interval pengingat
                    </label>
                    <div className="flex items-center gap-1.5">
                        <input
                            type="number"
                            min="1"
                            max="60"
                            step="1"
                            value={minutes}
                            onChange={(e) => setMinutes(Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))}
                            className="w-20 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-center focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                        <span className="text-xs text-slate-500 dark:text-slate-400">menit</span>
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-50"
                >
                    {saving ? (
                        <>
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
                            Menyimpan...
                        </>
                    ) : (
                        'Simpan'
                    )}
                </button>
            </div>
        </div>
    );
}

export default function NotificationSounds() {
    const { props } = usePage();
    const [sounds, setSounds] = useState([]);
    const [types, setTypes] = useState({});
    const [effectiveActive, setEffectiveActive] = useState({});
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingSound, setEditingSound] = useState(null);
    const [filterType, setFilterType] = useState('');
    const [selectedStationId, setSelectedStationId] = useState('');
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

    const [soundConfigs, setSoundConfigs] = useState([]);
    const [savingConfigs, setSavingConfigs] = useState(false);

    const activeOutlet = props.active_outlet || null;
    const outlets = props.outlets || [];
    const stations = props.stations || [];
    const isSuperAdmin = props.is_super_admin || false;

    useEffect(() => {
        fetchSounds();
    }, [filterType, selectedStationId, selectedOutletId]);

    useEffect(() => {
        fetchSoundConfigs();
    }, []);

    const fetchSoundConfigs = async () => {
        try {
            const response = await fetch(route('settings.kitchen-sound-configs.index'));
            const data = await response.json();
            if (data.success) {
                setSoundConfigs(data.data);
            }
        } catch (error) {
            console.error('Failed to load sound configs:', error);
        }
    };

    const handleSaveConfigs = async () => {
        setSavingConfigs(true);
        try {
            const xsrfToken = document.cookie
                .split('; ')
                .find(row => row.startsWith('XSRF-TOKEN='))
                ?.split('=')[1];

            const response = await fetch(route('settings.kitchen-sound-configs.update'), {
                method: 'PUT',
                credentials: 'include',
                body: JSON.stringify({ configs: soundConfigs }),
                headers: {
                    'X-XSRF-TOKEN': xsrfToken ? decodeURIComponent(xsrfToken) : '',
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
            });
            const data = await response.json();
            if (data.success) {
                toast.success(data.message || 'Konfigurasi berhasil disimpan');
            } else {
                toast.error(data.message || 'Gagal menyimpan konfigurasi');
            }
        } catch (error) {
            toast.error('Gagal menyimpan konfigurasi');
        } finally {
            setSavingConfigs(false);
        }
    };

    const updateSoundConfig = (eventType, field, value) => {
        setSoundConfigs(prev => prev.map(c =>
            c.event_type === eventType ? { ...c, [field]: value } : c
        ));
    };

    const fetchSounds = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filterType) params.set('type', filterType);
            if (selectedStationId) params.set('station_id', selectedStationId);
            else if (selectedOutletId && isSuperAdmin) params.set('outlet_id', selectedOutletId);

            const url = params.toString()
                ? route('settings.notification-sounds.data') + '?' + params.toString()
                : route('settings.notification-sounds.data');

            const response = await fetch(url);
            const data = await response.json();

            if (data.success) {
                setSounds(data.data);
                setTypes(data.types);
                setEffectiveActive(data.effective_active || {});
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

        const payload = {
            name: formData.name,
            type: formData.type,
            file: formData.file,
            replace_existing: true,
        };
        if (selectedStationId) {
            payload.station_id = Number(selectedStationId);
        }

        router.post(route('settings.notification-sounds.store'), payload, {
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
        audio.play().catch(() => {
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
            const xsrfToken = document.cookie
                .split('; ')
                .find(row => row.startsWith('XSRF-TOKEN='))
                ?.split('=')[1];

            const response = await fetch(route('settings.notification-sounds.update', { sound: editingSound.id }), {
                method: 'PUT',
                credentials: 'include',
                body: JSON.stringify({
                    name: editData.name,
                    type: editData.type,
                    sort_order: editData.sort_order,
                }),
                headers: {
                    'X-XSRF-TOKEN': xsrfToken ? decodeURIComponent(xsrfToken) : '',
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

    // Group sounds by scope within each type
    const groupedByScope = useMemo(() => {
        const result = {};
        for (const sound of sounds) {
            const scope = sound.scope || 'global';
            if (!result[scope]) result[scope] = [];
            result[scope].push(sound);
        }
        return result;
    }, [sounds]);

    const selectedStation = stations.find(s => String(s.id) === String(selectedStationId));

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
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        Kelola suara notifikasi per dapur. Suara yang belum di-upload di station akan mengikuti suara outlet, lalu global.
                    </p>
                </div>

                <button
                    onClick={() => setShowUploadModal(true)}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
                >
                    <IconUpload size={18} />
                    Upload Suara Baru
                </button>
            </div>

            {/* Station Selector + Outlet Selector */}
            <div className="mb-6 flex flex-wrap items-center gap-3">
                {stations.length > 0 && (
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Dapur:
                        </label>
                        <select
                            value={selectedStationId}
                            onChange={(e) => setSelectedStationId(e.target.value)}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        >
                            <option value="">Semua Dapur</option>
                            {stations.map((station) => (
                                <option key={station.id} value={String(station.id)}>
                                    {station.name} {station.code ? `(${station.code})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {isSuperAdmin && outlets.length > 0 && !selectedStationId && (
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Outlet:
                        </label>
                        <select
                            value={selectedOutletId}
                            onChange={(e) => setSelectedOutletId(e.target.value)}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        >
                            <option value="">Global (Semua Outlet)</option>
                            {outlets.map((outlet) => (
                                <option key={outlet.id} value={String(outlet.id)}>
                                    {outlet.name} {outlet.code ? `(${outlet.code})` : ''} {outlet.outlet_type === 'tenant' ? '[Tenant]' : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* Fallback Chain Info */}
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
                <div className="flex items-start gap-2">
                    <IconInfoCircle size={18} className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
                    <div className="text-sm text-blue-800 dark:text-blue-200">
                        <span className="font-semibold">Urutan prioritas suara:</span>{' '}
                        <span className="inline-flex items-center gap-1">
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">Station</span>
                            →
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Outlet</span>
                            →
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">Global</span>
                            → Sound bawaan sistem
                        </span>
                        {selectedStation && (
                            <span className="mt-1 block text-xs text-blue-600 dark:text-blue-400">
                                {selectedStation.name}: Jika ada suara aktif di station ini, suara itu yang dipakai. Jika tidak, fallback ke outlet, lalu global.
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Interval Pengingat Configuration */}
            {!loading && soundConfigs.length > 0 && (
                <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
                    <div className="mb-4 flex items-center gap-2">
                        <IconSettings size={20} className="text-slate-600 dark:text-slate-400" />
                        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                            Konfigurasi Interval Pengingat
                        </h2>
                    </div>
                    <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
                        Aktifkan dan atur interval (dalam detik) untuk suara pengingat berulang.
                        Jika diaktifkan, suara akan berulang tiap N detik selama kondisi masih ada (belum diproses/diperbaiki).
                    </p>

                    <div className="space-y-3">
                        {soundConfigs.map((config) => (
                            <div
                                key={config.event_type}
                                className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700 dark:bg-slate-800/50"
                            >
                                <div className="flex items-center gap-3">
                                    <IconClock size={18} className="shrink-0 text-slate-500 dark:text-slate-400" />
                                    <div>
                                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                            {config.event_label}
                                        </span>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {config.event_type === 'print_failed' && 'Suara berulang jika ada cetak gagal yang belum diperbaiki'}
                                            {config.event_type === 'print_pending' && 'Suara berulang jika ada pesanan menunggu cetak ke printer'}
                                            {config.event_type === 'print_reminder' && 'Suara berulang jika sudah dicetak tapi belum diproses di dapur'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    {/* Toggle */}
                                    <button
                                        onClick={() => updateSoundConfig(config.event_type, 'is_enabled', !config.is_enabled)}
                                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
                                            config.is_enabled
                                                ? 'bg-primary-600'
                                                : 'bg-slate-300 dark:bg-slate-600'
                                        }`}
                                    >
                                        <span
                                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                                config.is_enabled ? 'translate-x-5' : 'translate-x-0'
                                            }`}
                                        />
                                    </button>

                                    {/* Interval input */}
                                    <div className="flex items-center gap-1.5">
                                        <input
                                            type="number"
                                            min="5"
                                            max="3600"
                                            step="5"
                                            value={config.interval_seconds}
                                            onChange={(e) => updateSoundConfig(config.event_type, 'interval_seconds', parseInt(e.target.value) || 0)}
                                            disabled={!config.is_enabled}
                                            className={`w-20 rounded-lg border px-2.5 py-1.5 text-sm text-center focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white ${
                                                !config.is_enabled
                                                    ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500'
                                                    : 'border-slate-300'
                                            }`}
                                        />
                                        <span className="text-xs text-slate-500 dark:text-slate-400">dtk</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 flex justify-end">
                        <button
                            onClick={handleSaveConfigs}
                            disabled={savingConfigs}
                            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-50"
                        >
                            {savingConfigs ? (
                                <>
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
                                    Menyimpan...
                                </>
                            ) : (
                                'Simpan Konfigurasi'
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* POS Reminder Interval */}
            {!loading && (
                <PosReminderSetting />
            )}

            {/* Loading State */}
            {loading && (
                <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600"></div>
                </div>
            )}

            {/* Yang Aktif Sekarang */}
            {!loading && (
                <div className="mb-8">
                    <h2 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-200">
                        Yang Aktif Sekarang
                    </h2>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {Object.entries(types).map(([typeKey, typeLabel]) => {
                            const active = effectiveActive[typeKey];
                            const Icon = TYPE_ICONS[typeKey] || IconBell;
                            return (
                                <div
                                    key={typeKey}
                                    className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
                                >
                                    <div className="mb-2 flex items-center gap-2">
                                        <Icon size={16} className="text-slate-500 dark:text-slate-400" />
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                            {typeLabel}
                                        </span>
                                    </div>
                                    {active ? (
                                        <div className="flex items-center gap-2">
                                            <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                                                {active.name}
                                            </span>
                                            <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${SCOPE_COLORS[active.scope]}`}>
                                                {SCOPE_LABELS[active.scope]}
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                                            <IconAlertCircle size={14} />
                                            <span>Belum ada suara aktif</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Filters */}
            {!loading && (
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
            )}

            {/* Empty State */}
            {!loading && sounds.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center dark:border-slate-700 dark:bg-slate-900/50">
                    <IconBell size={48} className="mx-auto mb-4 text-slate-400" />
                    <p className="text-slate-500 dark:text-slate-400">
                        Belum ada suara notifikasi. Upload suara pertama Anda!
                    </p>
                </div>
            )}

            {/* Sounds Grouped by Scope */}
            {!loading && sounds.length > 0 && (
                <>
                    {['station', 'outlet', 'global'].map((scope) => {
                        const scopeSounds = groupedByScope[scope];
                        if (!scopeSounds || scopeSounds.length === 0) return null;

                        const scopeTitle = {
                            station: `Suara Station${selectedStation ? ` (${selectedStation.name})` : ''}`,
                            outlet: 'Suara Outlet (Fallback)',
                            global: 'Suara Global (Fallback Terakhir)',
                        }[scope];

                        return (
                            <div key={scope} className="mb-8">
                                <div className="mb-3 flex items-center gap-2">
                                    <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                                        {scopeTitle}
                                    </h2>
                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SCOPE_COLORS[scope]}`}>
                                        {scopeSounds.length} suara
                                    </span>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {scopeSounds.map((sound) => {
                                        const isActive = effectiveActive[sound.type]?.id === sound.id;
                                        return (
                                            <div
                                                key={sound.id}
                                                className={`rounded-xl border p-4 transition ${
                                                    isActive
                                                        ? `border-primary-300 bg-primary-50 ring-2 ring-primary-200 dark:border-primary-700 dark:bg-primary-900/20 dark:ring-primary-800`
                                                        : `${SCOPE_RING[scope]} bg-white dark:bg-slate-900`
                                                }`}
                                            >
                                                <div className="mb-3 flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="font-medium text-slate-900 dark:text-white">
                                                                {sound.name}
                                                            </h3>
                                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SCOPE_COLORS[sound.scope]}`}>
                                                                {SCOPE_LABELS[sound.scope]}
                                                            </span>
                                                        </div>
                                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                            {types[sound.type] || sound.type} • {sound.original_name || sound.file_path.split('/').pop()} • {sound.file_size_human}
                                                        </p>
                                                    </div>

                                                    {isActive && (
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

                                                    {!isActive && (
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
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </>
            )}

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                Upload Suara Baru
                                {selectedStation && (
                                    <span className="ml-2 text-sm font-normal text-slate-500">
                                        untuk {selectedStation.name}
                                    </span>
                                )}
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
