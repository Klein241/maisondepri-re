'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * usePresence — UNIFIED online/offline status tracker.
 *
 * Single source of truth for presence across the entire app.
 * Handles:
 * • Setting user online on mount
 * • Heartbeat every 20s to prove we're still online
 * • Supabase Presence channel for INSTANT real-time updates
 * • DB fallback via postgres_changes for reliability
 * • Setting user offline on unmount / tab close / visibility change
 * • Auto-cleanup stale users (60s window = 3 missed heartbeats)
 */
export function usePresence(userId: string | undefined) {
    const [onlineUsers, setOnlineUsers] = useState<Record<string, boolean>>({});
    const [userLastSeen, setUserLastSeen] = useState<Record<string, string>>({});
    const channelRef = useRef<any>(null);

    useEffect(() => {
        if (!userId) return;

        // ── 1. Set user online in DB ──────────────────────────────
        const setOnline = async () => {
            try {
                await supabase
                    .from('profiles')
                    .update({ is_online: true, last_seen: new Date().toISOString() })
                    .eq('id', userId);
            } catch (e) {
                console.log('Online status columns may not exist yet');
            }
        };

        const setOffline = async () => {
            try {
                await supabase
                    .from('profiles')
                    .update({ is_online: false, last_seen: new Date().toISOString() })
                    .eq('id', userId);
            } catch (e) {
                // Ignore
            }
        };

        setOnline();

        // ── 2. Fetch ALL profiles with online status ─────────────
        const fetchOnlineUsers = async () => {
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, is_online, last_seen');

                if (!error && data) {
                    const onlineMap: Record<string, boolean> = {};
                    const lastSeenMap: Record<string, string> = {};
                    // 60 seconds stale window (heartbeat is every 20s, so 3 missed = offline)
                    const staleThreshold = Date.now() - 60 * 1000;

                    data.forEach(u => {
                        const lastSeenTime = u.last_seen ? new Date(u.last_seen).getTime() : 0;
                        const isReallyOnline = u.is_online === true && lastSeenTime > staleThreshold;
                        onlineMap[u.id] = isReallyOnline;
                        if (u.last_seen) lastSeenMap[u.id] = u.last_seen;
                    });
                    setOnlineUsers(onlineMap);
                    setUserLastSeen(lastSeenMap);
                }
            } catch (e) {
                console.log('Online status feature not available yet');
            }
        };
        fetchOnlineUsers();

        // ── 3. Heartbeat: update last_seen every 20s ─────────────
        const heartbeatInterval = setInterval(async () => {
            try {
                await supabase
                    .from('profiles')
                    .update({ is_online: true, last_seen: new Date().toISOString() })
                    .eq('id', userId);
            } catch (e) {
                // Ignore
            }
        }, 20000); // Every 20s (was 30s — more responsive now)

        // ── 4. Real-time: Supabase Presence channel (INSTANT) ────
        const presenceChannel = supabase.channel('unified-presence');
        channelRef.current = presenceChannel;

        presenceChannel
            .on('presence', { event: 'sync' }, () => {
                const state = presenceChannel.presenceState();
                // Merge presence channel data with our DB-based map
                setOnlineUsers(prev => {
                    const updated = { ...prev };
                    // Mark everyone from presence channel as online
                    Object.values(state).forEach((presences: any) => {
                        presences.forEach((p: any) => {
                            if (p.user_id) {
                                updated[p.user_id] = true;
                            }
                        });
                    });
                    return updated;
                });
            })
            .on('presence', { event: 'leave' }, ({ leftPresences }) => {
                // When someone leaves, mark them offline immediately
                setOnlineUsers(prev => {
                    const updated = { ...prev };
                    leftPresences.forEach((p: any) => {
                        if (p.user_id) {
                            updated[p.user_id] = false;
                        }
                    });
                    return updated;
                });
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    // Track our own presence
                    await presenceChannel.track({ user_id: userId, online_at: new Date().toISOString() });
                }
            });

        // ── 5. Real-time: postgres_changes fallback ──────────────
        const dbChannel = supabase.channel('presence-db-changes')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles'
            }, (payload) => {
                const profile = payload.new as any;
                if (profile.id) {
                    const lastSeenTime = profile.last_seen ? new Date(profile.last_seen).getTime() : 0;
                    const isReallyOnline = profile.is_online === true && lastSeenTime > (Date.now() - 60 * 1000);
                    setOnlineUsers(prev => ({ ...prev, [profile.id]: isReallyOnline }));
                    if (profile.last_seen) {
                        setUserLastSeen(prev => ({ ...prev, [profile.id]: profile.last_seen }));
                    }
                }
            })
            .subscribe();

        // ── 6. Handle page visibility changes ────────────────────
        let visibilityTimer: ReturnType<typeof setTimeout> | null = null;
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                // Coming back: cancel pending offline and set online immediately
                if (visibilityTimer) {
                    clearTimeout(visibilityTimer);
                    visibilityTimer = null;
                }
                setOnline();
                // Re-track on the presence channel
                presenceChannel.track({ user_id: userId, online_at: new Date().toISOString() }).catch(() => { });
                fetchOnlineUsers(); // Re-fetch when tab becomes visible
            } else {
                // Going hidden: wait 5s before setting offline (reduced from 10s for faster detection)
                visibilityTimer = setTimeout(() => {
                    supabase.from('profiles')
                        .update({ is_online: false, last_seen: new Date().toISOString() })
                        .eq('id', userId)
                        .then(() => { });
                    presenceChannel.untrack().catch(() => { });
                }, 5000);
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // ── 7. Handle browser/tab close ──────────────────────────
        const handleBeforeUnload = () => {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
            if (supabaseUrl && supabaseKey) {
                // Use sendBeacon for reliable offline signal on tab close
                const body = JSON.stringify({
                    is_online: false,
                    last_seen: new Date().toISOString()
                });

                // Try navigator.sendBeacon first (most reliable for unload)
                const url = `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`;
                const headers = {
                    'Content-Type': 'application/json',
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Prefer': 'return=minimal'
                };

                // sendBeacon doesn't support custom headers, so use fetch with keepalive
                try {
                    fetch(url, {
                        method: 'PATCH',
                        headers,
                        body,
                        keepalive: true
                    });
                } catch (e) {
                    // Ignore — browser is closing
                }
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);

        // ── 8. Periodic re-fetch to catch stale users (every 30s) ─
        const onlineRefreshInterval = setInterval(fetchOnlineUsers, 30000);

        // ── Cleanup ──────────────────────────────────────────────
        return () => {
            clearInterval(heartbeatInterval);
            clearInterval(onlineRefreshInterval);
            if (visibilityTimer) clearTimeout(visibilityTimer);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            setOffline();
            presenceChannel.unsubscribe();
            dbChannel.unsubscribe();
        };
    }, [userId]);

    return { onlineUsers, userLastSeen };
}
