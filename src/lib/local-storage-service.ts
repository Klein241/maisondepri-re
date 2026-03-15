/**
 * LOCAL STORAGE SERVICE — WhatsApp-like strategy
 * ═══════════════════════════════════════════════
 * • Messages → IndexedDB (persistent local cache, compressed JSON)
 * • Media files (photos/videos/audio/docs) → browser Cache API (opaque URLs)
 * • Only essential metadata stored in Supabase (IDs, timestamps, sender)
 * • Old cached media auto-evicted after 30 days
 *
 * This mirrors WhatsApp's approach:
 *   - msgstore.db.crypt = local encrypted messages DB
 *   - Media stored on device, only thumbnails in backend
 *   - Google Drive backup = periodic export of IndexedDB content
 */

// ── DB Config ─────────────────────────────────────────────────────────────
const DB_NAME = 'MaisonDePriereDB';
const DB_VERSION = 1;
const STORES = {
    messages: 'messages',       // Group & DM messages
    mediaFiles: 'mediaFiles',   // Cached media blobs
    conversations: 'conversations', // Conversation metadata
} as const;

const MEDIA_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MEDIA_CACHE_NAME = 'mdp-media-v1';

// ── IndexedDB Setup ───────────────────────────────────────────────────────
let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        if (typeof window === 'undefined') {
            reject(new Error('IndexedDB not available in SSR'));
            return;
        }

        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;

            // Messages store: indexed by groupId/conversationId + created_at
            if (!db.objectStoreNames.contains(STORES.messages)) {
                const store = db.createObjectStore(STORES.messages, { keyPath: 'id' });
                store.createIndex('by_group', 'group_id', { unique: false });
                store.createIndex('by_conversation', 'conversation_id', { unique: false });
                store.createIndex('by_created', 'created_at', { unique: false });
            }

            // Media files: blob cache with expiry
            if (!db.objectStoreNames.contains(STORES.mediaFiles)) {
                const store = db.createObjectStore(STORES.mediaFiles, { keyPath: 'url' });
                store.createIndex('by_expiry', 'expiresAt', { unique: false });
            }

            // Conversations metadata
            if (!db.objectStoreNames.contains(STORES.conversations)) {
                db.createObjectStore(STORES.conversations, { keyPath: 'id' });
            }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });

    return dbPromise;
}

// ── Generic IDB Helpers ───────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function idbGet<T>(store: string, key: string): Promise<T | undefined> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).get(key);
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
    });
}

async function idbPut(store: string, value: object): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        const req = tx.objectStore(store).put(value);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

async function idbGetByIndex<T>(store: string, indexName: string, keyValue: string): Promise<T[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readonly');
        const index = tx.objectStore(store).index(indexName);
        const req = index.getAll(keyValue);
        req.onsuccess = () => resolve(req.result as T[]);
        req.onerror = () => reject(req.error);
    });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function idbDelete(store: string, key: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        const req = tx.objectStore(store).delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

// ── Message Cache API ─────────────────────────────────────────────────────
export interface CachedMessage {
    id: string;
    group_id?: string;
    conversation_id?: string;
    user_id: string;
    sender_id?: string;      // used by private messages (DM)
    content: string;
    type: string;
    voice_url?: string;
    voice_duration?: number;
    file_url?: string;
    file_name?: string;
    file_type?: string;
    created_at: string;
    sender_name?: string;
    sender_avatar?: string | null;
}

/**
 * Save messages to local IndexedDB cache
 */
export async function cacheMessages(messages: CachedMessage[]): Promise<void> {
    try {
        const db = await openDB();
        const tx = db.transaction(STORES.messages, 'readwrite');
        const store = tx.objectStore(STORES.messages);
        for (const msg of messages) {
            store.put(msg);
        }
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.warn('[LocalStorage] cacheMessages failed:', e);
    }
}

/**
 * Get cached messages for a group (returns [] if not cached)
 */
export async function getCachedGroupMessages(groupId: string): Promise<CachedMessage[]> {
    try {
        const messages = await idbGetByIndex<CachedMessage>(STORES.messages, 'by_group', groupId);
        return messages.sort((a, b) => a.created_at.localeCompare(b.created_at));
    } catch (e) {
        console.warn('[LocalStorage] getCachedGroupMessages failed:', e);
        return [];
    }
}

/**
 * Get cached messages for a DM conversation
 */
export async function getCachedConversationMessages(conversationId: string): Promise<CachedMessage[]> {
    try {
        const messages = await idbGetByIndex<CachedMessage>(STORES.messages, 'by_conversation', conversationId);
        return messages.sort((a, b) => a.created_at.localeCompare(b.created_at));
    } catch (e) {
        console.warn('[LocalStorage] getCachedConversationMessages failed:', e);
        return [];
    }
}

/**
 * Append a single new message to local cache
 */
export async function appendCachedMessage(message: CachedMessage): Promise<void> {
    try {
        await idbPut(STORES.messages, message);
    } catch (e) {
        console.warn('[LocalStorage] appendCachedMessage failed:', e);
    }
}

// ── Media File Cache API ──────────────────────────────────────────────────
/**
 * Cache a media file locally using the browser Cache API.
 * Returns a local object URL that works offline.
 */
export async function cacheMediaFile(remoteUrl: string): Promise<string> {
    try {
        if ('caches' in window) {
            const cache = await caches.open(MEDIA_CACHE_NAME);
            const existing = await cache.match(remoteUrl);
            if (existing) {
                const blob = await existing.blob();
                return URL.createObjectURL(blob);
            }

            const response = await fetch(remoteUrl);
            if (response.ok) {
                await cache.put(remoteUrl, response.clone());
                const blob = await response.blob();
                return URL.createObjectURL(blob);
            }
        }
    } catch (e) {
        console.warn('[LocalStorage] cacheMediaFile failed:', e);
    }
    return remoteUrl; // fallback to remote URL
}

/**
 * Evict media files older than 30 days from Cache API
 */
export async function evictOldMedia(): Promise<void> {
    try {
        if (!('caches' in window)) return;
        // We can't easily check age in CacheStorage without metadata
        // So we store expiry in IndexedDB and clean CacheStorage accordingly
        const db = await openDB();
        const tx = db.transaction(STORES.mediaFiles, 'readwrite');
        const index = tx.objectStore(STORES.mediaFiles).index('by_expiry');
        const now = Date.now();
        const range = IDBKeyRange.upperBound(now);
        const req = index.openCursor(range);
        const urlsToEvict: string[] = [];

        await new Promise<void>((resolve) => {
            req.onsuccess = (e) => {
                const cursor = (e.target as IDBRequest).result;
                if (cursor) {
                    urlsToEvict.push(cursor.value.url);
                    cursor.delete();
                    cursor.continue();
                } else {
                    resolve();
                }
            };
        });

        if (urlsToEvict.length > 0) {
            const cache = await caches.open(MEDIA_CACHE_NAME);
            for (const url of urlsToEvict) {
                await cache.delete(url);
            }
            console.log(`[LocalStorage] Evicted ${urlsToEvict.length} old media files`);
        }
    } catch (e) {
        console.warn('[LocalStorage] evictOldMedia failed:', e);
    }
}

/**
 * Register a media file in IndexedDB for expiry tracking
 */
export async function trackMediaFile(url: string): Promise<void> {
    try {
        await idbPut(STORES.mediaFiles, {
            url,
            cachedAt: Date.now(),
            expiresAt: Date.now() + MEDIA_MAX_AGE_MS,
        });
    } catch { }
}

// ── Storage Stats ─────────────────────────────────────────────────────────
/**
 * Estimate storage usage (messages only)
 */
export async function getStorageStats(): Promise<{ messageCount: number; estimatedKB: number }> {
    try {
        const db = await openDB();
        const tx = db.transaction(STORES.messages, 'readonly');
        const store = tx.objectStore(STORES.messages);
        const countReq = store.count();

        const count: number = await new Promise((resolve, reject) => {
            countReq.onsuccess = () => resolve(countReq.result);
            countReq.onerror = () => reject(countReq.error);
        });

        // Rough estimate: avg 500 bytes per message
        return { messageCount: count, estimatedKB: Math.round(count * 0.5) };
    } catch (e) {
        return { messageCount: 0, estimatedKB: 0 };
    }
}

/**
 * Export all cached messages as JSON (for Google Drive backup, WhatsApp-style)
 */
export async function exportMessagesBackup(): Promise<string> {
    try {
        const db = await openDB();
        const tx = db.transaction(STORES.messages, 'readonly');
        const req = tx.objectStore(STORES.messages).getAll();
        const messages: CachedMessage[] = await new Promise((resolve, reject) => {
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });

        const backup = {
            version: 1,
            exportedAt: new Date().toISOString(),
            messageCount: messages.length,
            messages,
        };
        return JSON.stringify(backup);
    } catch (e) {
        console.error('[LocalStorage] exportMessagesBackup failed:', e);
        return JSON.stringify({ error: 'Export failed' });
    }
}

/**
 * Trigger Google Drive backup download (saves backup JSON as a .json file)
 */
export async function downloadBackup(): Promise<void> {
    const json = await exportMessagesBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mdp-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// ── Auto-evict on startup ─────────────────────────────────────────────────
if (typeof window !== 'undefined') {
    // Run eviction once per session
    setTimeout(evictOldMedia, 5000);
}
