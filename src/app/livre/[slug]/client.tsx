'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, BookOpen } from 'lucide-react';

export default function BookPageClient() {
    const params = useParams();
    const slug = params?.slug as string;

    useEffect(() => {
        if (!slug) {
            window.location.replace('/?tab=library');
            return;
        }

        // Redirect to main app with library tab + book slug after a brief delay
        const timer = setTimeout(() => {
            window.location.replace(`/?tab=library&book=${slug}`);
        }, 500);

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
