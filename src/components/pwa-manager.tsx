'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';

// VAPID public key - In production, generate your own pair:
// npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export function PWAManager() {
    const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
    const [isOnline, setIsOnline] = useState(true);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [showInstallBanner, setShowInstallBanner] = useState(false);
    const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
    const user = useAppStore(s => s.user);

    // Register service worker
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!('serviceWorker' in navigator)) {
            console.warn('[PWA] Service Workers not supported');
            return;
        }

        const registerSW = async () => {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js', {
                    scope: '/',
                    updateViaCache: 'none',
                });

                setSwRegistration(registration);
                console.log('[PWA] Service Worker registered:', registration.scope);

                // Check for updates every 30 minutes
                setInterval(() => {
                    registration.update();
                }, 30 * 60 * 1000);

                // Handle updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (!newWorker) return;

                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
                            toast.info('Mise à jour disponible', {
                                description: 'Rechargez la page pour les dernières améliorations.',
                                action: {
                                    label: 'Recharger',
                                    onClick: () => window.location.reload(),
                                },
                                duration: 10000,
                            });
                        }
                    });
                });
            } catch (error) {
                console.error('[PWA] SW registration failed:', error);
            }
        };

        registerSW();
    }, []);

    // Online/Offline detection
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleOnline = () => {
            setIsOnline(true);
            toast.success('🌐 Connexion rétablie', {
                description: 'Synchronisation des données en cours...',
                duration: 3000,
            });
            // Trigger background sync
            if (swRegistration && 'sync' in swRegistration) {
                (swRegistration as any).sync.register('sync-progress').catch(() => { });
                (swRegistration as any).sync.register('sync-prayers').catch(() => { });
            }
        };

        const handleOffline = () => {
            setIsOnline(false);
            toast.warning('📴 Mode hors-ligne', {
                description: 'Vos actions seront synchronisées automatiquement.',
                duration: 5000,
            });
        };

        setIsOnline(navigator.onLine);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [swRegistration]);

    // PWA Install prompt
    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Check if already installed
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches
            || (window.navigator as any).standalone === true;
        setIsInstalled(isStandalone);

        const handleBeforeInstall = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
            // Show install banner after 30 seconds
            setTimeout(() => {
                if (!isStandalone) {
                    setShowInstallBanner(true);
                }
            }, 30000);
        };

        const handleAppInstalled = () => {
            setIsInstalled(true);
            setShowInstallBanner(false);
            setDeferredPrompt(null);
            toast.success('🎉 Application installée !', {
                description: 'Prayer Marathon est maintenant sur votre écran d\'accueil.',
            });
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstall);
        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    // Notification permission check
    useEffect(() => {
        if (typeof window === 'undefined' || !('Notification' in window)) return;
        setNotifPermission(Notification.permission);
    }, []);

    // Request notification permission
    const requestNotificationPermission = useCallback(async () => {
        if (!('Notification' in window)) {
            toast.error('Les notifications ne sont pas supportées par ce navigateur');
            return false;
        }

        try {
            const permission = await Notification.requestPermission();
            setNotifPermission(permission);

            if (permission === 'granted') {
                toast.success('🔔 Notifications activées !');

                // Subscribe to push notifications if VAPID key is set
                if (VAPID_PUBLIC_KEY && swRegistration) {
                    try {
                        const subscription = await swRegistration.pushManager.subscribe({
                            userVisuallyPrompts: true,
                            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
                        } as any);

                        // Send subscription to server
                        // In production, send this to your Supabase Edge Function
                        console.log('[PWA] Push subscription:', JSON.stringify(subscription));
                    } catch (e) {
                        console.warn('[PWA] Push subscription failed:', e);
                    }
                }

                // Show a test notification
                if (swRegistration) {
                    swRegistration.showNotification('Prayer Marathon', {
                        body: 'Les notifications sont activées ! Vous recevrez des rappels quotidiens.',
                        icon: '/icon-192.png',
                        badge: '/icon-192.png',
                        tag: 'welcome-notif',
                    });
                }

                return true;
            } else {
                toast.error('Notifications refusées. Activez-les dans les paramètres du navigateur.');
                return false;
            }
        } catch (e) {
            console.error('[PWA] Notification permission error:', e);
            return false;
        }
    }, [swRegistration]);

    // Install PWA
    const installApp = useCallback(async () => {
        if (!deferredPrompt) {
            toast.info('Utilisez le menu de votre navigateur pour installer l\'app');
            return;
        }

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            setShowInstallBanner(false);
        }
        setDeferredPrompt(null);
    }, [deferredPrompt]);

    // Queue action for offline sync
    const queueOfflineAction = useCallback((action: {
        url: string;
        method: string;
        body: any;
    }) => {
        if (swRegistration?.active) {
            swRegistration.active.postMessage({
                type: 'QUEUE_SYNC',
                action,
            });
        }
    }, [swRegistration]);

    // Send local notification
    const sendLocalNotification = useCallback((title: string, body: string, url?: string) => {
        if (swRegistration?.active) {
            swRegistration.active.postMessage({
                type: 'SHOW_NOTIFICATION',
                title,
                body,
                url,
            });
        }
    }, [swRegistration]);

    // Schedule daily reminder notification
    useEffect(() => {
        if (!swRegistration || notifPermission !== 'granted') return;

        // Try periodic sync for daily reminders
        const registerPeriodicSync = async () => {
            try {
                if ('periodicSync' in swRegistration) {
                    await (swRegistration as any).periodicSync.register('daily-reminder', {
                        minInterval: 24 * 60 * 60 * 1000, // 24 hours
                    });
                    console.log('[PWA] Periodic sync registered');
                }
            } catch (e) {
                console.warn('[PWA] Periodic sync not supported, using fallback');
                // Fallback: use setTimeout for next reminder
                scheduleLocalReminder();
            }
        };

        registerPeriodicSync();
    }, [swRegistration, notifPermission]);

    // Fallback reminder using setTimeout
    const scheduleLocalReminder = useCallback(() => {
        const now = new Date();
        const nextReminder = new Date();
        nextReminder.setHours(8, 0, 0, 0); // 8 AM

        if (nextReminder <= now) {
            nextReminder.setDate(nextReminder.getDate() + 1);
        }

        const delay = nextReminder.getTime() - now.getTime();

        setTimeout(() => {
            sendLocalNotification(
                '🙏 Temps de prière',
                'Commencez votre journée avec la Parole !'
            );
            scheduleLocalReminder(); // Schedule next one
        }, delay);
    }, [sendLocalNotification]);

    // Auto-request notifications after login
    useEffect(() => {
        if (!user || notifPermission !== 'default') return;

        // Wait 10 seconds after login to ask
        const timer = setTimeout(() => {
            requestNotificationPermission();
        }, 10000);

        return () => clearTimeout(timer);
    }, [user, notifPermission, requestNotificationPermission]);

    // Expose PWA functions globally for other components
    useEffect(() => {
        (window as any).__pwa = {
            installApp,
            requestNotificationPermission,
            queueOfflineAction,
            sendLocalNotification,
            isOnline,
            isInstalled,
            showInstallBanner,
            notifPermission,
            swRegistration,
        };
    }, [installApp, requestNotificationPermission, queueOfflineAction, sendLocalNotification, isOnline, isInstalled, showInstallBanner, notifPermission, swRegistration]);

    // Render: Install banner + Offline indicator
    return (
        <>
            {/* Offline indicator bar */}
            {!isOnline && (
                <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-600 text-white text-center py-1.5 text-xs font-bold animate-pulse">
                    📴 Mode hors-ligne — Les données seront synchronisées automatiquement
                </div>
            )}

            {/* PWA Install Banner */}
            {showInstallBanner && !isInstalled && (
                <div className="fixed bottom-20 left-4 right-4 z-[9998] bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-4 shadow-2xl shadow-indigo-500/30 border border-indigo-500/30 animate-in slide-in-from-bottom-5">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                            <span className="text-2xl">🙏</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-white font-bold text-sm">Installer Prayer Marathon</p>
                            <p className="text-white/70 text-xs mt-0.5">Accédez rapidement depuis votre écran d'accueil</p>
                        </div>
                        <div className="flex flex-col gap-1.5 shrink-0">
                            <button
                                onClick={installApp}
                                className="bg-white text-indigo-700 font-bold text-xs px-4 py-2 rounded-xl hover:bg-white/90 transition-colors"
                            >
                                Installer
                            </button>
                            <button
                                onClick={() => setShowInstallBanner(false)}
                                className="text-white/60 text-[10px] hover:text-white/80"
                            >
                                Plus tard
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
