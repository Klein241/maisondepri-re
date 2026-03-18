// Service Worker — Maison de Prière
// Handles: Push Notifications, Offline caching, Library book caching
// Backend: Cloudflare Worker (maisondepriere-api)

const CACHE_NAME = 'mdp-cache-v3';
const BOOK_CACHE = 'mdp-books-v1';

// App shell files to precache
const APP_SHELL = [
    '/',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png',
];

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
        } else if (data.data?.bookId) {
            actions.push({ action: 'read', title: '📖 Lire' });
        } else if (data.data?.orderId) {
            actions.push({ action: 'view', title: '📦 Voir' });
        }
        actions.push({ action: 'open', title: 'Ouvrir' });

        const options = {
            body: data.body || data.message || '',
            icon: data.icon || '/icon-192.png',
            badge: data.badge || '/icon-192.png',
            vibrate: [100, 50, 100],
            data: data.data || { url: '/' },
            actions,
            tag: data.tag || `mdp-${Date.now()}`,
            renotify: true,
            requireInteraction: !!(data.data?.conversationId || data.data?.orderId),
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
    } else if (data.bookId) {
        url = `/?tab=library&book=${data.bookId}`;
    } else if (data.orderId) {
        url = `/?tab=marketplace&order=${data.orderId}`;
    } else if (data.type === 'marketplace_message') {
        url = `/?tab=marketplace`;
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

// Listen for messages from the app
self.addEventListener('message', (event) => {
    if (!event.data) return;

    // Show notification
    if (event.data.type === 'SHOW_NOTIFICATION') {
        self.registration.showNotification(event.data.title || 'Maison de Prière', {
            body: event.data.body || '',
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: event.data.tag || `msg_${Date.now()}`,
            data: { url: event.data.url || '/' },
            vibrate: [100, 50, 100],
        });
    }

    // Cache a book for offline reading
    if (event.data.type === 'CACHE_BOOK') {
        const { url, title } = event.data;
        if (url) {
            caches.open(BOOK_CACHE).then(cache => {
                fetch(url).then(response => {
                    if (response.ok) {
                        cache.put(url, response.clone());
                        // Notify the app that caching is done
                        event.source?.postMessage({
                            type: 'BOOK_CACHED',
                            url,
                            title,
                            success: true,
                        });
                    }
                }).catch(err => {
                    event.source?.postMessage({
                        type: 'BOOK_CACHED',
                        url,
                        title,
                        success: false,
                        error: err.message,
                    });
                });
            });
        }
    }

    // Remove a cached book
    if (event.data.type === 'UNCACHE_BOOK') {
        const { url } = event.data;
        if (url) {
            caches.open(BOOK_CACHE).then(cache => cache.delete(url));
        }
    }

    // Check which books are cached
    if (event.data.type === 'GET_CACHED_BOOKS') {
        caches.open(BOOK_CACHE).then(cache => {
            cache.keys().then(requests => {
                const urls = requests.map(r => r.url);
                event.source?.postMessage({
                    type: 'CACHED_BOOKS_LIST',
                    urls,
                });
            });
        });
    }
});

// Install — precache app shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(APP_SHELL).catch(() => {
                // Some files may not exist, that's ok
            });
        })
    );
    self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(k => k !== CACHE_NAME && k !== BOOK_CACHE)
                    .map(k => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

// Fetch — serve cached books offline, network-first for everything else
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // For book files (R2 or Supabase storage URLs): cache-first strategy
    if (url.pathname.includes('/r2/books/') || url.pathname.includes('/library/books/')) {
        event.respondWith(
            caches.open(BOOK_CACHE).then(cache =>
                cache.match(event.request).then(cached => {
                    if (cached) return cached;
                    return fetch(event.request).then(response => {
                        if (response.ok) {
                            cache.put(event.request, response.clone());
                        }
                        return response;
                    });
                })
            ).catch(() => {
                return new Response('Livre non disponible hors ligne', {
                    status: 503,
                    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
                });
            })
        );
        return;
    }

    // For cover images: cache-first
    if (url.pathname.includes('/r2/covers/') || url.pathname.includes('/library/covers/')) {
        event.respondWith(
            caches.open(BOOK_CACHE).then(cache =>
                cache.match(event.request).then(cached => {
                    if (cached) return cached;
                    return fetch(event.request).then(response => {
                        if (response.ok) {
                            cache.put(event.request, response.clone());
                        }
                        return response;
                    });
                })
            ).catch(() => fetch(event.request))
        );
        return;
    }

    // For navigation requests: network-first with offline fallback
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() =>
                caches.match('/').then(cached => cached || new Response('Hors ligne', { status: 503 }))
            )
        );
        return;
    }
});
