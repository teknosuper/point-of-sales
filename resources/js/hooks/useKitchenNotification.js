import { useEffect, useRef, useCallback } from 'react';
import { router } from '@inertiajs/react';

/**
 * Hook untuk notifikasi pesanan masuk dari dapur
 * Bisa diinject ke semua halaman tenant
 * 
 * @param {Object} options
 * @param {number} options.pollingInterval - Interval polling dalam ms (default: 5000)
 * @param {boolean} options.enabled - Enable/disable polling
 * @param {Function} options.onNewOrder - Callback saat ada pesanan baru
 */
export function useKitchenNotification({
    pollingInterval = 5000,
    enabled = true,
    onNewOrder = null
} = {}) {
    const audioRef = useRef(null);
    const audioUnlockedRef = useRef(false);
    const lastOrderCountRef = useRef(0);
    const intervalRef = useRef(null);

    // Inisialisasi audio
    const initAudio = useCallback(() => {
        if (audioUnlockedRef.current) return;
        
        audioUnlockedRef.current = true;
        
        // Preload audio
        if (!audioRef.current) {
            audioRef.current = new Audio('/media/notifikasi.mp3');
            audioRef.current.volume = 1.0;
            audioRef.current.load();
        }
    }, []);

    // Mainkan suara notifikasi
    const playNotificationSound = useCallback(() => {
        if (!audioUnlockedRef.current) {
            initAudio();
            return;
        }

        try {
            if (!audioRef.current) {
                audioRef.current = new Audio('/media/notifikasi.mp3');
                audioRef.current.volume = 1.0;
            }

            audioRef.current.currentTime = 0;
            audioRef.current.play().catch((err) => {
                console.warn('Autoplay diblokir browser:', err.message);
            });
        } catch (error) {
            console.error('Gagal memutar suara notifikasi:', error);
        }
    }, [initAudio]);

    // Tampilkan browser notification
    const showBrowserNotification = useCallback((title, body) => {
        if (!('Notification' in window)) return;
        
        if (Notification.permission === 'granted') {
            new Notification(title, {
                body,
                icon: '/pwa-icon.svg',
                tag: 'kitchen-order',
                requireInteraction: true,
            });
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then((permission) => {
                if (permission === 'granted') {
                    new Notification(title, {
                        body,
                        icon: '/pwa-icon.svg',
                        tag: 'kitchen-order',
                        requireInteraction: true,
                    });
                }
            });
        }
    }, []);

    // Polling pesanan baru
    const checkNewOrders = useCallback(() => {
        if (!enabled) return;

        router.get(
            '/api/kitchen/pending-count',
            {},
            {
                preserveScroll: true,
                preserveState: true,
                only: ['pendingCount'],
                onSuccess: (data) => {
                    const count = data.pendingCount || 0;
                    
                    if (count > lastOrderCountRef.current && lastOrderCountRef.current > 0) {
                        // Ada pesanan baru!
                        playNotificationSound();
                        showBrowserNotification(
                            '🍳 Pesanan Baru dari Dapur!',
                            `Ada ${count} pesanan yang menunggu.`
                        );
                        
                        if (onNewOrder) {
                            onNewOrder(count);
                        }
                    }
                    
                    lastOrderCountRef.current = count;
                },
                onError: (error) => {
                    console.warn('Gagal polling pesanan dapur:', error);
                }
            }
        );
    }, [enabled, playNotificationSound, showBrowserNotification, onNewOrder]);

    // Setup: unlock audio on user interaction
    useEffect(() => {
        if (!enabled) return;

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
    }, [enabled, initAudio]);

    // Start polling
    useEffect(() => {
        if (!enabled) return;

        // Initial check
        checkNewOrders();

        // Set interval
        intervalRef.current = setInterval(checkNewOrders, pollingInterval);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [enabled, pollingInterval, checkNewOrders]);

    return {
        playNotificationSound,
        showBrowserNotification,
        initAudio,
    };
}

export default useKitchenNotification;
