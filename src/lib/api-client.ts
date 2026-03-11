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

// ── In-memory cache for group messages (WhatsApp-like local cache) ────────
const MSG_CACHE_TTL = 60_000; // 60 seconds
interface MsgCacheEntry { messages: GroupMessage[]; fetchedAt: number; }
const msgMemCache: Record<string, MsgCacheEntry> = {};

function getCached(groupId: string): GroupMessage[] | null {
    const entry = msgMemCache[groupId];
    if (entry && Date.now() - entry.fetchedAt < MSG_CACHE_TTL) return entry.messages;
    return null;
}
function setCache(groupId: string, messages: GroupMessage[]) {
    msgMemCache[groupId] = { messages, fetchedAt: Date.now() };
}

/** Call this from realtime handlers to force a fresh load next time */
export function invalidateGroupMsgCache(groupId: string) {
    delete msgMemCache[groupId];
}

/**
 * Load group messages — cache-first, last 50 only (fastest opening)
 */
export async function loadGroupMessages(groupId: string, forceRefresh = false): Promise<GroupMessage[]> {
    if (!forceRefresh) {
        const cached = getCached(groupId);
        if (cached) return cached;
    }
    try {
        // Load last 50 with inline join — descending then reverse for correct order
        const { data: messages, error } = await supabase
            .from('prayer_group_messages')
            .select('id, group_id, user_id, content, type, voice_url, voice_duration, created_at, profiles(full_name, avatar_url)')
            .eq('group_id', groupId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            console.warn('[group-messages] Join failed, using fallback:', error.message);
            const result = await loadGroupMessagesFallback(groupId);
            setCache(groupId, result);
            return result;
        }

        const result = ((messages || []) as any[]).reverse().map((m: any) => ({
            ...m,
            profiles: m.profiles || { full_name: 'Utilisateur', avatar_url: null },
        }));
        setCache(groupId, result);
        return result;
    } catch (e) {
        console.error('[group-messages] Error:', e);
        const result = await loadGroupMessagesFallback(groupId);
        setCache(groupId, result);
        return result;
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
 * Fetch Bible passage — LOCAL ONLY (LSG)
 * All data comes from /public/bible/ .txt files via unified-bible-api
 */
export async function fetchBiblePassage(reference: string, _translation: string = 'lsg'): Promise<any> {
    try {
        // Use the local Bible service exclusively
        const { bibleApi } = await import('./unified-bible-api');
        const parsed = bibleApi.parseReference(reference);
        if (!parsed) return null;

        if (parsed.verseStart && parsed.verseEnd) {
            const chapter = await bibleApi.getChapter(parsed.bookId, parsed.chapter);
            if (!chapter) return null;
            const selectedVerses = chapter.verses.filter(
                v => v.verse! >= parsed.verseStart! && v.verse! <= parsed.verseEnd!
            );
            return {
                reference: chapter.reference,
                text: selectedVerses.map(v => `${v.verse}. ${v.text}`).join('\n'),
                verses: selectedVerses
            };
        } else {
            const chapter = await bibleApi.getChapter(parsed.bookId, parsed.chapter);
            return chapter;
        }
    } catch (e) {
        console.error('[bible] Local fetch error:', e);
        return null;
    }
}
