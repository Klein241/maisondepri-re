// Server Component — NO 'use client' here
// generateStaticParams() must live in a server component
import ReplayClient from './replay-client';

// Required for Next.js static export with dynamic routes.
// Returns [] because IDs come from Supabase at runtime (no pre-generation).
export function generateStaticParams() {
    return [];
}

export default function ReplayPage() {
    return <ReplayClient />;
}
