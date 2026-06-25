import { useEffect, useRef, useCallback, useMemo, useState } from 'react';

/**
 * Komponen Provider untuk notifikasi pesanan kitchen
 * Di-inject di app.jsx agar berfungsi di semua halaman
 * Menggunakan suara dari database NotificationSound
 */
export default function KitchenNotificationProvider({ children, outletId = null, enabled = true }) {
    // Extract station slug from URL if on kitchen page
    const stationSlug = useMemo(() => {
        if (typeof window === 'undefined') return '';
        const match = window.location.pathname.match(/\/kitchen(?:\/([^/]+))?/);
        return match ? match[1] || '' : '';
    }, []);
    const [soundUrls, setSoundUrls] = useState({
        general: null,
        new_order: null,
        error: null,
        reminder: null,
    });
    const audioRef = useRef(null);
    const audioUnlockedRef = useRef(false);
    const lastOrderCountRef = useRef(0);
    const intervalRef = useRef(null);

    // Fetch sounds from database
    useEffect(() => {
        const fetchSounds = async () => {
            try {
                // Use absolute URL to avoid auth redirect issues
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
                    console.debug('Skipping sound fetch - not authenticated or not JSON response');
                    return;
                }
                
                if (!response.ok) {
                    console.warn('Failed to fetch sounds, status:', response.status);
                    return;
                }
                
                const data = await response.json();
                
                if (data.success && data.data) {
                    const urls = {
                        general: null,
                        new_order: null,
                        error: null,
                        reminder: null,
                    };
                    
                    data.data.forEach(sound => {
                        if (sound.is_active && sound.url) {
                            urls[sound.type] = sound.url;
                        }
                    });
                    
                    setSoundUrls(urls);
                }
            } catch (e) {
                console.warn('Failed to fetch notification sounds:', e);
            }
        };
        
        fetchSounds();
    }, []);

    // Get audio URL for type - no fallback
    const getAudioUrl = useCallback((type = 'new_order') => {
        return soundUrls[type] || null;
    }, [soundUrls]);

    // Inisialisasi audio
    const initAudio = useCallback(() => {
        if (audioUnlockedRef.current) return;
        
        audioUnlockedRef.current = true;
        
        // Preload audio dengan suara new_order jika ada
        const audioUrl = getAudioUrl('new_order') || getAudioUrl('general');
        if (audioUrl && !audioRef.current) {
            audioRef.current = new Audio(audioUrl);
            audioRef.current.volume = 1.0;
            audioRef.current.load();
        }
    }, [getAudioUrl]);

    // Mainkan suara notifikasi
    const playNotificationSound = useCallback((type = 'new_order') => {
        if (!audioUnlockedRef.current) {
            initAudio();
            return;
        }

        const audioUrl = getAudioUrl(type);
        
        // Jika tidak ada suara yang dikonfigurasi, skip
        if (!audioUrl) {
            console.debug(`No sound configured for type: ${type}`);
            return;
        }

        try {
            if (!audioRef.current || audioRef.current.src !== audioUrl) {
                audioRef.current = new Audio(audioUrl);
                audioRef.current.volume = 1.0;
            }

            audioRef.current.currentTime = 0;
            audioRef.current.play().catch((err) => {
                console.warn('Autoplay diblokir browser:', err.message);
            });
        } catch (error) {
            console.error('Gagal memutar suara notifikasi:', error);
        }
    }, [initAudio, getAudioUrl]);

    // Tampilkan browser notification
    const showBrowserNotification = useCallback((title, body) => {
        if (!('Notification' in window)) return;
        
        if (Notification.permission === 'granted') {
            new Notification(title, {
                body,
                icon: '/pwa-icon.svg',
                tag: 'kitchen-order',
                requireInteraction: false,
            });
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then((permission) => {
                if (permission === 'granted') {
                    new Notification(title, {
                        body,
                        icon: '/pwa-icon.svg',
                        tag: 'kitchen-order',
                        requireInteraction: false,
                    });
                }
            });
        }
    }, []);

    // Polling pesanan baru
    const checkNewOrders = useCallback(async () => {
        if (!enabled) return;
        const params = new URLSearchParams();
        if (stationSlug) {
            params.append('station_slug', stationSlug);
        } else if (outletId) {
            params.append('outlet_id', outletId);
        }

        try {
            const response = await fetch(`/api/kitchen/pending-count?${params.toString()}`);
            const data = await response.json();
            
            const count = data.pendingCount || 0;
            
            if (count > lastOrderCountRef.current && lastOrderCountRef.current > 0) {
                // Ada pesanan baru!
                playNotificationSound();
                showBrowserNotification(
                    '🍳 Pesanan Baru dari Dapur!',
                    `Ada ${count} pesanan yang menunggu.`
                );
            }
            
            lastOrderCountRef.current = count;
        } catch (error) {
            // Silent fail untuk polling
        }
    }, [outletId, playNotificationSound, showBrowserNotification]);

    // Setup: unlock audio on user interaction
    useEffect(() => {
        const handleInteraction = () => {
            initAudio();
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('touchstart', handleInteraction);
        };

        window.addEventListener('click', handleInteraction, { once: true });
        window.addEventListener('touchstart', handleInteraction, { once: true });

        return () => {
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('touchstart', handleInteraction);
        };
    }, [initAudio]);

    // Start polling
    useEffect(() => {
        // Initial check
        checkNewOrders();

        // Set interval 5 detik
        intervalRef.current = setInterval(checkNewOrders, 5000);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [checkNewOrders]);

    return children;
}
