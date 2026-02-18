import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        throw new Error('Variables d\'environnement Supabase manquantes (SUPABASE_SERVICE_ROLE_KEY)');
    }

    return createClient(url, key, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
}

export async function POST(request: NextRequest) {
    try {
        const { userId } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'userId requis' }, { status: 400 });
        }

        const supabaseAdmin = getSupabaseAdmin();

        // 1. Delete related data first (group memberships, messages, etc.)
        // Delete group memberships
        await supabaseAdmin
            .from('prayer_group_members')
            .delete()
            .eq('user_id', userId);

        // Delete direct messages sent by user
        await supabaseAdmin
            .from('direct_messages')
            .delete()
            .eq('sender_id', userId);

        // Delete group messages sent by user
        await supabaseAdmin
            .from('prayer_group_messages')
            .delete()
            .eq('user_id', userId);

        // Delete conversations where user is participant
        await supabaseAdmin
            .from('conversations')
            .delete()
            .or(`participant1_id.eq.${userId},participant2_id.eq.${userId}`);

        // Delete friend requests
        await supabaseAdmin
            .from('friend_requests')
            .delete()
            .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

        // Delete friendships
        await supabaseAdmin
            .from('friendships')
            .delete()
            .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

        // 2. Delete the profile
        await supabaseAdmin
            .from('profiles')
            .delete()
            .eq('id', userId);

        // 3. Delete the auth user (this is the key step that requires admin privileges)
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (authError) {
            console.error('Error deleting auth user:', authError);
            return NextResponse.json(
                { error: authError.message },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('API delete-user error:', error);
        return NextResponse.json(
            { error: error.message || 'Erreur serveur' },
            { status: 500 }
        );
    }
}
