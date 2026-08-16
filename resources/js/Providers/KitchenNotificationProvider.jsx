import { useEffect, useRef, useCallback, useState } from 'react';
import toast from 'react-hot-toast';

/**
 * KitchenNotificationProvider
 *
 * Architecture:
 * 1. On mount: fetch sound URLs from DB (fallback: static files in /sounds/notification/)
 * 2. On user interaction: unlock AudioContext (single shared instance)
 * 3. On event: play sound immediately if unlocked, else queue for replay on unlock
 * 4. Sound priority: DB URL → static fallback → oscillator beep
 *
 * Events listened:
 *   kitchen:new-order     → new_order sound + browser notif
 *   kitchen:print-failed  → print_failed sound (board handles Swal modal)
 *   kitchen:print-pending → print_pending sound + toast
 *   kitchen:print-reminder→ reminder sound + toast
 *   kitchen:qr-feedback   → general sound
 */

const EVENT_SOUND_MAP = {
    'kitchen:new-order': 'new_order',
    'kitchen:print-failed': 'print_failed',
    'kitchen:print-pending': 'print_pending',
    'kitchen:print-success': 'print_success',
    'kitchen:print-reminder': 'reminder',
    'kitchen:qr-feedback': 'general',
};

const SOUND_TYPES = [
    'general', 'new_order', 'error', 'reminder',
    'print_pending', 'print_failed', 'print_success',
];

export default function KitchenNotificationProvider({ children, outletId = null, stationId = null }) {
    /* ── State ── */
    const [soundUrls, setSoundUrls] = useState(() =>
        Object.fromEntries(SOUND_TYPES.map(t => [t, null]))
    );

    /* ── Refs ── */
    const audioCtxRef = useRef(null);          // shared AudioContext (created once)
    const audioUnlockedRef = useRef(false);     // true after first user interaction
    const pendingSoundsRef = useRef([]);        // queue of types waiting for unlock
    const mountedRef = useRef(true);
    const stationIdRef = useRef(stationId);     // mutable ref for stationId

    /* ── Fallback URLs (static files in public/sounds/notification/) ── */
    const fallbackUrls = useRef(
        Object.fromEntries(SOUND_TYPES.map(t => [t, `/sounds/notification/${t}.mp3`]))
    ).current;

    /* ── Resolve URL: DB → fallback → null ── */
    const resolveUrl = useCallback((type) => {
        return soundUrls[type] || fallbackUrls[type] || null;
    }, [soundUrls, fallbackUrls]);

    /* ── Get or create shared AudioContext ── */
    const getAudioCtx = useCallback(() => {
        if (audioCtxRef.current) return audioCtxRef.current;
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return null;
        audioCtxRef.current = new Ctor();
        return audioCtxRef.current;
    }, []);

    /* ── Play oscillator beep (needs AudioContext) ── */
    const playBeep = useCallback((freq = 440, duration = 0.2) => {
        try {
            const ctx = getAudioCtx();
            if (!ctx) return;
            if (ctx.state === 'suspended') ctx.resume();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.value = freq;
            gain.gain.value = 0.08;
            osc.connect(gain).connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + duration);
        } catch (e) {
            console.warn('[KitchenNotif] beep fallback failed', e);
        }
    }, [getAudioCtx]);

    /* ── Core: play a sound by type ── */
    const playSound = useCallback(async (type) => {
        const url = resolveUrl(type);

        if (!url) {
            console.debug(`[KitchenNotif] No URL for type "${type}", using beep`);
            playBeep();
            return;
        }

        try {
            const audio = new Audio(url);
            audio.volume = 1.0;
            await audio.play();
        } catch (err) {
            // Autoplay blocked or URL failed → fallback to beep
            console.warn(`[KitchenNotif] Audio play failed for "${type}":`, err.message);
            playBeep();
        }
    }, [resolveUrl, playBeep]);

    /* ── Queue or play (respects unlock state) ── */
    const enqueueOrPlay = useCallback((type) => {
        if (audioUnlockedRef.current) {
            playSound(type);
        } else {
            // Dedup: keep only latest per type
            pendingSoundsRef.current = pendingSoundsRef.current.filter(s => s !== type);
            pendingSoundsRef.current.push(type);
            console.debug(`[KitchenNotif] Queued "${type}" (waiting for user interaction)`);
        }
    }, [playSound]);

    /* ── Browser notification ── */
    const showBrowserNotification = useCallback((title, body) => {
        try {
            if (!('Notification' in window)) return;
            if (Notification.permission === 'granted') {
                new Notification(title, { body, icon: '/pwa-icon.svg', tag: 'kitchen-notif', requireInteraction: false });
            } else if (Notification.permission !== 'denied') {
                Notification.requestPermission().then(perm => {
                    if (perm === 'granted') {
                        new Notification(title, { body, icon: '/pwa-icon.svg', tag: 'kitchen-notif', requireInteraction: false });
                    }
                });
            }
        } catch (_) { /* notification not critical */ }
    }, []);

    /* ════════════════════════════════════════════════════════════
       EFFECT 0: Listen for kitchen:set-station to update stationId
       ════════════════════════════════════════════════════════════ */
    useEffect(() => {
        const handler = (e) => {
            const newStationId = e?.detail?.stationId || null;
            if (stationIdRef.current !== newStationId) {
                stationIdRef.current = newStationId;
                console.info(`[KitchenNotif] Station changed to ${newStationId}, re-fetching sounds`);
                // Re-fetch sounds for the new station
                fetchSounds();
            }
        };
        window.addEventListener('kitchen:set-station', handler);
        return () => window.removeEventListener('kitchen:set-station', handler);
    }, []);

    /* ════════════════════════════════════════════════════════════
       EFFECT 1: Fetch sound URLs from DB on mount
       ════════════════════════════════════════════════════════════ */
    const fetchSounds = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (stationIdRef.current) params.set('station_id', String(stationIdRef.current));
            const qs = params.toString();
            const url = `${window.location.origin}/dashboard/settings/notification-sounds/data${qs ? '?' + qs : ''}`;
            const res = await fetch(url, {
                credentials: 'include',
                headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' },
            });

            if (res.status === 401 || res.status === 403) {
                console.debug(`[KitchenNotif] Auth required for sound data (${res.status}), using static fallbacks`);
                return;
            }

            if (!res.ok) {
                console.warn(`[KitchenNotif] Sound data fetch failed (${res.status}), using static fallbacks`);
                return;
            }

            const ct = res.headers.get('content-type') || '';
            if (!ct.includes('application/json')) {
                console.warn('[KitchenNotif] Sound data not JSON, using static fallbacks');
                return;
            }

            const data = await res.json();
            if (!data.success || !Array.isArray(data.data)) return;

            if (!mountedRef.current) return;

            const urls = Object.fromEntries(SOUND_TYPES.map(t => [t, null]));
            data.data.forEach(s => {
                if (s?.is_active && s?.url && s?.type && urls.hasOwnProperty(s.type)) {
                    urls[s.type] = s.url;
                }
            });

            setSoundUrls(urls);
            console.info('[KitchenNotif] Sound URLs loaded from DB:', urls);
        } catch (e) {
            console.warn('[KitchenNotif] Sound fetch error, using static fallbacks:', e.message);
        }
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        fetchSounds();
        return () => { mountedRef.current = false; };
    }, [outletId, fetchSounds]);

    /* ════════════════════════════════════════════════════════════
       EFFECT 2: Unlock audio on first user interaction
       Replays all queued sounds after unlock.
       ════════════════════════════════════════════════════════════ */
    useEffect(() => {
        const handleInteraction = () => {
            if (audioUnlockedRef.current) return;
            audioUnlockedRef.current = true;

            // Unlock shared AudioContext
            const ctx = getAudioCtx();
            if (ctx && ctx.state === 'suspended') {
                ctx.resume().catch(() => {});
            }

            // Replay queued sounds
            const queue = [...pendingSoundsRef.current];
            pendingSoundsRef.current = [];
            if (queue.length > 0) {
                console.info(`[KitchenNotif] Audio unlocked, replaying ${queue.length} queued sound(s):`, queue);
                queue.forEach(type => playSound(type));
            }
        };

        window.addEventListener('click', handleInteraction, { once: true });
        window.addEventListener('keydown', handleInteraction, { once: true });
        window.addEventListener('pointerdown', handleInteraction, { once: true });

        return () => {
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('keydown', handleInteraction);
            window.removeEventListener('pointerdown', handleInteraction);
        };
    }, [getAudioCtx, playSound]);

    /* ════════════════════════════════════════════════════════════
       EFFECT 3: Listen to kitchen board events
       Each event type → play corresponding sound
       Only active when enabled (kitchen board page).
       ════════════════════════════════════════════════════════════ */
    useEffect(() => {
        const isKitchenBoardPage = () => {
            const path = window.location.pathname;
            return path === '/dashboard/kitchen' || path.startsWith('/dashboard/kitchen/');
        };

        const handlers = {};

        Object.entries(EVENT_SOUND_MAP).forEach(([eventName, soundType]) => {
            const handler = (event) => {
                if (!isKitchenBoardPage()) return;

                const detail = event?.detail || {};
                const count = Number(detail.count || 0);

                console.info(`[KitchenNotif] Event "${eventName}" received`, detail);
                enqueueOrPlay(soundType);

                // Browser notification for new orders
                if (eventName === 'kitchen:new-order' && count > 0) {
                    showBrowserNotification(
                        '🍳 Pesanan Baru dari Dapur!',
                        `Ada ${count} pesanan baru masuk.`
                    );
                }

                // Toast for all events (first-fire and repeating)
                if (eventName === 'kitchen:print-pending') {
                    toast('Pesanan menunggu cetak ke printer dapur.', { icon: '🖨️', duration: 4000 });
                }
                if (eventName === 'kitchen:print-reminder') {
                    toast.info('Pengingat: ada pesanan sudah tercetak tetapi belum diproses di dapur.');
                }
                if (eventName === 'kitchen:print-failed') {
                    toast.error('Cetak gagal! Periksa printer dapur.');
                }
                if (eventName === 'kitchen:print-success') {
                    toast.success('Cetak berhasil!');
                }
            };

            handlers[eventName] = handler;
            window.addEventListener(eventName, handler);
        });

        return () => {
            Object.entries(handlers).forEach(([eventName, handler]) => {
                window.removeEventListener(eventName, handler);
            });
        };
    }, [enqueueOrPlay, showBrowserNotification]);

    return children;
}
