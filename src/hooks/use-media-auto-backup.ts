'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import {
    getGoogleDriveStatus,
    getUnsyncedMedia,
    backupMediaToDrive,
} from '@/lib/media-storage';

/**
 * Hook qui lance automatiquement la sauvegarde Google Drive
 * quand l'utilisateur est connecté et qu'il y a des médias non sync.
 * 
 * Fonctionne en arrière-plan avec un intervalle de 5 minutes.
 * Ne fait rien si Google Drive n'est pas connecté.
 */
export function useMediaAutoBackup() {
    const user = useAppStore(s => s.user);
    const isSyncing = useRef(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const syncUnsynced = useCallback(async () => {
        if (isSyncing.current) return;

        const status = getGoogleDriveStatus();
        if (!status.connected || !status.autoBackup || !status.accessToken) return;

        const unsynced = await getUnsyncedMedia();
        if (unsynced.length === 0) return;

        isSyncing.current = true;
        console.log(`[AutoBackup] ${unsynced.length} fichier(s) à sauvegarder`);

        let synced = 0;
        for (const item of unsynced) {
            try {
                const driveId = await backupMediaToDrive(item);
                if (driveId) synced++;
            } catch (e) {
                console.warn('[AutoBackup] Échec:', e);
            }
        }

        if (synced > 0) {
            console.log(`[AutoBackup] ${synced}/${unsynced.length} fichier(s) sauvegardé(s)`);
        }

        isSyncing.current = false;
    }, []);

    useEffect(() => {
        if (!user?.id) return;

        // Premier sync 30 secondes après le login
        const initialTimer = setTimeout(syncUnsynced, 30000);

        // Puis toutes les 5 minutes
        intervalRef.current = setInterval(syncUnsynced, 5 * 60 * 1000);

        return () => {
            clearTimeout(initialTimer);
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [user?.id, syncUnsynced]);
}
