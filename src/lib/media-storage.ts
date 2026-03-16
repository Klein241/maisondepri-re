/**
 * ═══════════════════════════════════════════════════════════
 * Media Storage — WhatsApp-like storage system
 * 
 * Architecture:
 * 1. UPLOAD: User picks media → stored temporarily on Supabase → 
 *    thumbnail generated → full file pushed to IndexedDB (device)
 * 2. DOWNLOAD: When user opens media → check IndexedDB first →
 *    if not found, fetch from Supabase → store in IndexedDB
 * 3. BACKUP: Periodically sync to Google Drive (user's own account)
 * 4. CLEANUP: Old media from Supabase storage can be deleted
 *    since copies exist on device + Google Drive
 * 
 * Storage hierarchy:
 *   IndexedDB "mdp-media"
 *     ├── images/   (chat images, product images, avatars)
 *     ├── audio/    (voice messages)
 *     ├── video/    (short videos)
 *     └── documents/ (shared PDFs, etc.)
 * 
 * Benefits:
 *   - Supabase 10GB limit is just for temp transfer
 *   - Each user's phone/PC stores their own media (unlimited)
 *   - Google Drive backup = free cloud redundancy
 *   - Works offline (images load from IndexedDB)
 * ═══════════════════════════════════════════════════════════
 */

import { supabase } from './supabase';

// ═══════════════════════════════════════
// IndexedDB — Local Media Database
// ═══════════════════════════════════════

const DB_NAME = 'mdp-media';
const DB_VERSION = 2;
const STORES = ['images', 'audio', 'video', 'documents', 'thumbnails', 'meta'] as const;
type StoreName = typeof STORES[number];

let dbInstance: IDBDatabase | null = null;

async function openDB(): Promise<IDBDatabase> {
    if (dbInstance) return dbInstance;

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            for (const store of STORES) {
                if (!db.objectStoreNames.contains(store)) {
                    const objectStore = db.createObjectStore(store, { keyPath: 'id' });
                    objectStore.createIndex('by_date', 'createdAt', { unique: false });
                    objectStore.createIndex('by_conversation', 'conversationId', { unique: false });
                    objectStore.createIndex('by_type', 'mediaType', { unique: false });
                }
            }
        };

        request.onsuccess = (event) => {
            dbInstance = (event.target as IDBOpenDBRequest).result;
            resolve(dbInstance);
        };

        request.onerror = () => reject(request.error);
    });
}

// ═══════════════════════════════════════
// CORE OPERATIONS
// ═══════════════════════════════════════

export interface MediaItem {
    id: string;              // Unique media ID (UUID or hash)
    blob: Blob;              // The actual file data
    mimeType: string;        // e.g. 'image/jpeg', 'audio/webm'
    mediaType: 'image' | 'audio' | 'video' | 'document';
    fileName: string;
    fileSize: number;
    conversationId?: string; // Which chat this belongs to
    productId?: string;      // Which product this belongs to
    senderId?: string;
    thumbnailBlob?: Blob;    // Small preview
    supabaseUrl?: string;    // Temporary Supabase URL (for sharing/transfer)
    googleDriveId?: string;  // Google Drive file ID (after backup)
    createdAt: string;
    syncedToCloud: boolean;
}

/**
 * Save media file to local IndexedDB
 */
export async function saveMediaLocal(item: MediaItem): Promise<void> {
    const db = await openDB();
    const store = getStoreForType(item.mediaType);

    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        const objectStore = tx.objectStore(store);
        objectStore.put(item);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

/**
 * Get media file from local IndexedDB
 */
export async function getMediaLocal(id: string, mediaType?: string): Promise<MediaItem | null> {
    const db = await openDB();

    // Try specific store first, then all
    const storesToSearch = mediaType
        ? [getStoreForType(mediaType as any)]
        : STORES.filter(s => s !== 'meta' && s !== 'thumbnails');

    for (const store of storesToSearch) {
        try {
            const result = await new Promise<MediaItem | null>((resolve, reject) => {
                const tx = db.transaction(store, 'readonly');
                const request = tx.objectStore(store).get(id);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error);
            });
            if (result) return result;
        } catch { /* continue */ }
    }

    return null;
}

/**
 * Get all media for a conversation
 */
export async function getConversationMedia(conversationId: string, mediaType?: string): Promise<MediaItem[]> {
    const db = await openDB();
    const stores = mediaType
        ? [getStoreForType(mediaType as any)]
        : ['images', 'audio', 'video', 'documents'] as StoreName[];

    const results: MediaItem[] = [];

    for (const store of stores) {
        try {
            const items = await new Promise<MediaItem[]>((resolve, reject) => {
                const tx = db.transaction(store, 'readonly');
                const index = tx.objectStore(store).index('by_conversation');
                const request = index.getAll(conversationId);
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            });
            results.push(...items);
        } catch { /* continue */ }
    }

    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Delete media from local storage
 */
export async function deleteMediaLocal(id: string, mediaType?: string): Promise<void> {
    const db = await openDB();
    const stores = mediaType
        ? [getStoreForType(mediaType as any)]
        : STORES.filter(s => s !== 'meta');

    for (const store of stores) {
        try {
            await new Promise<void>((resolve, reject) => {
                const tx = db.transaction(store, 'readwrite');
                tx.objectStore(store).delete(id);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        } catch { /* continue */ }
    }
}

/**
 * Get total storage usage
 */
export async function getStorageStats(): Promise<{
    totalSize: number;
    counts: Record<string, number>;
    breakdown: Record<string, number>;
}> {
    const db = await openDB();
    const counts: Record<string, number> = {};
    const breakdown: Record<string, number> = {};
    let totalSize = 0;

    for (const store of ['images', 'audio', 'video', 'documents'] as StoreName[]) {
        try {
            const items = await new Promise<MediaItem[]>((resolve, reject) => {
                const tx = db.transaction(store, 'readonly');
                const request = tx.objectStore(store).getAll();
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            });

            counts[store] = items.length;
            const storeSize = items.reduce((sum, item) => sum + (item.fileSize || 0), 0);
            breakdown[store] = storeSize;
            totalSize += storeSize;
        } catch {
            counts[store] = 0;
            breakdown[store] = 0;
        }
    }

    return { totalSize, counts, breakdown };
}

// ═══════════════════════════════════════
// UPLOAD FLOW — Supabase → IndexedDB
// ═══════════════════════════════════════

/**
 * Upload media: saves to Supabase for sharing URL, then caches locally
 * Returns the Supabase public URL (for sending in messages)
 */
export async function uploadMedia(
    file: File,
    userId: string,
    options?: {
        conversationId?: string;
        productId?: string;
        generateThumbnail?: boolean;
    }
): Promise<{ url: string; mediaItem: MediaItem }> {
    const mediaType = getMediaType(file.type);
    const ext = file.name.split('.').pop() || 'bin';
    const mediaId = crypto.randomUUID();
    const filePath = `media/${userId}/${mediaType}/${mediaId}.${ext}`;

    // 1. Upload to Supabase (temporary — for URL)
    const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file, {
            upsert: true,
            contentType: file.type,
        });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

    // 2. Generate thumbnail for images
    let thumbnailBlob: Blob | undefined;
    if (options?.generateThumbnail && mediaType === 'image') {
        thumbnailBlob = await generateThumbnail(file, 200);
    }

    // 3. Save to IndexedDB (local device)
    const mediaItem: MediaItem = {
        id: mediaId,
        blob: file,
        mimeType: file.type,
        mediaType,
        fileName: file.name,
        fileSize: file.size,
        conversationId: options?.conversationId,
        productId: options?.productId,
        senderId: userId,
        thumbnailBlob,
        supabaseUrl: urlData.publicUrl,
        syncedToCloud: false,
        createdAt: new Date().toISOString(),
    };

    await saveMediaLocal(mediaItem);

    // 4. Save thumbnail separately
    if (thumbnailBlob) {
        await saveMediaLocal({
            ...mediaItem,
            id: `thumb_${mediaId}`,
            blob: thumbnailBlob,
            fileSize: thumbnailBlob.size,
        } as any);
    }

    return { url: urlData.publicUrl, mediaItem };
}

/**
 * Download & cache media from URL to local storage
 */
export async function downloadAndCache(
    url: string,
    mediaId: string,
    mediaType: 'image' | 'audio' | 'video' | 'document',
    conversationId?: string
): Promise<MediaItem | null> {
    // Check if already cached
    const existing = await getMediaLocal(mediaId);
    if (existing) return existing;

    try {
        const response = await fetch(url);
        if (!response.ok) return null;

        const blob = await response.blob();
        const mediaItem: MediaItem = {
            id: mediaId,
            blob,
            mimeType: blob.type,
            mediaType,
            fileName: url.split('/').pop() || mediaId,
            fileSize: blob.size,
            conversationId,
            supabaseUrl: url,
            syncedToCloud: false,
            createdAt: new Date().toISOString(),
        };

        await saveMediaLocal(mediaItem);
        return mediaItem;
    } catch (e) {
        console.error('Failed to download and cache media:', e);
        return null;
    }
}

/**
 * Get media URL — returns local blob URL if cached, otherwise remote URL
 */
export async function getMediaUrl(mediaId: string, fallbackUrl?: string): Promise<string> {
    const local = await getMediaLocal(mediaId);
    if (local?.blob) {
        return URL.createObjectURL(local.blob);
    }

    // If not cached but we have a URL, try to cache it now
    if (fallbackUrl) {
        const cached = await downloadAndCache(fallbackUrl, mediaId, 'image');
        if (cached?.blob) {
            return URL.createObjectURL(cached.blob);
        }
    }

    return fallbackUrl || '';
}

// ═══════════════════════════════════════
// GOOGLE DRIVE BACKUP
// ═══════════════════════════════════════

const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const GOOGLE_DRIVE_FOLDER_NAME = 'Maison de Prière Media';

/**
 * Initialize Google Drive OAuth
 */
export async function initGoogleDriveAuth(): Promise<string | null> {
    // Google OAuth client ID should be in env
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID;
    if (!clientId) {
        console.warn('Google Drive client ID not configured');
        return null;
    }

    return new Promise((resolve) => {
        const width = 500;
        const height = 600;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;

        const redirectUri = `${window.location.origin}/api/auth/google-drive/callback`;
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${clientId}&` +
            `redirect_uri=${encodeURIComponent(redirectUri)}&` +
            `response_type=token&` +
            `scope=${encodeURIComponent(GOOGLE_DRIVE_SCOPE)}&` +
            `prompt=consent`;

        const popup = window.open(authUrl, 'Google Drive', `width=${width},height=${height},left=${left},top=${top}`);

        // Listen for the callback
        const handler = (event: MessageEvent) => {
            if (event.data?.type === 'google-drive-auth') {
                window.removeEventListener('message', handler);
                const token = event.data.accessToken;
                if (token) {
                    localStorage.setItem('gdrive_access_token', token);
                    localStorage.setItem('gdrive_token_expiry', String(Date.now() + 3600000));
                }
                resolve(token || null);
            }
        };

        window.addEventListener('message', handler);

        // Timeout after 2 minutes
        setTimeout(() => {
            window.removeEventListener('message', handler);
            resolve(null);
        }, 120000);
    });
}

/**
 * Get or create the app folder in Google Drive
 */
async function getOrCreateDriveFolder(accessToken: string): Promise<string | null> {
    try {
        // Check if folder exists
        const searchRes = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=name='${GOOGLE_DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const searchData = await searchRes.json();

        if (searchData.files?.length > 0) {
            return searchData.files[0].id;
        }

        // Create folder
        const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: GOOGLE_DRIVE_FOLDER_NAME,
                mimeType: 'application/vnd.google-apps.folder',
            }),
        });

        const folder = await createRes.json();
        return folder.id || null;
    } catch (e) {
        console.error('Google Drive folder error:', e);
        return null;
    }
}

/**
 * Backup a media item to Google Drive
 */
export async function backupToGoogleDrive(mediaItem: MediaItem): Promise<string | null> {
    let accessToken = localStorage.getItem('gdrive_access_token');
    const expiry = parseInt(localStorage.getItem('gdrive_token_expiry') || '0');

    if (!accessToken || Date.now() > expiry) {
        accessToken = await initGoogleDriveAuth();
        if (!accessToken) return null;
    }

    const folderId = await getOrCreateDriveFolder(accessToken);
    if (!folderId) return null;

    try {
        const metadata = {
            name: `${mediaItem.mediaType}_${mediaItem.id}_${mediaItem.fileName}`,
            parents: [folderId],
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', mediaItem.blob, mediaItem.fileName);

        const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}` },
            body: form,
        });

        const data = await res.json();
        if (data.id) {
            // Update local record
            mediaItem.googleDriveId = data.id;
            mediaItem.syncedToCloud = true;
            await saveMediaLocal(mediaItem);
            return data.id;
        }
    } catch (e) {
        console.error('Google Drive backup error:', e);
    }

    return null;
}

/**
 * Backup all unsynced media to Google Drive
 */
export async function backupAllToGoogleDrive(): Promise<{ synced: number; failed: number }> {
    const db = await openDB();
    let synced = 0;
    let failed = 0;

    for (const store of ['images', 'audio', 'video', 'documents'] as StoreName[]) {
        try {
            const items = await new Promise<MediaItem[]>((resolve, reject) => {
                const tx = db.transaction(store, 'readonly');
                const request = tx.objectStore(store).getAll();
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            });

            for (const item of items) {
                if (!item.syncedToCloud && item.blob) {
                    const driveId = await backupToGoogleDrive(item);
                    if (driveId) {
                        synced++;
                    } else {
                        failed++;
                    }
                }
            }
        } catch { failed++; }
    }

    return { synced, failed };
}

// ═══════════════════════════════════════
// CLEANUP — Reclaim Supabase storage
// ═══════════════════════════════════════

/**
 * Clean old media from Supabase storage 
 * (safe because copies exist on device + Google Drive)
 */
export async function cleanupSupabaseStorage(
    userId: string,
    olderThanDays: number = 30
): Promise<number> {
    try {
        const { data: files } = await supabase.storage
            .from('media')
            .list(`media/${userId}`, {
                sortBy: { column: 'created_at', order: 'asc' },
            });

        if (!files) return 0;

        const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
        const toDelete = files.filter(f => {
            const created = new Date(f.created_at || 0).getTime();
            return created < cutoff;
        });

        if (toDelete.length === 0) return 0;

        const paths = toDelete.map(f => `media/${userId}/${f.name}`);
        await supabase.storage.from('media').remove(paths);

        return toDelete.length;
    } catch (e) {
        console.error('Cleanup error:', e);
        return 0;
    }
}

// ═══════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════

function getStoreForType(type: string): StoreName {
    switch (type) {
        case 'image': return 'images';
        case 'audio': return 'audio';
        case 'video': return 'video';
        case 'document': return 'documents';
        default: return 'documents';
    }
}

function getMediaType(mimeType: string): 'image' | 'audio' | 'video' | 'document' {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('video/')) return 'video';
    return 'document';
}

/**
 * Generate a thumbnail from an image file
 */
async function generateThumbnail(file: File, maxSize: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);

            const canvas = document.createElement('canvas');
            const ratio = Math.min(maxSize / img.width, maxSize / img.height);
            canvas.width = img.width * ratio;
            canvas.height = img.height * ratio;

            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            canvas.toBlob(
                (blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error('Thumbnail generation failed'));
                },
                'image/webp',
                0.6
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Image load failed'));
        };

        img.src = url;
    });
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} Go`;
}
