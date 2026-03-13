import { createClient } from '@supabase/supabase-js';
import { Metadata } from 'next';
import BookPageClient from './client';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

interface Props {
    params: Promise<{ slug: string }>;
}

// Generate dynamic OG metadata for rich link previews (WhatsApp, Facebook, Twitter)
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: book } = await supabase
        .from('library_books')
        .select('title, author, description, cover_url, category')
        .eq('slug', slug)
        .eq('is_published', true)
        .single();

    if (!book) {
        return {
            title: 'Livre introuvable — Maison de Prière',
            description: 'Ce livre n\'existe pas ou a été retiré de la bibliothèque.',
        };
    }

    const title = `📚 ${book.title} — Maison de Prière`;
    const description = book.description
        ? `${book.description.slice(0, 150)}…`
        : `par ${book.author} — Découvrez ce livre sur Maison de Prière`;

    return {
        title,
        description,
        openGraph: {
            title: book.title,
            description,
            images: book.cover_url ? [book.cover_url] : ['/icon-512.png'],
            type: 'article',
            siteName: 'Maison de Prière',
        },
        twitter: {
            card: book.cover_url ? 'summary_large_image' : 'summary',
            title: book.title,
            description,
            images: book.cover_url ? [book.cover_url] : undefined,
        },
    };
}

export default async function BookPage({ params }: Props) {
    return <BookPageClient />;
}
