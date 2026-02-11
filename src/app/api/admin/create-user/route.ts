import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Create admin client inside the function to avoid build-time errors
function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url) {
        throw new Error('SUPABASE_URL manquante. Vérifiez votre fichier .env.local');
    }

    if (!key || key === 'VOTRE_CLE_SERVICE_ROLE_ICI') {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY manquante ou non configurée. Récupérez-la depuis Supabase Dashboard > Settings > API > Service Role Key');
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
        const supabaseAdmin = getSupabaseAdmin();

        const body = await request.json();
        const { email, password, full_name, role, phone, city, church, country } = body;

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email et mot de passe requis' },
                { status: 400 }
            );
        }

        // Create user with admin API - this auto-confirms the email
        const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto-confirm the email
            user_metadata: {
                full_name,
                role,
                phone_number: phone
            }
        });

        if (createError) {
            console.error('Error creating user:', createError);
            return NextResponse.json(
                { error: createError.message },
                { status: 400 }
            );
        }

        if (userData.user) {
            // Update/create profile
            const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .upsert({
                    id: userData.user.id,
                    full_name: full_name || null,
                    email: email,
                    phone: phone || null,
                    role: role || 'user',
                    city: city || null,
                    church: church || null,
                    country: country || null,
                    is_active: true,
                    created_at: new Date().toISOString()
                });

            if (profileError) {
                console.warn('Profile creation warning:', profileError);
            }

            return NextResponse.json({
                success: true,
                user: {
                    id: userData.user.id,
                    email: userData.user.email
                }
            });
        }

        return NextResponse.json(
            { error: 'Erreur inconnue lors de la création' },
            { status: 500 }
        );

    } catch (error: any) {
        console.error('API error:', error);
        return NextResponse.json(
            { error: error.message || 'Erreur serveur' },
            { status: 500 }
        );
    }
}
