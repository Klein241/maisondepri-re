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

const ALLOWED_TABLES = [
    'prayer_requests',
    'testimonials',
    'days', // Program days
    'daily_prayers',
    'notifications',
    'users',
    'profiles',
    'prayer_groups',
    'prayer_group_members',
    'prayer_group_messages',
    'bible_chapters',
];

export async function POST(request: NextRequest) {
    try {
        const { table, id, key = 'id' } = await request.json();

        if (!table || !id) {
            return NextResponse.json({ error: 'Table et ID requis' }, { status: 400 });
        }

        if (!ALLOWED_TABLES.includes(table)) {
            return NextResponse.json({ error: 'Table non autorisée' }, { status: 403 });
        }

        const supabaseAdmin = getSupabaseAdmin();

        // @ts-ignore - Supabase types cause infinite depth with dynamic table names
        const deleteResult = await supabaseAdmin
            .from(table)
            .delete()
            .eq(key, id);

        if (deleteResult.error) {
            console.error('Delete error:', deleteResult.error);
            return NextResponse.json({ error: deleteResult.error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('API error:', error);
        return NextResponse.json(
            { error: error.message || 'Erreur serveur' },
            { status: 500 }
        );
    }
}
