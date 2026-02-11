import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, email, full_name, avatar_url, first_name } = body;

        if (!id) {
            return NextResponse.json({ error: 'Missing user id' }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseServiceKey) {
            return NextResponse.json({ error: 'Missing service key' }, { status: 500 });
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        const { error } = await supabaseAdmin
            .from('profiles')
            .upsert({
                id,
                email: email || '',
                full_name: full_name || 'Utilisateur',
                avatar_url: avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(full_name || 'U')}`,
                first_name: first_name || null,
            }, {
                onConflict: 'id',
                ignoreDuplicates: false,
            });

        if (error) {
            console.error('[ensure-profile] Error:', error.message);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
