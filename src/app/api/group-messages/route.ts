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

// GET: Load group messages (bypasses RLS)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const groupId = searchParams.get('groupId');

        if (!groupId) {
            return NextResponse.json({ error: 'groupId requis' }, { status: 400 });
        }

        const supabaseAdmin = getSupabaseAdmin();

        // Load messages with profile join - uses service_role so RLS is bypassed
        const { data, error } = await supabaseAdmin
            .from('prayer_group_messages')
            .select(`
                id, group_id, user_id, content, type, voice_url, voice_duration, created_at,
                profiles:user_id(full_name, avatar_url)
            `)
            .eq('group_id', groupId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error loading group messages:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ messages: data || [] });

    } catch (error: any) {
        console.error('API group-messages error:', error);
        return NextResponse.json(
            { error: error.message || 'Erreur serveur' },
            { status: 500 }
        );
    }
}

// POST: Send group message (bypasses RLS)
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

        const { data, error } = await supabaseAdmin
            .from('prayer_group_messages')
            .insert(insertData)
            .select(`
                id, group_id, user_id, content, type, voice_url, voice_duration, created_at,
                profiles:user_id(full_name, avatar_url)
            `)
            .single();

        if (error) {
            console.error('Error sending group message:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ message: data });

    } catch (error: any) {
        console.error('API group-messages POST error:', error);
        return NextResponse.json(
            { error: error.message || 'Erreur serveur' },
            { status: 500 }
        );
    }
}
