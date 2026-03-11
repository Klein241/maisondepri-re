'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/lib/store';

/**
 * ══════════════════════════════════════════════════════════
 * useNotifications Hook — Cursor-based Pagination
 * ══════════════════════════════════════════════════════════
 *
 * Features:
 * - KV-powered unread count (via Worker, no SQL)
 * - Cursor-based infinite scroll pagination
 * - Realtime new notification subscription
 * - Optimistic mark-as-read
 * - Worker-first with Supabase fallback
 */

export interface NotificationItem {
    id: string;
    title: string;
    message: string;
    type: string;
    action_type: string;
    action_data: any;
    actors?: Array<{ id: string; name: string; avatar?: string }>;
    actor_count?: number;
    is_read: boolean;
    created_at: string;
    priority?: string;
    aggregation_key?: string;
}

interface UseNotificationsReturn {
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
}

function getWorkerUrl(): string {
    return process.env.NEXT_PUBLIC_NOTIFICATION_WORKER_URL
        || process.env.NEXT_PUBLIC_WORKER_URL
        || '';
}

export function useNotifications(): UseNotificationsReturn {
    const user = useAppStore(s => s.user);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const cursorRef = useRef<string | null>(null);
    const initialLoadDone = useRef(false);

    const workerUrl = getWorkerUrl();

    // ── Fetch unread count from KV (fast) ──────────────────
    const fetchUnreadCount = useCallback(async () => {
        if (!user?.id) return;

        if (workerUrl) {
            try {
                const res = await fetch(`${workerUrl}/notify/count`, {
                    headers: { 'X-User-Id': user.id },
                });
                if (res.ok) {
                    const data = await res.json();
                    setUnreadCount(data.unread_count || 0);
                    return;
                }
            } catch (e) { /* fallback below */ }
        }

        // Fallback: count from Supabase
        const { count } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('is_read', false);

        setUnreadCount(count || 0);
    }, [user?.id, workerUrl]);

    // ── Load page of notifications (cursor-based) ──────────
    const loadPage = useCallback(async (cursor?: string | null, reset = false) => {
        if (!user?.id) return;
        setIsLoading(true);
        setError(null);

        try {
            let items: NotificationItem[] = [];
            let nextCursor: string | null = null;
            let moreAvailable = false;

            if (workerUrl) {
                try {
                    const params = new URLSearchParams({ limit: '20' });
                    if (cursor) params.set('cursor', cursor);

                    const res = await fetch(`${workerUrl}/notify/list?${params}`, {
                        headers: { 'X-User-Id': user.id },
                    });

                    if (res.ok) {
                        const data = await res.json();
                        items = data.notifications || [];
                        nextCursor = data.next_cursor;
                        moreAvailable = data.has_more;
                    }
                } catch (e) {
                    // Fallback below
                }
            }

            // Fallback: direct Supabase query
            if (items.length === 0) {
                let query = supabase
                    .from('notifications')
                    .select('id,title,message,type,action_type,action_data,actors,actor_count,is_read,created_at,priority,aggregation_key')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(21); // +1 to detect more

                if (cursor) {
                    query = query.lt('created_at', cursor);
                }

                const { data, error: dbError } = await query;
                if (dbError) throw dbError;

                items = (data || []).map(n => ({
                    ...n,
                    action_data: typeof n.action_data === 'string' ? JSON.parse(n.action_data) : n.action_data,
                    actors: typeof n.actors === 'string' ? JSON.parse(n.actors) : n.actors,
                }));

                moreAvailable = items.length > 20;
                if (moreAvailable) items = items.slice(0, 20);
                nextCursor = moreAvailable && items.length > 0 ? items[items.length - 1].created_at : null;
            }

            cursorRef.current = nextCursor;
            setHasMore(moreAvailable);

            if (reset) {
                setNotifications(items);
            } else {
                setNotifications(prev => {
                    // Deduplicate
                    const existingIds = new Set(prev.map(n => n.id));
                    const newItems = items.filter(n => !existingIds.has(n.id));
                    return [...prev, ...newItems];
                });
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    }, [user?.id, workerUrl]);

    // ── Initial load ───────────────────────────────────────
    useEffect(() => {
        if (!user?.id || initialLoadDone.current) return;
        initialLoadDone.current = true;
        fetchUnreadCount();
        loadPage(null, true);
    }, [user?.id, fetchUnreadCount, loadPage]);

    // ── Realtime subscription ──────────────────────────────
    useEffect(() => {
        if (!user?.id) return;

        const channel = supabase
            .channel(`notif_hook_${user.id}_${Date.now()}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`,
            }, (payload) => {
                const n = payload.new as any;

                const newNotif: NotificationItem = {
                    id: n.id,
                    title: n.title,
                    message: n.message,
                    type: n.type,
                    action_type: n.action_type || 'general',
                    action_data: typeof n.action_data === 'string' ? JSON.parse(n.action_data || '{}') : (n.action_data || {}),
                    actors: typeof n.actors === 'string' ? JSON.parse(n.actors || '[]') : (n.actors || []),
                    actor_count: n.actor_count || 1,
                    is_read: n.is_read || false,
                    created_at: n.created_at,
                    priority: n.priority || 'medium',
                    aggregation_key: n.aggregation_key,
                };

                // If aggregated, replace existing notification with same key
                if (newNotif.aggregation_key) {
                    setNotifications(prev => {
                        const existingIdx = prev.findIndex(
                            p => p.aggregation_key === newNotif.aggregation_key
                        );
                        if (existingIdx >= 0) {
                            const updated = [...prev];
                            updated[existingIdx] = newNotif;
                            return updated;
                        }
                        return [newNotif, ...prev];
                    });
                } else {
                    setNotifications(prev => [newNotif, ...prev]);
                }

                if (!n.is_read) {
                    setUnreadCount(prev => prev + 1);
                }
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`,
            }, (payload) => {
                const n = payload.new as any;
                setNotifications(prev =>
                    prev.map(item =>
                        item.id === n.id
                            ? { ...item, title: n.title, message: n.message, is_read: n.is_read, actors: n.actors, actor_count: n.actor_count }
                            : item
                    )
                );
            })
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [user?.id]);

    // ── Load more (infinite scroll) ────────────────────────
    const loadMore = useCallback(async () => {
        if (!hasMore || isLoading) return;
        await loadPage(cursorRef.current);
    }, [hasMore, isLoading, loadPage]);

    // ── Refresh (pull to refresh) ──────────────────────────
    const refresh = useCallback(async () => {
        cursorRef.current = null;
        initialLoadDone.current = false;
        await Promise.all([
            fetchUnreadCount(),
            loadPage(null, true),
        ]);
        initialLoadDone.current = true;
    }, [fetchUnreadCount, loadPage]);

    // ── Mark single notification as read ───────────────────
    const markAsRead = useCallback(async (id: string) => {
        // Optimistic update
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));

        if (workerUrl && user?.id) {
            try {
                await fetch(`${workerUrl}/notify/read`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-User-Id': user.id,
                    },
                    body: JSON.stringify({ notification_id: id }),
                });
                return;
            } catch (e) { /* fallback */ }
        }

        // Fallback
        await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    }, [workerUrl, user?.id]);

    // ── Mark all as read ───────────────────────────────────
    const markAllAsRead = useCallback(async () => {
        // Optimistic
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);

        if (workerUrl && user?.id) {
            try {
                await fetch(`${workerUrl}/notify/read-all`, {
                    method: 'PATCH',
                    headers: { 'X-User-Id': user.id },
                });
                return;
            } catch (e) { /* fallback */ }
        }

        // Fallback
        if (user?.id) {
            await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', user.id)
                .eq('is_read', false);
        }
    }, [workerUrl, user?.id]);

    // ── Clear local state ──────────────────────────────────
    const clearAll = useCallback(() => {
        setNotifications([]);
        setUnreadCount(0);
        cursorRef.current = null;
        setHasMore(true);
    }, []);

    return {
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
    };
}
