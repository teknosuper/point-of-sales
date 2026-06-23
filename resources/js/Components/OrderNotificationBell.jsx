import React, { useState, useEffect, useCallback, useRef } from 'react';
import { IconBell } from '@tabler/icons-react';
import { usePage } from '@inertiajs/react';
import toast from 'react-hot-toast';

/**
 * Komponen Bell untuk notifikasi pesanan kitchen
 */
export default function OrderNotificationBell({ stationSlug: propStationSlug = '', outletId = null }) {
    const { props } = usePage();
    const [totalActive, setTotalActive] = useState(0);
    const [failedJobs, setFailedJobs] = useState(0);
    const [isVisible, setIsVisible] = useState(false);
    const [showPulse, setShowPulse] = useState(false);
    const [stationSlug, setStationSlug] = useState(propStationSlug);
    const [feedUrl, setFeedUrl] = useState('');
    const [audioEnabled, setAudioEnabled] = useState(false);
    const [lastNotifiedCount, setLastNotifiedCount] = useState(0);
    
    // Refs
    const lastSoundTimeRef = useRef(0);
    const lastActiveCountRef = useRef(0);
    const lastFailedCountRef = useRef(0);
    const audioRef = useRef(null);
    const intervalRef = useRef(null);

    const enableAudio = useCallback(() => {
        try {
            audioRef.current = new Audio('/media/notifikasi.mp3');
            audioRef.current.volume = 0.7;
            audioRef.current.play().then(() => {
                setAudioEnabled(true);
                toast.success('Suara notifikasi aktif!', { icon: '🔔' });
            }).catch(() => {
                toast.error('Gagal enable suara');
            });
        } catch (e) {
            console.warn('Audio error:', e);
        }
    }, []);

    const playNotificationSound = useCallback(() => {
        if (!audioRef.current) return;
        try {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(() => {});
        } catch (e) {}
    }, []);

    const triggerNotification = useCallback((message, type = 'warning') => {
        setShowPulse(true);
        if (audioEnabled) {
            playNotificationSound();
        }
        toast(message, {
            duration: 5000,
            position: 'top-right',
            style: {
                background: type === 'error' ? '#EF4444' : type === 'success' ? '#10B981' : '#F59E0B',
                color: '#fff',
                fontWeight: 'bold',
            },
            icon: type === 'error' ? '❌' : type === 'success' ? '✅' : '🔔',
        });
        lastSoundTimeRef.current = Date.now();
        setTimeout(() => setShowPulse(false), 2000);
    }, [audioEnabled, playNotificationSound]);

    // Build feed URL
    useEffect(() => {
        if (propStationSlug) {
            setStationSlug(propStationSlug);
            setFeedUrl(`/dashboard/kitchen/${propStationSlug}/feed`);
            return;
        }
        
        const activeStationSlug = props?.activeStation?.slug;
        if (activeStationSlug) {
            setStationSlug(activeStationSlug);
            setFeedUrl(`/dashboard/kitchen/${activeStationSlug}/feed`);
            return;
        }
        
        if (typeof window !== 'undefined') {
            const path = window.location.pathname;
            const parts = path.split('/').filter(Boolean);
            const kitchenIndex = parts.indexOf('kitchen');
            if (kitchenIndex !== -1 && parts[kitchenIndex + 1]) {
                const slug = parts[kitchenIndex + 1];
                setStationSlug(slug);
                setFeedUrl(`/dashboard/kitchen/${slug}/feed`);
            }
        }
    }, [propStationSlug, props?.activeStation?.slug]);

    const fetchData = useCallback(async () => {
        if (!feedUrl) return;

        try {
            const response = await fetch(feedUrl);
            if (!response.ok) return;
            
            const data = await response.json();
            const station = data.activeStation || {};
            const pending = station.pending_count || 0;
            const acknowledged = station.acknowledged_count || 0;
            const ready = station.ready_count || 0;
            const activeCount = pending + acknowledged + ready;
            const failedCount = station.failed_jobs || 0;
            
            const prevActive = lastActiveCountRef.current;
            const prevFailed = lastFailedCountRef.current;
            
            setTotalActive(activeCount);
            setFailedJobs(failedCount);
            
            const now = Date.now();
            const timeSinceLastSound = now - lastSoundTimeRef.current;

            // 1. Pesanan baru masuk (count meningkat)
            if (activeCount > prevActive && prevActive > 0) {
                const newOrders = activeCount - prevActive;
                triggerNotification(`${newOrders} pesanan baru masuk!`, 'warning');
            }
            // 2. Pesanan pertama (dari 0 ke >0)
            else if (activeCount > 0 && prevActive === 0) {
                triggerNotification(`${activeCount} pesanan aktif!`, 'warning');
            }
            // 3. Reminder setiap 30 detik jika ada yang belum selesai
            else if (activeCount + failedCount > 0 && timeSinceLastSound >= 30000) {
                const parts = [];
                if (activeCount > 0) parts.push(`${activeCount} aktif`);
                if (failedCount > 0) parts.push(`${failedCount} gagal`);
                triggerNotification(`Reminder: ${parts.join(', ')}`, 'warning');
            }
            // 4. Semua selesai
            else if (activeCount === 0 && failedCount === 0 && prevActive > 0) {
                toast.success('Semua pesanan selesai! 🎉', {
                    duration: 3000,
                    position: 'top-right',
                });
            }
            
            // 5. Pencetakan gagal
            if (failedCount > prevFailed && prevFailed >= 0) {
                triggerNotification(`${failedCount} pencetakan gagal!`, 'error');
            }

            lastActiveCountRef.current = activeCount;
            lastFailedCountRef.current = failedCount;
        } catch (_) {}
    }, [feedUrl, triggerNotification]);

    // Polling
    useEffect(() => {
        if (!feedUrl) return;

        fetchData();
        intervalRef.current = setInterval(fetchData, 10000);

        const handleVisibilityChange = () => {
            if (document.hidden) {
                clearInterval(intervalRef.current);
            } else {
                fetchData();
                intervalRef.current = setInterval(fetchData, 10000);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(intervalRef.current);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [fetchData, feedUrl]);

    // Visibility
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const path = window.location.pathname;
        const isKitchenPage = path.includes('/kitchen');
        setIsVisible(isKitchenPage || !!stationSlug);
    }, [stationSlug]);

    if (!isVisible) return null;

    const hasFailed = failedJobs > 0;
    const hasUnresolved = totalActive + failedJobs > 0;
    const badgeCount = totalActive + failedJobs;

    return (
        <div className="relative" title={`${totalActive} pesanan aktif, ${failedJobs} cetak gagal`}>
            {!audioEnabled && (
                <button
                    onClick={enableAudio}
                    className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 text-xs bg-primary-600 text-white rounded-full whitespace-nowrap z-50 animate-bounce"
                >
                    🔔 Aktifkan Suara
                </button>
            )}
            <button
                className={`p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-all ${
                    showPulse ? 'animate-pulse scale-110' : ''
                } ${hasUnresolved ? 'text-danger' : 'text-gray-600 dark:text-gray-300'}`}
            >
                <IconBell className="w-5 h-5" />
                
                {hasUnresolved && (
                    <span className={`absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white rounded-full transition-transform ${
                        showPulse ? 'animate-bounce scale-125' : 'scale-100'
                    } ${hasFailed ? 'bg-warning' : 'bg-danger'}`}>
                        {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                )}
            </button>
            
            {hasUnresolved && (
                <div className="absolute right-0 top-full mt-1 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap z-50 opacity-0 hover:opacity-100 pointer-events-none transition-opacity">
                    {totalActive > 0 && <div>{totalActive} pesanan aktif</div>}
                    {failedJobs > 0 && <div className="text-yellow-400">{failedJobs} cetak gagal</div>}
                </div>
            )}
        </div>
    );
}
