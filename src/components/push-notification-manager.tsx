'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';

/**
 * PushNotificationManager
 * 
 * Registers the Service Worker and subscribes to Web Push notifications.
 * Priority: NEXT_PUBLIC_WORKER_URL env var > app_settings.cloudflare_worker_url
 */
export function PushNotificationManager() {
    const user = useAppStore(s => s.user);
    const appSettings = useAppStore(s => s.appSettings);
    const initialized = useRef(false);

    // Priority: env var > app_settings
    const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL
        || appSettings?.['cloudflare_worker_url']
        || '';

    useEffect(() => {
        if (!user?.id || initialized.current || !WORKER_URL) return;
        initialized.current = true;

        async function registerPush() {
            try {
                if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

                const registration = await navigator.serviceWorker.register('/sw.js');

                const vapidRes = await fetch(`${WORKER_URL}/api/push/vapid-key`);
                if (!vapidRes.ok) return;
                const { publicKey } = await vapidRes.json();
                if (!publicKey) return;

                let subscription = await registration.pushManager.getSubscription();

                if (!subscription) {
                    const urlBase64ToUint8Array = (base64String: string) => {
                        const padding = '='.repeat((4 - base64String.length % 4) % 4);
                        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
                        const rawData = window.atob(base64);
                        return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
                    };

                    subscription = await registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: urlBase64ToUint8Array(publicKey),
                    });
                }

                await fetch(`${WORKER_URL}/api/push/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: user!.id,
                        subscription: subscription.toJSON(),
                    }),
                });
            } catch (e) {
                console.warn('Push registration skipped:', e);
            }
        }

        const timer = setTimeout(registerPush, 5000);
        return () => clearTimeout(timer);
    }, [user?.id, WORKER_URL]);

    return null;
}

export default PushNotificationManager;
