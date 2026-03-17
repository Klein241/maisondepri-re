'use client';

import dynamic from 'next/dynamic';
import { useMediaAutoBackup } from '@/hooks/use-media-auto-backup';

// Lazy load to avoid SSR issues with service worker APIs
const PushNotificationManagerInner = dynamic(
    () => import('./push-notification-manager'),
    { ssr: false }
);

export function PushNotificationWrapper() {
    // Auto-backup des médias vers Google Drive en arrière-plan
    useMediaAutoBackup();

    return <PushNotificationManagerInner />;
}
