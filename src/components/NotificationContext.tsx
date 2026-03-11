'use client';

import React, { createContext, useContext, useCallback, useEffect, useRef } from 'react';
import { useNotifications, NotificationItem } from '@/hooks/use-notifications';
import { useAppStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';

/**
 * ══════════════════════════════════════════════════════════
 * NotificationContext — Global notification state provider
 * ══════════════════════════════════════════════════════════
 *
 * Provides:
 * - Global unread count (KV-powered)
 * - Notification list with cursor pagination
 * - Real-time push notification rendering
 * - Deep-link navigation on click
 * - Sound & system notification triggers
 */

interface NotificationContextType {
    notifications: NotificationItem[];
    unreadCount: number;
    isLoading: boolean;
    hasMore: boolean;
    error: string | null;
    loadMore: () => Promise<void>;
    refresh: () => Promise<void>;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    clearAll: () => void;
    handleNotificationClick: (notification: NotificationItem) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function useNotificationContext() {
    const ctx = useContext(NotificationContext);
    if (!ctx) {
        throw new Error('useNotificationContext must be used within NotificationProvider');
    }
    return ctx;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const user = useAppStore(s => s.user);
    const setActiveTab = useAppStore(s => s.setActiveTab);
    const setPendingNavigation = useAppStore(s => s.setPendingNavigation);
    const triggerDMRefresh = useAppStore(s => s.triggerDMRefresh);
    const soundRef = useRef<HTMLAudioElement | null>(null);

    const {
        notifications,
        unreadCount,
        isLoading,
        hasMore,
        error,
        loadMore,
        refresh,
        markAsRead,
        markAllAsRead,
        clearAll,
    } = useNotifications();

    // ── Preload notification sound ──────────────────────────
    useEffect(() => {
        if (typeof window !== 'undefined') {
            soundRef.current = new Audio('/notification.mp3');
            soundRef.current.volume = 0.4;
        }
    }, []);

    // ── Play notification sound ─────────────────────────────
    const playSound = useCallback(() => {
        try {
            if (soundRef.current) {
                soundRef.current.currentTime = 0;
                soundRef.current.play().catch(() => { });
            }
        } catch (e) { /* ignore */ }
    }, []);

    // ── System notification (browser/service worker) ────────
    const showSystemNotification = useCallback((title: string, body: string, actionData?: any) => {
        if (typeof document !== 'undefined' && document.hasFocus()) {
            // App is visible — just play sound
            playSound();
            return;
        }

        // Service Worker push
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'SHOW_NOTIFICATION',
                title,
                body,
                tag: `notif_${Date.now()}`,
                url: actionData?.conversationId
                    ? `/?nav=conversation&id=${actionData.conversationId}`
                    : actionData?.groupId
                        ? `/?nav=group&id=${actionData.groupId}`
                        : '/',
            });
        }
        // Fallback: Notification API
        else if ('Notification' in window && Notification.permission === 'granted') {
            try {
                new Notification(title, {
                    body,
                    icon: '/icons/icon-192x192.png',
                    badge: '/icons/icon-72x72.png',
                    tag: `notif_${Date.now()}`,
                });
            } catch (e) { /* ignore */ }
        }

        playSound();
    }, [playSound]);

    // ── Listen for new notifications (realtime) ─────────────
    useEffect(() => {
        if (!user?.id) return;

        const channel = supabase
            .channel(`notif_ctx_${user.id}_${Date.now()}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`,
            }, (payload) => {
                const n = payload.new as any;

                // Parse action data
                let actionData: any = {};
                try {
                    actionData = typeof n.action_data === 'string'
                        ? JSON.parse(n.action_data)
                        : (n.action_data || {});
                } catch (e) { /* ignore */ }

                // Trigger DM refresh if applicable
                if (n.action_type === 'dm_new_message' && actionData.conversationId) {
                    triggerDMRefresh(actionData.conversationId);
                }

                // Show system notification
                showSystemNotification(n.title, n.message, actionData);
            })
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [user?.id, showSystemNotification, triggerDMRefresh]);

    // ── Navigate on notification click ──────────────────────
    const handleNotificationClick = useCallback((notification: NotificationItem) => {
        // Mark as read
        markAsRead(notification.id);

        // Also mark in Supabase directly for immediate consistency
        supabase.from('notifications').update({ is_read: true }).eq('id', notification.id).then(() => { });

        // Parse action_data
        let actionData: any = {};
        try {
            if (notification.action_data) {
                actionData = typeof notification.action_data === 'string'
                    ? JSON.parse(notification.action_data)
                    : notification.action_data;
            }
        } catch (e) { /* ignore */ }

        // Infer navigation from action_type if action_data is empty
        if (!actionData.tab && !actionData.viewState) {
            actionData = inferNavigationFromType(notification.action_type, notification.type);
        }

        // Navigate
        const targetTab = actionData.tab || 'community';
        setActiveTab(targetTab as any);

        setPendingNavigation({
            viewState: actionData.viewState,
            groupId: actionData.groupId,
            groupName: actionData.groupName,
            prayerId: actionData.prayerId,
            communityTab: actionData.communityTab,
            conversationId: actionData.conversationId,
        });
    }, [markAsRead, setActiveTab, setPendingNavigation]);

    return (
        <NotificationContext.Provider
            value={{
                notifications,
                unreadCount,
                isLoading,
                hasMore,
                error,
                loadMore,
                refresh,
                markAsRead,
                markAllAsRead,
                clearAll,
                handleNotificationClick,
            }}
        >
            {children}
        </NotificationContext.Provider>
    );
}

function inferNavigationFromType(actionType: string, legacyType: string): any {
    switch (actionType) {
        case 'prayer_prayed':
        case 'friend_prayed':
        case 'new_prayer_published':
        case 'prayer_comment':
        case 'prayer_no_response':
            return { tab: 'community', communityTab: 'prieres' };
        case 'group_access_request':
        case 'group_access_approved':
        case 'group_new_message':
        case 'group_invitation':
        case 'group_mention':
            return { tab: 'community', viewState: 'groups' };
        case 'dm_new_message':
            return { tab: 'community', communityTab: 'chat' };
        case 'friend_request_received':
            return { tab: 'profil', viewState: 'friend-requests' };
        case 'friend_request_accepted':
            return { tab: 'community', communityTab: 'chat' };
        case 'admin_new_group':
            return { tab: 'community', viewState: 'groups' };
        default:
            // Legacy type inference
            if (legacyType === 'message') return { tab: 'community', communityTab: 'chat' };
            if (legacyType === 'prayer') return { tab: 'community', communityTab: 'prieres' };
            return { tab: 'community' };
    }
}

export default NotificationProvider;
