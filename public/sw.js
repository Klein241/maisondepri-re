// Service Worker — Maison de Prière
// Handles: Push Notifications, Offline caching

const CACHE_NAME = 'mdp-cache-v1';

// Push notification received
self.addEventListener('push', (event) => {
    if (!event.data) return;

    try {
        const data = event.data.json();
        const options = {
            body: data.body || data.message || '',
            icon: data.icon || '/icons/icon-192x192.png',
            badge: data.badge || '/icons/icon-72x72.png',
            vibrate: [100, 50, 100],
            data: data.data || { url: '/' },
            actions: [
                { action: 'open', title: 'Ouvrir' },
                { action: 'dismiss', title: 'Fermer' },
            ],
            tag: data.tag || 'mdp-notification',
            renotify: true,
        };

        event.waitUntil(
            self.registration.showNotification(data.title || 'Maison de Prière', options)
        );
    } catch (e) {
        console.error('Push parse error:', e);
    }
});

// Notification clicked
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'dismiss') return;

    const url = event.notification.data?.url || '/';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            // Focus existing window if open
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.navigate(url);
                    return client.focus();
                }
            }
            // Open new window
            return clients.openWindow(url);
        })
    );
});

// Install — cache essential assets
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});
