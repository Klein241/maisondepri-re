'use client';

import dynamic from 'next/dynamic';

// Lazy load to avoid SSR issues with service worker APIs
const PushNotificationManagerInner = dynamic(
    () => import('./push-notification-manager'),
    { ssr: false }
);

export function PushNotificationWrapper() {
    return <PushNotificationManagerInner />;
}
