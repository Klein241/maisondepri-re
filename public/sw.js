// Service Worker — Maison de Prière
// Handles: Push Notifications, Offline caching
// Backend: Cloudflare Worker (maisondepriere-api)

const CACHE_NAME = 'mdp-cache-v2';

// Push notification received
self.addEventListener('push', (event) => {
    if (!event.data) return;

    try {
        const data = event.data.json();

        // Build actions based on notification type
        const actions = [];
        if (data.data?.conversationId) {
            actions.push({ action: 'reply', title: '💬 Répondre' });
        } else if (data.data?.prayerId) {
            actions.push({ action: 'pray', title: '🙏 Prier' });
        }
        actions.push({ action: 'open', title: 'Ouvrir' });

        const options = {
            body: data.body || data.message || '',
            icon: data.icon || '/icons/icon-192x192.png',
            badge: data.badge || '/icons/icon-72x72.png',
            vibrate: [100, 50, 100],
            data: data.data || { url: '/' },
            actions,
            tag: data.tag || `mdp-${Date.now()}`,
            renotify: true,
            requireInteraction: !!data.data?.conversationId, // Keep DM notifs visible
        };

        event.waitUntil(
            self.registration.showNotification(data.title || 'Maison de Prière', options)
        );
    } catch (e) {
        console.error('Push parse error:', e);
    }
});

// Notification clicked — deep-link to exact conversation/view
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'dismiss') return;

    // Build target URL from notification data
    const data = event.notification.data || {};
    let url = data.url || '/';

    // Deep-link: if we have conversationId, go to chat
    if (data.conversationId) {
        url = `/?nav=conversation&id=${data.conversationId}`;
    } else if (data.groupId) {
        url = `/?nav=group&id=${data.groupId}`;
    } else if (data.prayerId) {
        url = `/?nav=prayer&id=${data.prayerId}`;
    }

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

// Listen for SHOW_NOTIFICATION messages from the app
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        self.registration.showNotification(event.data.title || 'Maison de Prière', {
            body: event.data.body || '',
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
            tag: event.data.tag || `msg_${Date.now()}`,
            data: { url: event.data.url || '/' },
            vibrate: [100, 50, 100],
        });
    }
});

// Install
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
