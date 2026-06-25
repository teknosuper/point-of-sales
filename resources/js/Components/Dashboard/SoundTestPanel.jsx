import React, { useState, useEffect, useCallback } from 'react';
import { IconPlayerPlay, IconAlertCircle, IconVolume, IconBell, IconBellOff } from '@tabler/icons-react';
import toast from 'react-hot-toast';

/**
 * Komponen untuk testing suara notifikasi
 * Menampilkan tombol untuk setiap type suara dan feedback error
 */
export default function SoundTestPanel({ compact = false }) {
    const [soundUrls, setSoundUrls] = useState({
        general: null,
        new_order: null,
        error: null,
        reminder: null,
    });
    const [loading, setLoading] = useState(true);
    const [playingType, setPlayingType] = useState(null);
    const [errors, setErrors] = useState({});

    const soundTypes = [
        { key: 'new_order', label: 'Pesanan Baru', icon: <IconBell size={16} />, color: 'primary' },
        { key: 'reminder', label: 'Pengingat', icon: <IconBell size={16} />, color: 'warning' },
        { key: 'error', label: 'Error', icon: <IconAlertCircle size={16} />, color: 'danger' },
        { key: 'general', label: 'Umum', icon: <IconVolume size={16} />, color: 'success' },
    ];

    const fetchSounds = useCallback(async () => {
        setLoading(true);
        setErrors({});
        try {
            // Use absolute URL with credentials and headers for Inertia session
            const baseUrl = window.location.origin;
            const response = await fetch(`${baseUrl}/dashboard/settings/notification-sounds/data`, {
                credentials: 'include',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json',
                }
            });
            
            // Skip if response is not JSON (e.g., login page redirect)
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                // Log the actual response for debugging
                const text = await response.text();
                console.warn('Response is not JSON:', contentType, text.substring(0, 200));
                toast.error('Silakan login terlebih dahulu');
                setLoading(false);
                return;
            }
            
            if (!response.ok) {
                toast.error('Gagal memuat daftar suara (status: ' + response.status + ')');
                setLoading(false);
                return;
            }
            
            const data = await response.json();
            
            if (!data.success) {
                toast.error('Gagal memuat daftar suara');
                setLoading(false);
                return;
            }
            
            const urls = {
                general: null,
                new_order: null,
                error: null,
                reminder: null,
            };
            
            const newErrors = {};
            
            // Debug: log what we received
            console.log('Sound data received:', data);
            
            if (data.data && data.data.length > 0) {
                data.data.forEach(sound => {
                    console.log('Processing sound:', sound.type, 'is_active:', sound.is_active, 'url:', sound.url);
                    if (sound.is_active && sound.url) {
                        urls[sound.type] = sound.url;
                    }
                });
                
                // Check for missing sounds
                soundTypes.forEach(type => {
                    if (!urls[type.key]) {
                        newErrors[type.key] = 'Suara belum diupload atau diaktifkan';
                    }
                });
                
                if (Object.keys(newErrors).length === soundTypes.length) {
                    toast.error('Belum ada suara yang aktif. Upload dan aktifkan suara di halaman pengaturan.');
                }
            } else {
                soundTypes.forEach(type => {
                    newErrors[type.key] = 'Suara belum diupload atau diaktifkan';
                });
                toast.error('Belum ada suara yang dikonfigurasi. Upload di halaman pengaturan.');
            }
            
            setSoundUrls(urls);
            setErrors(newErrors);
        } catch (e) {
            console.error('Failed to fetch sounds:', e);
            toast.error('Gagal memuat daftar suara: ' + e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSounds();
    }, [fetchSounds]);

    const playSound = async (type, url) => {
        if (!url) {
            toast.error('Suara belum dikonfigurasi untuk tipe ini');
            return;
        }

        setPlayingType(type);
        
        try {
            const audio = new Audio(url);
            audio.volume = 1.0;
            
            await audio.play();
            
            // Clear error for this type if exists
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[type];
                return newErrors;
            });
            
            audio.onended = () => {
                setPlayingType(null);
            };
            
            audio.onerror = () => {
                setPlayingType(null);
                setErrors(prev => ({
                    ...prev,
                    [type]: 'File audio tidak valid atau tidak dapat diputar'
                }));
                toast.error(`Gagal memutar suara ${type}: File tidak valid`);
            };
            
        } catch (e) {
            setPlayingType(null);
            setErrors(prev => ({
                ...prev,
                [type]: 'Tidak dapat memutar audio'
            }));
            toast.error(`Gagal memutar suara ${type}`);
        }
    };

    const getColorClasses = (color) => {
        const colors = {
            primary: 'bg-primary-100 text-primary-700 hover:bg-primary-200 dark:bg-primary-900/40 dark:text-primary-300',
            warning: 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300',
            danger: 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/40 dark:text-rose-300',
            success: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300',
        };
        return colors[color] || colors.primary;
    };

    const getBorderClasses = (color) => {
        const colors = {
            primary: 'border-primary-300 dark:border-primary-700',
            warning: 'border-amber-300 dark:border-amber-700',
            danger: 'border-rose-300 dark:border-rose-700',
            success: 'border-emerald-300 dark:border-emerald-700',
        };
        return colors[color] || colors.primary;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600"></div>
                <span className="ml-2 text-sm text-slate-500">Memuat...</span>
            </div>
        );
    }

    return (
        <div className={`rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 ${compact ? '' : 'shadow-sm'} `}>
            {!compact && (
                <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        🔊 Testing Suara Notifikasi
                    </h3>
                    <button
                        onClick={fetchSounds}
                        className="text-xs text-primary-600 hover:text-primary-700"
                    >
                        Refresh
                    </button>
                </div>
            )}
            
            <div className={compact ? 'flex gap-2' : 'grid grid-cols-2 gap-2'}>
                {soundTypes.map((type) => {
                    const hasUrl = soundUrls[type.key] !== null;
                    const isPlaying = playingType === type.key;
                    const hasError = errors[type.key];
                    
                    return (
                        <div key={type.key} className="relative">
                            <button
                                onClick={() => playSound(type.key, soundUrls[type.key])}
                                disabled={!hasUrl || isPlaying}
                                className={`w-full flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                                    getColorClasses(type.color)
                                } ${getBorderClasses(type.color)} ${
                                    hasUrl ? '' : 'opacity-50 cursor-not-allowed'
                                } ${isPlaying ? 'animate-pulse' : ''}`}
                                title={hasError ? errors[type.key] : (hasUrl ? `Putar ${type.label}` : 'Suara belum dikonfigurasi')}
                            >
                                {isPlaying ? (
                                    <span className="animate-ping">🔊</span>
                                ) : hasUrl ? (
                                    type.icon
                                ) : (
                                    <IconBellOff size={16} />
                                )}
                                <span>{type.label}</span>
                            </button>
                            
                            {hasError && (
                                <div className="absolute -top-1 -right-1">
                                    <IconAlertCircle size={14} className="text-rose-500" />
                                </div>
                            )}
                            
                            {!hasUrl && (
                                <div className="mt-1 text-center">
                                    <span className="text-[10px] text-slate-400">Belum aktif</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            
            {Object.keys(errors).length > 0 && !compact && (
                <div className="mt-3 rounded-lg bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
                    <strong>Catatan:</strong> Upload dan aktifkan suara di{' '}
                    <a 
                        href="/dashboard/settings/notification-sounds" 
                        target="_blank"
                        className="underline hover:text-rose-900"
                    >
                        Pengaturan Suara Notifikasi
                    </a>
                </div>
            )}
        </div>
    );
}
