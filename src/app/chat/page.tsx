'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { WhatsAppChat } from '@/components/community/whatsapp-chat';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function ChatPage() {
    const [user, setUser] = useState<{ id: string; name: string; avatar?: string } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function getUser() {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (authUser) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name, avatar_url')
                    .eq('id', authUser.id)
                    .single();

                setUser({
                    id: authUser.id,
                    name: profile?.full_name || authUser.email || 'Utilisateur',
                    avatar: profile?.avatar_url
                });
            }
            setLoading(false);
        }

        getUser();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session?.user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name, avatar_url')
                    .eq('id', session.user.id)
                    .single();

                setUser({
                    id: session.user.id,
                    name: profile?.full_name || session.user.email || 'Utilisateur',
                    avatar: profile?.avatar_url
                });
            } else {
                setUser(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 flex flex-col items-center justify-center gap-4 p-4">
                <h1 className="text-2xl font-bold text-white">Messages</h1>
                <p className="text-slate-400 text-center">Connectez-vous pour accéder à vos messages</p>
                <Link href="/">
                    <Button className="bg-indigo-600 hover:bg-indigo-500">
                        Se connecter
                    </Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 flex flex-col">
            {/* Header */}
            <header className="p-4 border-b border-white/10 flex items-center gap-3 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
                <Link href="/">
                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <h1 className="text-xl font-bold text-white">Messages</h1>
            </header>

            {/* Chat Component - Full Height */}
            <div className="flex-1 relative" style={{ height: 'calc(100vh - 73px)' }}>
                <WhatsAppChat user={user} />
            </div>
        </div>
    );
}
