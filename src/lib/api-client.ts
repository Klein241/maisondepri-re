/**
 * GROUP MESSAGES CLIENT — Direct Supabase calls (no serverless functions)
 * ======================================================================
 * Replaces /api/group-messages to avoid Netlify serverless credits.
 * Uses Supabase client-side SDK instead of service-role key.
 */

import { supabase } from './supabase';

export interface GroupMessage {
    id: string;
    group_id: string;
    user_id: string;
    content: string;
    type: string;
    voice_url?: string;
    voice_duration?: number;
    created_at: string;
    profiles: {
        full_name: string;
        avatar_url: string | null;
    };
}

/**
 * Load group messages (replaces GET /api/group-messages)
 */
export async function loadGroupMessages(groupId: string): Promise<GroupMessage[]> {
    try {
        // Try direct query with join first
        const { data: messages, error } = await supabase
            .from('prayer_group_messages')
            .select('id, group_id, user_id, content, type, voice_url, voice_duration, created_at, profiles(full_name, avatar_url)')
            .eq('group_id', groupId)
            .order('created_at', { ascending: true });

        if (error) {
            // Fallback: load messages without join, then fetch profiles separately
            console.warn('[group-messages] Join failed, using fallback:', error.message);
            return await loadGroupMessagesFallback(groupId);
        }

        return (messages || []).map((m: any) => ({
            ...m,
            profiles: m.profiles || { full_name: 'Utilisateur', avatar_url: null },
        }));
    } catch (e) {
        console.error('[group-messages] Error:', e);
        return await loadGroupMessagesFallback(groupId);
    }
}

/**
 * Fallback: loads messages and profiles separately (no PostgREST join)
 */
async function loadGroupMessagesFallback(groupId: string): Promise<GroupMessage[]> {
    const { data: rawMessages, error } = await supabase
        .from('prayer_group_messages')
        .select('id, group_id, user_id, content, type, voice_url, voice_duration, created_at')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });

    if (error || !rawMessages || rawMessages.length === 0) {
        return [];
    }

    // Batch-fetch unique user profiles
    const uniqueUserIds = [...new Set(rawMessages.map(m => m.user_id))];
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', uniqueUserIds);

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    return rawMessages.map(m => {
        const profile = profileMap.get(m.user_id);
        return {
            ...m,
            profiles: profile
                ? { full_name: profile.full_name, avatar_url: profile.avatar_url }
                : { full_name: 'Utilisateur', avatar_url: null },
        };
    });
}

/**
 * Send a group message (replaces POST /api/group-messages)
 */
export async function sendGroupMessage({
    groupId,
    userId,
    content,
    type = 'text',
    voiceUrl,
    voiceDuration,
}: {
    groupId: string;
    userId: string;
    content: string;
    type?: string;
    voiceUrl?: string;
    voiceDuration?: number;
}): Promise<GroupMessage | null> {
    try {
        const insertData: any = {
            group_id: groupId,
            user_id: userId,
            content,
            type,
        };
        if (voiceUrl) insertData.voice_url = voiceUrl;
        if (voiceDuration) insertData.voice_duration = voiceDuration;

        const { data, error } = await supabase
            .from('prayer_group_messages')
            .insert(insertData)
            .select('id, group_id, user_id, content, type, voice_url, voice_duration, created_at')
            .single();

        if (error) {
            console.error('[group-messages] Send error:', error);
            return null;
        }

        // Fetch sender profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', userId)
            .single();

        return {
            ...data,
            profiles: profile || { full_name: 'Utilisateur', avatar_url: null },
        };
    } catch (e) {
        console.error('[group-messages] Send error:', e);
        return null;
    }
}

/**
 * Ensure user profile exists (replaces POST /api/auth/ensure-profile)
 */
export async function ensureUserProfile(userData: {
    id: string;
    email?: string;
    full_name?: string;
    avatar_url?: string;
    first_name?: string;
}): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('profiles')
            .upsert({
                id: userData.id,
                email: userData.email || '',
                full_name: userData.full_name || 'Utilisateur',
                avatar_url: userData.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(userData.full_name || 'U')}`,
                first_name: userData.first_name || null,
            }, {
                onConflict: 'id',
                ignoreDuplicates: false,
            });

        if (error) {
            console.error('[ensure-profile] Error:', error.message);
            return false;
        }
        return true;
    } catch (e) {
        console.error('[ensure-profile] Error:', e);
        return false;
    }
}

/**
 * Fetch Bible passage (replaces GET /api/bible)
 * Direct call to bible-api.com — no CORS issue since it allows all origins
 */
export async function fetchBiblePassage(reference: string, translation: string = 'lsg'): Promise<any> {
    try {
        const apiUrl = `https://bible-api.com/${encodeURIComponent(reference)}?translation=${translation}`;
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Bible API returned ${response.status}`);
        }

        return await response.json();
    } catch (e) {
        console.error('[bible] Fetch error:', e);
        return null;
    }
}
