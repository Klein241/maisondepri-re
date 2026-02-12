'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';
import { Download, X, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
    const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
    const [dismissed, setDismissed] = useState(false);
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

        // Check if user dismissed previously (with 24-hour expiration)
        const dismissedAt = localStorage.getItem('pwa_install_dismissed');
        if (dismissedAt) {
            const elapsed = Date.now() - parseInt(dismissedAt);
            if (elapsed < 24 * 60 * 60 * 1000) {
                setDismissed(true);
            } else {
                localStorage.removeItem('pwa_install_dismissed');
            }
        }

        const handleBeforeInstall = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        const handleAppInstalled = () => {
            setIsInstalled(true);
            setDeferredPrompt(null);
            toast.success('🎉 Application installée !', {
                description: 'MAISON DE PRIERE est maintenant sur votre écran d\'accueil.',
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

                if (VAPID_PUBLIC_KEY && swRegistration) {
                    try {
                        const subscription = await swRegistration.pushManager.subscribe({
                            userVisuallyPrompts: true,
                            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
                        } as any);
                        console.log('[PWA] Push subscription:', JSON.stringify(subscription));
                    } catch (e) {
                        console.warn('[PWA] Push subscription failed:', e);
                    }
                }

                if (swRegistration) {
                    swRegistration.showNotification('MAISON DE PRIERE', {
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
            setIsInstalled(true);
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

        const registerPeriodicSync = async () => {
            try {
                if ('periodicSync' in swRegistration) {
                    await (swRegistration as any).periodicSync.register('daily-reminder', {
                        minInterval: 24 * 60 * 60 * 1000,
                    });
                }
            } catch (e) {
                scheduleLocalReminder();
            }
        };

        registerPeriodicSync();
    }, [swRegistration, notifPermission]);

    const scheduleLocalReminder = useCallback(() => {
        const now = new Date();
        const nextReminder = new Date();
        nextReminder.setHours(8, 0, 0, 0);

        if (nextReminder <= now) {
            nextReminder.setDate(nextReminder.getDate() + 1);
        }

        const delay = nextReminder.getTime() - now.getTime();

        setTimeout(() => {
            sendLocalNotification(
                '🙏 Temps de prière',
                'Commencez votre journée avec la Parole !'
            );
            scheduleLocalReminder();
        }, delay);
    }, [sendLocalNotification]);

    // Auto-request notifications after login
    useEffect(() => {
        if (!user || notifPermission !== 'default') return;

        const timer = setTimeout(() => {
            requestNotificationPermission();
        }, 10000);

        return () => clearTimeout(timer);
    }, [user, notifPermission, requestNotificationPermission]);

    // Expose PWA functions globally
    useEffect(() => {
        (window as any).__pwa = {
            installApp,
            requestNotificationPermission,
            queueOfflineAction,
            sendLocalNotification,
            isOnline,
            isInstalled,
            notifPermission,
            swRegistration,
        };
    }, [installApp, requestNotificationPermission, queueOfflineAction, sendLocalNotification, isOnline, isInstalled, notifPermission, swRegistration]);

    const handleDismiss = () => {
        setDismissed(true);
        localStorage.setItem('pwa_install_dismissed', Date.now().toString());
    };

    // Show install button? Only when not installed, not dismissed, and prompt is available or general fallback
    const showInstallButton = !isInstalled && !dismissed;

    return (
        <>
            {/* Offline indicator bar */}
            {!isOnline && (
                <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-600 text-white text-center py-1.5 text-xs font-bold animate-pulse">
                    📴 Mode hors-ligne — Les données seront synchronisées automatiquement
                </div>
            )}

            {/* Fixed PWA Install Button - Bottom right, always visible */}
            <AnimatePresence>
                {showInstallButton && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 20 }}
                        transition={{ delay: 2, duration: 0.4 }}
                        className="fixed bottom-40 left-4 z-[9998] flex flex-col items-start gap-2"
                    >
                        {/* Dismiss button */}
                        <button
                            onClick={handleDismiss}
                            className="h-6 w-6 rounded-full bg-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/20 transition-colors"
                        >
                            <X className="h-3 w-3" />
                        </button>

                        {/* Install button */}
                        <motion.button
                            onClick={installApp}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-2xl shadow-indigo-500/30 border border-indigo-500/30 hover:shadow-indigo-500/50 transition-shadow"
                        >
                            <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                                <Download className="h-5 w-5" />
                            </div>
                            <div className="text-left">
                                <p className="text-xs font-bold leading-tight">Installer l&apos;app</p>
                                <p className="text-[10px] text-white/60 leading-tight">Accès rapide</p>
                            </div>
                        </motion.button>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
