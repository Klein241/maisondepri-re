import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

        if (!supabaseServiceKey) {
            return NextResponse.json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
        }

        // Use service role to list all auth users
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        // Get all auth users
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();

        if (authError) {
            return NextResponse.json({ error: authError.message }, { status: 500 });
        }

        const users = authData.users;
        let synced = 0;
        let errors = 0;

        for (const user of users) {
            const fullName = user.user_metadata?.full_name
                || user.user_metadata?.first_name
                || user.email?.split('@')[0]
                || 'Utilisateur';

            const { error } = await supabaseAdmin
                .from('profiles')
                .upsert({
                    id: user.id,
                    email: user.email || '',
                    full_name: fullName,
                    avatar_url: user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fullName)}`,
                    first_name: user.user_metadata?.first_name || fullName.split(' ')[0] || null,
                }, {
                    onConflict: 'id',
                    ignoreDuplicates: false,
                });

            if (error) {
                console.error(`[Sync] Failed for ${user.email}:`, error.message);
                errors++;
            } else {
                synced++;
            }
        }

        return NextResponse.json({
            success: true,
            total: users.length,
            synced,
            errors,
            message: `${synced} profils synchronisés, ${errors} erreurs`,
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
