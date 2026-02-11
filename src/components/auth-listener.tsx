'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/lib/store';

export function AuthListener() {
    const { setUser } = useAppStore();

    useEffect(() => {
        // Initial session check
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setUser({
                    id: session.user.id,
                    email: session.user.email || '',
                    name: session.user.user_metadata.full_name || 'Utilisateur',
                    avatar: session.user.user_metadata.avatar_url,
                    joinedAt: session.user.created_at,
                });
                useAppStore.getState().loadInitialData(); // Load user data from Supabase
            } else {
                setUser(null);
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
