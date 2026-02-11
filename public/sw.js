/// <reference lib="webworker" />

const CACHE_NAME = 'prayer-marathon-v3';
const OFFLINE_URL = '/';

// Resources to cache in advance for offline use
const STATIC_ASSETS = [
    '/',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png',
];

// Bible books to precache for offline reading
const BIBLE_CACHE_NAME = 'prayer-marathon-bible-v1';

// Sync queue stored in IndexedDB
const DB_NAME = 'prayer-marathon-sync';
const STORE_NAME = 'pending-actions';

// ==================== INSTALL ====================
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            // Cache static assets
            for (const url of STATIC_ASSETS) {
                try {
                    await cache.add(url);
                } catch (e) {
                    console.warn('[SW] Failed to cache:', url);
                }
            }
        })
    );
    // Activate immediately
    self.skipWaiting();
});

// ==================== ACTIVATE ====================
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME && name !== BIBLE_CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    // Take control of all clients immediately
    self.clients.claim();
});

// ==================== FETCH (Offline Strategy) ====================
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip Supabase API calls (these use online-first)
    if (url.hostname.includes('supabase')) return;

    // Skip chrome-extension and other non-http
    if (!url.protocol.startsWith('http')) return;

    // Bible files: Cache-first strategy (they never change)
    if (url.pathname.startsWith('/bible/')) {
        event.respondWith(
            caches.open(BIBLE_CACHE_NAME).then(async (cache) => {
                const cached = await cache.match(event.request);
                if (cached) return cached;

                try {
                    const response = await fetch(event.request);
                    if (response.ok) {
                        cache.put(event.request, response.clone());
                    }
                    return response;
                } catch (e) {
                    return new Response('Bible content unavailable offline', { status: 503 });
                }
            })
        );
        return;
    }

    // Static assets (_next/static): Cache-first
    if (url.pathname.startsWith('/_next/static/')) {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                if (cached) return cached;
                return fetch(event.request).then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    }
                    return response;
                });
            })
        );
        return;
    }

    // Navigation requests: Network-first with offline fallback
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Cache the page for offline use
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => {
                    // Return cached version or offline page
                    return caches.match(event.request).then((cached) => {
                        return cached || caches.match(OFFLINE_URL);
                    });
                })
        );
        return;
    }

    // Other assets: Stale-while-revalidate
    event.respondWith(
        caches.match(event.request).then((cached) => {
            const fetchPromise = fetch(event.request)
                .then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    }
                    return response;
                })
                .catch(() => cached || new Response('', { status: 503 }));

            return cached || fetchPromise;
        })
    );
});

// ==================== PUSH NOTIFICATIONS ====================
self.addEventListener('push', (event) => {
    let data = {
        title: 'Prayer Marathon',
        body: 'Vous avez une nouvelle notification',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'prayer-marathon',
        data: { url: '/' }
    };

    if (event.data) {
        try {
            const payload = event.data.json();
            data = {
                title: payload.title || data.title,
                body: payload.body || data.body,
                icon: payload.icon || data.icon,
                badge: payload.badge || data.badge,
                tag: payload.tag || data.tag,
                data: payload.data || data.data,
            };
        } catch (e) {
            data.body = event.data.text();
        }
    }

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: data.icon,
            badge: data.badge,
            tag: data.tag,
            data: data.data,
            vibrate: [200, 100, 200],
            requireInteraction: false,
            actions: [
                { action: 'open', title: 'Ouvrir' },
                { action: 'close', title: 'Fermer' }
            ]
        })
    );
});

// ==================== NOTIFICATION CLICK ====================
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'close') return;

    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // If we have an existing window, focus it
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.navigate(urlToOpen);
                    return client.focus();
                }
            }
            // Otherwise, open a new window
            return self.clients.openWindow(urlToOpen);
        })
    );
});

// ==================== BACKGROUND SYNC ====================
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-progress') {
        event.waitUntil(syncPendingProgress());
    }
    if (event.tag === 'sync-prayers') {
        event.waitUntil(syncPendingPrayers());
    }
});

// ==================== PERIODIC SYNC (Daily Reminders) ====================
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'daily-reminder') {
        event.waitUntil(showDailyReminder());
    }
});

// ==================== MESSAGE HANDLER ====================
self.addEventListener('message', (event) => {
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data.type === 'CACHE_BIBLE_BOOK') {
        event.waitUntil(cacheBibleBook(event.data.bookId));
    }

    if (event.data.type === 'SHOW_NOTIFICATION') {
        event.waitUntil(
            self.registration.showNotification(event.data.title, {
                body: event.data.body,
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                tag: event.data.tag || 'prayer-marathon-local',
                data: { url: event.data.url || '/' },
                vibrate: [200, 100, 200],
            })
        );
    }

    if (event.data.type === 'QUEUE_SYNC') {
        event.waitUntil(queueAction(event.data.action));
    }
});

// ==================== HELPER FUNCTIONS ====================

async function cacheBibleBook(bookId) {
    const cache = await caches.open(BIBLE_CACHE_NAME);
    try {
        const response = await fetch(`/bible/${bookId}.txt`);
        if (response.ok) {
            await cache.put(`/bible/${bookId}.txt`, response);
        }
    } catch (e) {
        console.warn('[SW] Failed to cache bible book:', bookId);
    }
}

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

async function queueAction(action) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).add({
            ...action,
            timestamp: Date.now()
        });
        await new Promise((r, e) => { tx.oncomplete = r; tx.onerror = e; });

        // Register background sync
        if ('sync' in self.registration) {
            await self.registration.sync.register('sync-progress');
        }
    } catch (e) {
        console.error('[SW] Queue action failed:', e);
    }
}

async function syncPendingProgress() {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);

        const actions = await new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        for (const action of actions) {
            try {
                const response = await fetch(action.url, {
                    method: action.method || 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(action.body)
                });

                if (response.ok) {
                    // Remove from queue
                    const deleteTx = db.transaction(STORE_NAME, 'readwrite');
                    deleteTx.objectStore(STORE_NAME).delete(action.id);
                }
            } catch (e) {
                // Will retry on next sync
                console.warn('[SW] Sync failed for action:', action.id);
            }
        }
    } catch (e) {
        console.error('[SW] Sync progress failed:', e);
    }
}

async function syncPendingPrayers() {
    // Similar to syncPendingProgress but for prayer requests
    return syncPendingProgress();
}

async function showDailyReminder() {
    const hour = new Date().getHours();

    // Only show between 6 AM and 10 PM
    if (hour < 6 || hour > 22) return;

    const messages = [
        { title: '🙏 Temps de prière', body: 'N\'oubliez pas votre moment de prière aujourd\'hui !' },
        { title: '📖 Lecture du jour', body: 'Votre passage biblique du jour vous attend.' },
        { title: '🔥 Continuez votre série !', body: 'Ne brisez pas votre série de jours consécutifs !' },
        { title: '✨ Marathon de prière', body: 'Prenez un moment pour méditer sur la Parole.' },
    ];

    const msg = messages[Math.floor(Math.random() * messages.length)];

    await self.registration.showNotification(msg.title, {
        body: msg.body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'daily-reminder',
        data: { url: '/' },
        vibrate: [200, 100, 200],
    });
}
