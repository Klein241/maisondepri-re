/**
 * ═══════════════════════════════════════════════════════════
 * Media Storage — Système de stockage type WhatsApp
 * 
 * Architecture :
 * 1. Tous les médias (images, audio, vidéos, documents) sont 
 *    stockés LOCALEMENT sur l'appareil de l'utilisateur via IndexedDB
 * 2. Google Drive sert de sauvegarde cloud (le propre compte de l'utilisateur)
 * 3. Les médias fonctionnent hors-ligne une fois chargés
 * 
 * Flux utilisateur :
 *   1. L'utilisateur va dans Profil → Stockage & Sauvegarde
 *   2. Il connecte son Google Drive (OAuth popup)
 *   3. Après connexion → sauvegarde automatique en arrière-plan
 *   4. Les médias restent sur l'appareil + copie sur Google Drive
 * ═══════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════
// IndexedDB — Base de données média locale
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
                    objectStore.createIndex('by_synced', 'syncedToCloud', { unique: false });
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
// Types
// ═══════════════════════════════════════

export interface MediaItem {
    id: string;
    blob: Blob;
    mimeType: string;
    mediaType: 'image' | 'audio' | 'video' | 'document';
    fileName: string;
    fileSize: number;
    conversationId?: string;
    productId?: string;
    senderId?: string;
    thumbnailBlob?: Blob;
    remoteUrl?: string;       // URL for sharing
    googleDriveId?: string;   // Google Drive file ID
    createdAt: string;
    syncedToCloud: boolean;
}

export interface GoogleDriveStatus {
    connected: boolean;
    email: string | null;
    accessToken: string | null;
    expiresAt: number;
    folderId: string | null;
    lastSync: string | null;
    autoBackup: boolean;
}

// ═══════════════════════════════════════
// OPÉRATIONS LOCALES (IndexedDB)
// ═══════════════════════════════════════

/** Sauvegarder un média localement */
export async function saveMediaLocal(item: MediaItem): Promise<void> {
    const db = await openDB();
    const store = getStoreForType(item.mediaType);

    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).put(item);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

/** Récupérer un média local */
export async function getMediaLocal(id: string, mediaType?: string): Promise<MediaItem | null> {
    const db = await openDB();
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

/** Tous les médias d'une conversation */
export async function getConversationMedia(conversationId: string): Promise<MediaItem[]> {
    const db = await openDB();
    const results: MediaItem[] = [];

    for (const store of ['images', 'audio', 'video', 'documents'] as StoreName[]) {
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

/** Supprimer un média local */
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

/** Récupérer tous les médias non synchronisés */
export async function getUnsyncedMedia(): Promise<MediaItem[]> {
    const db = await openDB();
    const results: MediaItem[] = [];

    for (const store of ['images', 'audio', 'video', 'documents'] as StoreName[]) {
        try {
            const items = await new Promise<MediaItem[]>((resolve, reject) => {
                const tx = db.transaction(store, 'readonly');
                const request = tx.objectStore(store).getAll();
                request.onsuccess = () => resolve(
                    (request.result || []).filter((item: MediaItem) => !item.syncedToCloud && item.blob)
                );
                request.onerror = () => reject(request.error);
            });
            results.push(...items);
        } catch { /* continue */ }
    }

    return results;
}

/** Statistiques de stockage */
export async function getStorageStats(): Promise<{
    totalSize: number;
    counts: Record<string, number>;
    breakdown: Record<string, number>;
    unsyncedCount: number;
    unsyncedSize: number;
}> {
    const db = await openDB();
    const counts: Record<string, number> = {};
    const breakdown: Record<string, number> = {};
    let totalSize = 0;
    let unsyncedCount = 0;
    let unsyncedSize = 0;

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

            for (const item of items) {
                if (!item.syncedToCloud) {
                    unsyncedCount++;
                    unsyncedSize += item.fileSize || 0;
                }
            }
        } catch {
            counts[store] = 0;
            breakdown[store] = 0;
        }
    }

    return { totalSize, counts, breakdown, unsyncedCount, unsyncedSize };
}

/** URL locale d'un média (blob URL si en cache, sinon fallback) */
export async function getMediaUrl(mediaId: string, fallbackUrl?: string): Promise<string> {
    const local = await getMediaLocal(mediaId);
    if (local?.blob) {
        return URL.createObjectURL(local.blob);
    }

    if (fallbackUrl) {
        // Essayer de télécharger et cacher
        const cached = await downloadAndCache(fallbackUrl, mediaId, 'image');
        if (cached?.blob) {
            return URL.createObjectURL(cached.blob);
        }
    }

    return fallbackUrl || '';
}

/** Télécharger un média et le cacher localement */
export async function downloadAndCache(
    url: string,
    mediaId: string,
    mediaType: 'image' | 'audio' | 'video' | 'document',
    conversationId?: string
): Promise<MediaItem | null> {
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
            remoteUrl: url,
            syncedToCloud: false,
            createdAt: new Date().toISOString(),
        };

        await saveMediaLocal(mediaItem);
        return mediaItem;
    } catch (e) {
        console.error('Échec du cache média:', e);
        return null;
    }
}

// ═══════════════════════════════════════════════════
// GOOGLE DRIVE — Connexion + Sauvegarde
// 
// Utilise Google Identity Services (GIS)
// L'utilisateur connecte son compte Google une seule fois
// Les médias sont sauvegardés dans un dossier dédié
// sur le propre Google Drive de l'utilisateur
// ═══════════════════════════════════════════════════

const GOOGLE_DRIVE_FOLDER = 'Maison de Prière';
const GD_STORAGE_KEY = 'mdp_gdrive_status';

/** Charger le script Google Identity Services */
function loadGoogleScript(): Promise<void> {
    return new Promise((resolve, reject) => {
        if ((window as any).google?.accounts) {
            resolve();
            return;
        }

        const existing = document.getElementById('google-gis-script');
        if (existing) {
            existing.addEventListener('load', () => resolve());
            return;
        }

        const script = document.createElement('script');
        script.id = 'google-gis-script';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
        document.head.appendChild(script);
    });
}

/** Récupérer le statut Google Drive sauvegardé */
export function getGoogleDriveStatus(): GoogleDriveStatus {
    try {
        const saved = localStorage.getItem(GD_STORAGE_KEY);
        if (saved) {
            const status = JSON.parse(saved) as GoogleDriveStatus;
            // Vérifier si le token est expiré
            if (status.accessToken && status.expiresAt > Date.now()) {
                return status;
            }
            // Token expiré — garder les infos mais marquer comme déconnecté
            return { ...status, connected: false, accessToken: null };
        }
    } catch { }

    return {
        connected: false,
        email: null,
        accessToken: null,
        expiresAt: 0,
        folderId: null,
        lastSync: null,
        autoBackup: true,
    };
}

/** Sauvegarder le statut Google Drive */
function saveGoogleDriveStatus(status: GoogleDriveStatus): void {
    localStorage.setItem(GD_STORAGE_KEY, JSON.stringify(status));
}

/**
 * Connecter Google Drive — ouvre le popup Google OAuth
 * L'utilisateur voit ses comptes Gmail et choisit lequel utiliser
 * Retourne le statut avec email et token
 */
export async function connectGoogleDrive(): Promise<GoogleDriveStatus> {
    await loadGoogleScript();

    const google = (window as any).google;
    if (!google?.accounts?.oauth2) {
        throw new Error('Google Identity Services non chargé');
    }

    return new Promise((resolve, reject) => {
        const tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
            scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email',
            callback: async (tokenResponse: any) => {
                if (tokenResponse.error) {
                    reject(new Error(tokenResponse.error));
                    return;
                }

                try {
                    // Récupérer l'email de l'utilisateur
                    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                        headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
                    });
                    const userInfo = await userInfoRes.json();

                    // Trouver ou créer le dossier de sauvegarde
                    const folderId = await getOrCreateDriveFolder(tokenResponse.access_token);

                    const status: GoogleDriveStatus = {
                        connected: true,
                        email: userInfo.email || null,
                        accessToken: tokenResponse.access_token,
                        expiresAt: Date.now() + (tokenResponse.expires_in * 1000),
                        folderId,
                        lastSync: getGoogleDriveStatus().lastSync,
                        autoBackup: true,
                    };

                    saveGoogleDriveStatus(status);
                    resolve(status);
                } catch (e) {
                    reject(e);
                }
            },
            error_callback: (error: any) => {
                reject(new Error(error.message || 'Erreur Google OAuth'));
            },
        });

        // Déclenche le popup Google
        tokenClient.requestAccessToken({ prompt: 'consent' });
    });
}

/**
 * Reconnecter silencieusement (sans popup)
 * Utilisé pour rafraîchir le token quand il expire
 */
export async function reconnectGoogleDrive(): Promise<GoogleDriveStatus | null> {
    const current = getGoogleDriveStatus();
    if (!current.email) return null;

    try {
        await loadGoogleScript();
        const google = (window as any).google;

        return new Promise((resolve) => {
            const tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
                scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email',
                callback: async (tokenResponse: any) => {
                    if (tokenResponse.error) {
                        resolve(null);
                        return;
                    }

                    const status: GoogleDriveStatus = {
                        ...current,
                        connected: true,
                        accessToken: tokenResponse.access_token,
                        expiresAt: Date.now() + (tokenResponse.expires_in * 1000),
                    };

                    saveGoogleDriveStatus(status);
                    resolve(status);
                },
            });

            // Essayer sans popup (hint avec l'email existant)
            tokenClient.requestAccessToken({ prompt: '', login_hint: current.email });
        });
    } catch {
        return null;
    }
}

/** Déconnecter Google Drive */
export function disconnectGoogleDrive(): void {
    const status = getGoogleDriveStatus();
    if (status.accessToken) {
        try {
            (window as any).google?.accounts?.oauth2?.revoke(status.accessToken);
        } catch { /* ignore */ }
    }

    const newStatus: GoogleDriveStatus = {
        connected: false,
        email: null,
        accessToken: null,
        expiresAt: 0,
        folderId: null,
        lastSync: null,
        autoBackup: false,
    };
    saveGoogleDriveStatus(newStatus);
}

/** Trouver ou créer le dossier "Maison de Prière" sur Google Drive */
async function getOrCreateDriveFolder(accessToken: string): Promise<string | null> {
    const headers = { Authorization: `Bearer ${accessToken}` };

    try {
        // Chercher le dossier existant
        const searchRes = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=name='${GOOGLE_DRIVE_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`,
            { headers }
        );
        const searchData = await searchRes.json();

        if (searchData.files?.length > 0) {
            return searchData.files[0].id;
        }

        // Créer le dossier
        const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: GOOGLE_DRIVE_FOLDER,
                mimeType: 'application/vnd.google-apps.folder',
            }),
        });

        const folder = await createRes.json();
        return folder.id || null;
    } catch (e) {
        console.error('Erreur dossier Google Drive:', e);
        return null;
    }
}

/** Obtenir un token valide (reconnecte si expiré) */
async function getValidToken(): Promise<string | null> {
    let status = getGoogleDriveStatus();

    if (status.accessToken && status.expiresAt > Date.now() + 60000) {
        return status.accessToken;
    }

    // Token expiré ou presque — reconnecter
    const refreshed = await reconnectGoogleDrive();
    return refreshed?.accessToken || null;
}

/**
 * Sauvegarder UN média sur Google Drive
 * Retourne l'ID du fichier sur Drive
 */
export async function backupMediaToDrive(item: MediaItem): Promise<string | null> {
    const accessToken = await getValidToken();
    if (!accessToken) return null;

    const status = getGoogleDriveStatus();
    let folderId = status.folderId;

    if (!folderId) {
        folderId = await getOrCreateDriveFolder(accessToken);
        if (folderId) {
            saveGoogleDriveStatus({ ...status, folderId });
        }
    }

    if (!folderId) return null;

    try {
        const metadata = {
            name: `${item.mediaType}_${item.id}_${item.fileName}`,
            parents: [folderId],
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', item.blob, item.fileName);

        const res = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size',
            {
                method: 'POST',
                headers: { Authorization: `Bearer ${accessToken}` },
                body: form,
            }
        );

        const data = await res.json();

        if (data.id) {
            // Marquer comme synchronisé
            item.googleDriveId = data.id;
            item.syncedToCloud = true;
            await saveMediaLocal(item);
            return data.id;
        }
    } catch (e) {
        console.error('Erreur backup Google Drive:', e);
    }

    return null;
}

/**
 * Sauvegarder TOUS les médias non sync sur Google Drive
 * Retourne la progression via callback
 */
export async function backupAllToDrive(
    onProgress?: (done: number, total: number, current: string) => void
): Promise<{ synced: number; failed: number; total: number }> {
    const unsynced = await getUnsyncedMedia();
    let synced = 0;
    let failed = 0;

    for (let i = 0; i < unsynced.length; i++) {
        const item = unsynced[i];
        onProgress?.(i, unsynced.length, item.fileName);

        try {
            const driveId = await backupMediaToDrive(item);
            if (driveId) {
                synced++;
            } else {
                failed++;
            }
        } catch {
            failed++;
        }
    }

    onProgress?.(unsynced.length, unsynced.length, '');

    // Mettre à jour la date de dernière sync
    if (synced > 0) {
        const status = getGoogleDriveStatus();
        saveGoogleDriveStatus({ ...status, lastSync: new Date().toISOString() });
    }

    return { synced, failed, total: unsynced.length };
}

/** Obtenir l'espace utilisé sur Google Drive par notre dossier */
export async function getDriveUsage(): Promise<{ fileCount: number; totalSize: number } | null> {
    const accessToken = await getValidToken();
    const status = getGoogleDriveStatus();
    if (!accessToken || !status.folderId) return null;

    try {
        const res = await fetch(
            `https://www.googleapis.com/drive/v3/files?q='${status.folderId}' in parents and trashed=false&fields=files(id,size)&pageSize=1000`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const data = await res.json();
        const files = data.files || [];

        return {
            fileCount: files.length,
            totalSize: files.reduce((sum: number, f: any) => sum + parseInt(f.size || '0'), 0),
        };
    } catch {
        return null;
    }
}

// ═══════════════════════════════════════
// NETTOYAGE
// ═══════════════════════════════════════

/** Supprimer tous les médias locaux déjà sauvegardés sur Google Drive */
export async function cleanSyncedMedia(): Promise<number> {
    const db = await openDB();
    let deleted = 0;

    for (const store of ['images', 'audio', 'video', 'documents'] as StoreName[]) {
        try {
            const items = await new Promise<MediaItem[]>((resolve, reject) => {
                const tx = db.transaction(store, 'readonly');
                const request = tx.objectStore(store).getAll();
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            });

            for (const item of items) {
                if (item.syncedToCloud && item.googleDriveId) {
                    await deleteMediaLocal(item.id, item.mediaType);
                    deleted++;
                }
            }
        } catch { /* continue */ }
    }

    return deleted;
}

/** Effacer TOUTES les données locales */
export async function clearAllLocalMedia(): Promise<void> {
    const db = await openDB();

    for (const store of STORES) {
        try {
            await new Promise<void>((resolve, reject) => {
                const tx = db.transaction(store, 'readwrite');
                tx.objectStore(store).clear();
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        } catch { /* continue */ }
    }
}

// ═══════════════════════════════════════
// UTILITAIRES
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

export function getMediaType(mimeType: string): 'image' | 'audio' | 'video' | 'document' {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('video/')) return 'video';
    return 'document';
}

/** Générer un thumbnail WebP */
export async function generateThumbnail(file: File | Blob, maxSize: number = 200): Promise<Blob> {
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
                (blob) => blob ? resolve(blob) : reject(new Error('Échec thumbnail')),
                'image/webp',
                0.6
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Échec chargement image'));
        };

        img.src = url;
    });
}

/** Formater la taille d'un fichier */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} Go`;
}
