'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, BookOpen } from 'lucide-react';

function BookRedirect() {
    const searchParams = useSearchParams();
    const slug = searchParams.get('s') || searchParams.get('slug') || '';

    useEffect(() => {
        if (!slug) {
            window.location.replace('/?tab=library');
            return;
        }

        async function loadAndRedirect() {
            try {
                const { data: book } = await supabase
                    .from('library_books')
                    .select('id, title')
                    .eq('slug', slug)
                    .eq('is_published', true)
                    .single();

                if (book) {
                    document.title = `📚 ${book.title} — Maison de Prière`;
                }
            } catch (e) {
                console.error('Error loading book:', e);
            }

            // Redirect to main app with library tab + book slug
            window.location.replace(`/?tab=library&book=${slug}`);
        }

        const timer = setTimeout(loadAndRedirect, 300);
        return () => clearTimeout(timer);
    }, [slug]);

    return (
        <div className="fixed inset-0 bg-[#0B0E14] flex flex-col items-center justify-center text-white">
            <BookOpen className="h-16 w-16 text-emerald-400 mb-4 animate-pulse" />
            <Loader2 className="h-6 w-6 animate-spin text-emerald-400 mb-3" />
            <p className="text-sm text-slate-400">Ouverture du livre...</p>
        </div>
    );
}

export default function LivrePage() {
    return (
        <Suspense fallback={
            <div className="fixed inset-0 bg-[#0B0E14] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
            </div>
        }>
            <BookRedirect />
        </Suspense>
    );
}
