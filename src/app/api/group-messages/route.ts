import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        throw new Error('Variables d\'environnement Supabase manquantes');
    }

    return createClient(url, key, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
}

// GET: Load group messages (bypasses RLS) - ROBUST: no PostgREST join
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const groupId = searchParams.get('groupId');

        if (!groupId) {
            return NextResponse.json({ error: 'groupId requis' }, { status: 400 });
        }

        const supabaseAdmin = getSupabaseAdmin();

        // Step 1: Load messages WITHOUT join (avoids PostgREST FK issues)
        const { data: rawMessages, error: msgError } = await supabaseAdmin
            .from('prayer_group_messages')
            .select('id, group_id, user_id, content, type, voice_url, voice_duration, created_at')
            .eq('group_id', groupId)
            .order('created_at', { ascending: true });

        if (msgError) {
            console.error('Error loading group messages:', msgError);
            return NextResponse.json({ error: msgError.message }, { status: 500 });
        }

        const messages = rawMessages || [];

        if (messages.length === 0) {
            return NextResponse.json({ messages: [] });
        }

        // Step 2: Batch-fetch all unique user profiles
        const uniqueUserIds = [...new Set(messages.map(m => m.user_id))];
        const { data: profiles } = await supabaseAdmin
            .from('profiles')
            .select('id, full_name, avatar_url')
            .in('id', uniqueUserIds);

        const profileMap = new Map((profiles || []).map(p => [p.id, p]));

        // Step 3: Merge profiles into messages
        const enrichedMessages = messages.map(m => {
            const profile = profileMap.get(m.user_id);
            return {
                ...m,
                profiles: profile
                    ? { full_name: profile.full_name, avatar_url: profile.avatar_url }
                    : { full_name: 'Utilisateur', avatar_url: null }
            };
        });

        return NextResponse.json({ messages: enrichedMessages });

    } catch (error: any) {
        console.error('API group-messages error:', error);
        return NextResponse.json(
            { error: error.message || 'Erreur serveur' },
            { status: 500 }
        );
    }
}

// POST: Send group message (bypasses RLS) - ROBUST: no PostgREST join
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { groupId, userId, content, type = 'text', voiceUrl, voiceDuration } = body;

        if (!groupId || !userId || !content) {
            return NextResponse.json({ error: 'groupId, userId et content requis' }, { status: 400 });
        }

        const supabaseAdmin = getSupabaseAdmin();

        const insertData: any = {
            group_id: groupId,
            user_id: userId,
            content,
            type,
        };

        if (voiceUrl) insertData.voice_url = voiceUrl;
        if (voiceDuration) insertData.voice_duration = voiceDuration;

        // Insert WITHOUT join
        const { data, error } = await supabaseAdmin
            .from('prayer_group_messages')
            .insert(insertData)
            .select('id, group_id, user_id, content, type, voice_url, voice_duration, created_at')
            .single();

        if (error) {
            console.error('Error sending group message:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Fetch the sender profile separately
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', userId)
            .single();

        const enrichedMessage = {
            ...data,
            profiles: profile || { full_name: 'Utilisateur', avatar_url: null }
        };

        return NextResponse.json({ message: enrichedMessage });

    } catch (error: any) {
        console.error('API group-messages POST error:', error);
        return NextResponse.json(
            { error: error.message || 'Erreur serveur' },
            { status: 500 }
        );
    }
}
