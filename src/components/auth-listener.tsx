'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/lib/store';
import { ensureUserProfile } from '@/lib/api-client';

// Ensure the user has a row in the profiles table via API (bypasses RLS)
async function ensureProfile(user: {
    id: string;
    email?: string;
    user_metadata: { full_name?: string; avatar_url?: string; first_name?: string };
}) {
    try {
        const fullName = user.user_metadata.full_name
            || user.user_metadata.first_name
            || user.email?.split('@')[0]
            || 'Utilisateur';

        await ensureUserProfile({
            id: user.id,
            email: user.email || '',
            full_name: fullName,
            avatar_url: user.user_metadata.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fullName)}`,
            first_name: user.user_metadata.first_name || fullName.split(' ')[0] || undefined,
        });
    } catch (e) {
        console.warn('[Auth] ensureProfile error:', e);
    }
}

export function AuthListener() {
    const { setUser } = useAppStore();

    useEffect(() => {
        // Initial session check
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                // Set user immediately (don't wait for profile)
                setUser({
                    id: session.user.id,
                    email: session.user.email || '',
                    name: session.user.user_metadata.full_name || 'Utilisateur',
                    avatar: session.user.user_metadata.avatar_url,
                    joinedAt: session.user.created_at,
                });
                useAppStore.getState().loadInitialData();

                // Ensure profile exists (async, non-blocking)
                ensureProfile(session.user as any);
            } else {
                setUser(null);
                // Still load public data (prayers, testimonials) for guests
                useAppStore.getState().loadInitialData();
            }
        };

        checkSession();

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                if (session?.user) {
                    setUser({
                        id: session.user.id,
                        email: session.user.email || '',
                        name: session.user.user_metadata.full_name || 'Utilisateur',
                        avatar: session.user.user_metadata.avatar_url,
                        joinedAt: session.user.created_at,
                    });
                    useAppStore.getState().loadInitialData();

                    // Ensure profile exists (async, non-blocking)
                    ensureProfile(session.user as any);
                } else {
                    setUser(null);
                }
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, [setUser]);

    return null;
}
