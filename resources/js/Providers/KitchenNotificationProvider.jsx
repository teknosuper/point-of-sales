import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

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
    const lastActiveCountRef = useRef(0);
    const intervalRef = useRef(null);
    const failedSoundFetchRef = useRef(false);

    const fallbackAudioUrls = {
        general: '/sounds/notification/general.mp3',
        new_order: '/sounds/notification/new_order.mp3',
        error: '/sounds/notification/error.mp3',
        reminder: '/sounds/notification/reminder.mp3',
    };

    const resolveAudioUrl = useCallback((type = 'new_order') => {
        return soundUrls[type] || fallbackAudioUrls[type] || null;
    }, [soundUrls]);

    useEffect(() => {
        const fetchSounds = async () => {
            try {
                const baseUrl = window.location.origin;
                const url = `${baseUrl}/dashboard/settings/notification-sounds/data`;

                const response = await fetch(url, {
                    credentials: 'include',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Accept': 'application/json',
                    },
                });

                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    console.warn('KitchenNotificationProvider: skipping sound fetch - not JSON', { contentType, status: response.status });
                    failedSoundFetchRef.current = true;
                    return;
                }

                if (!response.ok) {
                    console.warn('KitchenNotificationProvider: sound fetch failed', { status: response.status });
                    failedSoundFetchRef.current = true;
                    return;
                }

                const data = await response.json();

                if (data.success && Array.isArray(data.data)) {
                    const urls = {
                        general: null,
                        new_order: null,
                        error: null,
                        reminder: null,
                    };

                    data.data.forEach((sound) => {
                        if (sound?.is_active && sound?.url && sound?.type && urls.hasOwnProperty(sound.type)) {
                            urls[sound.type] = sound.url;
                        }
                    });

                    console.info('KitchenNotificationProvider: loaded sounds', urls);
                    failedSoundFetchRef.current = false;
                    setSoundUrls(urls);
                } else {
                    console.warn('KitchenNotificationProvider: unexpected sound payload', data);
                    failedSoundFetchRef.current = true;
                }
            } catch (e) {
                console.warn('KitchenNotificationProvider: failed to fetch notification sounds', e);
                failedSoundFetchRef.current = true;
            }
        };

        fetchSounds();
    }, [outletId]);

    // Get audio URL for type with fallback
    const getAudioUrl = useCallback((type = 'new_order') => {
        return resolveAudioUrl(type);
    }, [resolveAudioUrl]);

    // Inisialisasi audio
    const initAudio = useCallback(() => {
        if (audioUnlockedRef.current) return;
        
        audioUnlockedRef.current = true;
        
        const audioUrl = getAudioUrl('new_order') || getAudioUrl('general');
        if (audioUrl) {
            const temp = new Audio(audioUrl);
            temp.volume = 1.0;
            temp.load();
            void temp.play().then(() => {
                temp.pause();
                temp.currentTime = 0;
            }).catch(() => {
                // some browsers may still block this initial silent unlock
            });
            audioRef.current = temp;
        }
    }, [getAudioUrl]);

    const ensureErrorBeepFallback = useCallback(() => {
        if (typeof window === 'undefined' || !('AudioContext' in window) && !('webkitAudioContext' in window)) {
            return false;
        }

        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            const context = new AudioContextClass();

            if (context.state === 'suspended') {
                context.resume();
            }

            const oscillator = context.createOscillator();
            const gainNode = context.createGain();

            oscillator.type = 'square';
            oscillator.frequency.value = 440;
            gainNode.gain.value = 0.1;

            oscillator.connect(gainNode);
            gainNode.connect(context.destination);

            oscillator.start();
            oscillator.stop(context.currentTime + 0.2);

            return true;
        } catch (e) {
            console.warn('Failed to play fallback error beep', e);
            return false;
        }
    }, []);

    const unlockAudioContext = useCallback(async () => {
        if (typeof window === 'undefined') return;
        
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;
            
            const context = new AudioContextClass();
            if (context.state === 'suspended') {
                await context.resume();
            }
        } catch (e) {
            console.warn('Failed to unlock audio context', e);
        }
    }, []);

    const playNotificationSound = useCallback(async (type = 'new_order') => {
        const audioUrl = resolveAudioUrl(type);

        if (!audioUrl) {
            console.debug(`No sound configured for type: ${type}, using fallback beep`);
            ensureErrorBeepFallback();
            return;
        }

        try {
            await unlockAudioContext();

            const audio = new Audio(audioUrl);
            audio.volume = 1.0;
            audio.currentTime = 0;

            const playPromise = audio.play();
            if (playPromise) {
                playPromise.catch((err) => {
                    console.warn('Autoplay diblokir browser, mencoba fallback beep:', err.message);
                    ensureErrorBeepFallback();
                });
            }
        } catch (error) {
            console.error('Gagal memutar suara notifikasi:', error);
            ensureErrorBeepFallback();
        }
    }, [resolveAudioUrl, ensureErrorBeepFallback, unlockAudioContext]);

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
            
            const count = Number(data.activeCount ?? data.pendingCount ?? 0);

            if (count > lastActiveCountRef.current && lastActiveCountRef.current > 0) {
                // Ada pesanan baru!
                playNotificationSound();
                showBrowserNotification(
                    '🍳 Pesanan Baru dari Dapur!',
                    `Ada ${count} pesanan yang menunggu.`
                );
            }

            lastActiveCountRef.current = count;
        } catch (error) {
            // Silent fail untuk polling
        }
    }, [outletId, playNotificationSound, showBrowserNotification]);

    // Setup: unlock audio on user interaction
    useEffect(() => {
        const handleInteraction = async () => {
            initAudio();
            await unlockAudioContext();
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('touchstart', handleInteraction);
        };

        window.addEventListener('click', handleInteraction, { once: true });
        window.addEventListener('touchstart', handleInteraction, { once: true });

        return () => {
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('touchstart', handleInteraction);
        };
    }, [initAudio, unlockAudioContext]);

    // Listen to explicit kitchen board events so toast and sound stay in sync.
    useEffect(() => {
        const handleNewOrderEvent = (event) => {
            if (!enabled) {
                return;
            }

            const count = Number(event?.detail?.count || 0);
            playNotificationSound('new_order');

            if (count > 0) {
                showBrowserNotification(
                    '🍳 Pesanan Baru dari Dapur!',
                    `Ada ${count} pesanan baru masuk.`
                );
            }
        };

        window.addEventListener('kitchen:new-order', handleNewOrderEvent);

        const handlePrintError = () => {
            console.info('KitchenNotificationProvider: kitchen:print-error received');
            if (!enabled) {
                console.warn('KitchenNotificationProvider: print-error ignored because enabled=false');
                return;
            }

            const errorUrl = resolveAudioUrl('error');
            console.info('KitchenNotificationProvider: error sound url', errorUrl);

            toast.error('Peringatan: ada cetak gagal ke printer dapur.');
            playNotificationSound('error');
        };

        const handleReminder = () => {
            console.info('KitchenNotificationProvider: kitchen:print-reminder received');
            if (!enabled) {
                return;
            }

            toast.info('Pengingat: ada pesanan sudah tercetak tetapi belum diproses di dapur.');
            playNotificationSound('reminder');
        };

        const handleQrFeedback = () => {
            console.info('KitchenNotificationProvider: kitchen:qr-feedback received');
            if (!enabled) {
                return;
            }

            playNotificationSound('general');
        };

        window.addEventListener('kitchen:print-error', handlePrintError);
        window.addEventListener('kitchen:print-reminder', handleReminder);
        window.addEventListener('kitchen:qr-feedback', handleQrFeedback);

        return () => {
            window.removeEventListener('kitchen:new-order', handleNewOrderEvent);
            window.removeEventListener('kitchen:print-error', handlePrintError);
            window.removeEventListener('kitchen:print-reminder', handleReminder);
            window.removeEventListener('kitchen:qr-feedback', handleQrFeedback);
        };
    }, [enabled, playNotificationSound]);

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
