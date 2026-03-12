'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * usePresence — Track online/offline status for the current user + all users.
 *
 * Handles:
 * • Setting user online on mount
 * • Heartbeat every 30s to prove we're still online
 * • Subscribing to real-time presence changes
 * • Setting user offline on unmount / tab close / visibility change
 * • Auto-cleanup stale users (2 min window)
 */
export function usePresence(userId: string | undefined) {
    const [onlineUsers, setOnlineUsers] = useState<Record<string, boolean>>({});
    const [userLastSeen, setUserLastSeen] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!userId) return;

        // Set user online when component mounts
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

        // Fetch ALL profiles with online status + auto-cleanup stale users
        const fetchOnlineUsers = async () => {
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, is_online, last_seen');

                if (!error && data) {
                    const onlineMap: Record<string, boolean> = {};
                    const lastSeenMap: Record<string, string> = {};
                    const twoMinutesAgo = Date.now() - 2 * 60 * 1000;

                    data.forEach(u => {
                        const lastSeenTime = u.last_seen ? new Date(u.last_seen).getTime() : 0;
                        const isReallyOnline = u.is_online === true && lastSeenTime > twoMinutesAgo;
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

        // Heartbeat: update last_seen every 30s to prove we're still online
        const heartbeatInterval = setInterval(async () => {
            try {
                await supabase
                    .from('profiles')
                    .update({ is_online: true, last_seen: new Date().toISOString() })
                    .eq('id', userId);
            } catch (e) {
                // Ignore
            }
        }, 30000);

        // Subscribe to presence changes via realtime
        const presenceChannel = supabase.channel('online-users-presence')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles'
            }, (payload) => {
                const profile = payload.new as any;
                if (profile.id) {
                    const lastSeenTime = profile.last_seen ? new Date(profile.last_seen).getTime() : 0;
                    const isReallyOnline = profile.is_online === true && lastSeenTime > (Date.now() - 2 * 60 * 1000);
                    setOnlineUsers(prev => ({ ...prev, [profile.id]: isReallyOnline }));
                    if (profile.last_seen) {
                        setUserLastSeen(prev => ({ ...prev, [profile.id]: profile.last_seen }));
                    }
                }
            })
            .subscribe();

        // Handle page visibility changes
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                setOnline();
                fetchOnlineUsers(); // Re-fetch when tab becomes visible
            } else {
                // Set OFFLINE when tab is hidden (not just updating last_seen)
                supabase.from('profiles')
                    .update({ is_online: false, last_seen: new Date().toISOString() })
                    .eq('id', userId)
                    .then(() => { });
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Handle browser/tab close - set offline immediately
        const handleBeforeUnload = () => {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
            if (supabaseUrl && supabaseKey) {
                // Use fetch with keepalive — sendBeacon can't set auth headers
                try {
                    fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': supabaseKey,
                            'Authorization': `Bearer ${supabaseKey}`,
                            'Prefer': 'return=minimal'
                        },
                        body: JSON.stringify({
                            is_online: false,
                            last_seen: new Date().toISOString()
                        }),
                        keepalive: true
                    });
                } catch (e) {
                    // Ignore — browser is closing
                }
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);

        // Periodic re-fetch to catch stale users (every 60s)
        const onlineRefreshInterval = setInterval(fetchOnlineUsers, 60000);

        // Cleanup on unmount
        return () => {
            clearInterval(heartbeatInterval);
            clearInterval(onlineRefreshInterval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            setOffline();
            presenceChannel.unsubscribe();
        };
    }, [userId]);

    return { onlineUsers, userLastSeen };
}
