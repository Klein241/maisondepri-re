'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';

/**
 * PushNotificationManager
 * 
 * Registers the Service Worker and subscribes to Web Push notifications.
 * Should be mounted once in the root layout.
 * 
 * Flow:
 * 1. Register /sw.js
 * 2. Get VAPID public key from the proxy server
 * 3. Subscribe to push via the browser
 * 4. Send subscription to the proxy server
 * 5. Server sends push when new notifications arrive in Supabase
 */
export function PushNotificationManager() {
    const user = useAppStore(s => s.user);
    const appSettings = useAppStore(s => s.appSettings);
    const initialized = useRef(false);

    useEffect(() => {
        if (!user?.id || initialized.current) return;
        const proxyUrl = appSettings?.['live_proxy_url'];
        if (!proxyUrl) return;

        initialized.current = true;

        async function registerPush() {
            try {
                // 1. Check browser support
                if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
                    console.log('Push not supported');
                    return;
                }

                // 2. Register service worker
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('✅ SW registered');

                // 3. Get VAPID key from proxy
                const vapidRes = await fetch(`${proxyUrl}/api/push/vapid-key`);
                const { publicKey } = await vapidRes.json();
                if (!publicKey) {
                    console.log('No VAPID key configured on proxy');
                    return;
                }

                // 4. Check existing subscription
                let subscription = await registration.pushManager.getSubscription();

                if (!subscription) {
                    // 5. Subscribe
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
                    console.log('✅ Push subscribed');
                }

                // 6. Send subscription to proxy server
                await fetch(`${proxyUrl}/api/push/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: user.id,
                        subscription: subscription.toJSON(),
                    }),
                });
                console.log('✅ Push registered with proxy');
            } catch (e) {
                console.warn('Push registration failed:', e);
            }
        }

        // Delay to not block initial render
        setTimeout(registerPush, 5000);
    }, [user?.id, appSettings]);

    return null; // This component renders nothing
}

export default PushNotificationManager;
