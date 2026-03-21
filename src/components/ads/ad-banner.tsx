'use client';

/**
 * AD BANNER COMPONENT
 * ====================
 * Composant réutilisable pour afficher des publicités par zone (placement).
 * Chaque zone de l'application passe son `placement` et le composant
 * charge automatiquement les pubs correspondantes depuis Supabase.
 * 
 * 6 zones supportées :
 *   - book_detail    → Détail du livre (entre les suggestions)
 *   - home_feed      → Accueil bibliothèque (bannière en haut)
 *   - marketplace    → Marketplace (annonce sponsorisée)
 *   - reader_end     → Page d'accueil (bannière principale)
 *   - search_results → Résultats de recherche
 *   - sidebar        → Barre latérale (groupes/salons)
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AdPlacement = 'book_detail' | 'home_feed' | 'marketplace' | 'reader_end' | 'search_results' | 'sidebar';

interface AdData {
    id: string;
    title: string;
    description: string;
    image_url: string;
    link_url: string;
    is_active: boolean;
    placement: string;
    click_count: number;
    view_count: number;
    display_order: number;
    start_date?: string;
    end_date?: string;
}

interface AdBannerProps {
    placement: AdPlacement;
    /** 'banner' = wide horizontal, 'card' = small card, 'inline' = inline within content */
    variant?: 'banner' | 'card' | 'inline';
    className?: string;
    /** If true, renders nothing when no ads found (no empty state) */
    hideWhenEmpty?: boolean;
}

// Global ad cache to avoid re-fetching across components
const adCache: Map<string, { ads: AdData[]; timestamp: number }> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchAdsForPlacement(placement: string): Promise<AdData[]> {
    // Check cache
    const cached = adCache.get(placement);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.ads;
    }

    try {
        const { data } = await supabase
            .from('library_ads')
            .select('*')
            .eq('is_active', true)
            .eq('placement', placement)
            .order('display_order', { ascending: true })
            .limit(3);

        if (data) {
            const today = new Date().toISOString().split('T')[0];
            const validAds = data.filter((ad: any) => {
                if (ad.start_date && ad.start_date > today) return false;
                if (ad.end_date && ad.end_date < today) return false;
                return true;
            });
            adCache.set(placement, { ads: validAds, timestamp: Date.now() });
            return validAds;
        }
    } catch {
        // Table may not exist
    }
    return [];
}

function trackImpression(ad: AdData) {
    supabase.from('library_ads')
        .update({ view_count: (ad.view_count || 0) + 1 })
        .eq('id', ad.id)
        .then(() => { });
}

function trackClick(ad: AdData) {
    supabase.from('library_ads')
        .update({ click_count: (ad.click_count || 0) + 1 })
        .eq('id', ad.id)
        .then(() => { });
}

export function AdBanner({ placement, variant = 'banner', className, hideWhenEmpty = true }: AdBannerProps) {
    const [ads, setAds] = useState<AdData[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        fetchAdsForPlacement(placement).then(result => {
            setAds(result);
            setLoaded(true);
            // Track impression for first ad
            if (result.length > 0) trackImpression(result[0]);
        });
    }, [placement]);

    // Auto-rotate ads every 8 seconds if multiple
    useEffect(() => {
        if (ads.length <= 1) return;
        const interval = setInterval(() => {
            setCurrentIndex(prev => {
                const next = (prev + 1) % ads.length;
                trackImpression(ads[next]);
                return next;
            });
        }, 8000);
        return () => clearInterval(interval);
    }, [ads]);

    if (!loaded || (hideWhenEmpty && ads.length === 0)) return null;

    const ad = ads[currentIndex];
    if (!ad) return null;

    const handleClick = () => {
        trackClick(ad);
    };

    // ─── BANNER variant (wide horizontal, for home_feed, reader_end) ───
    if (variant === 'banner') {
        return (
            <a
                href={ad.link_url || '#'}
                target={ad.link_url ? '_blank' : undefined}
                rel="noopener noreferrer"
                onClick={handleClick}
                className={cn(
                    "block relative overflow-hidden rounded-2xl border border-amber-500/20 group transition-all hover:border-amber-400/40",
                    className
                )}
            >
                <div className="relative">
                    {ad.image_url && (
                        <img
                            src={ad.image_url}
                            alt={ad.title}
                            className="w-full h-32 sm:h-40 object-cover group-hover:scale-[1.02] transition-transform duration-500"
                        />
                    )}
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />
                    {/* Content */}
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="text-sm font-bold text-white truncate">{ad.title}</p>
                        {ad.description && (
                            <p className="text-[10px] text-white/70 truncate mt-0.5">{ad.description}</p>
                        )}
                        {ad.link_url && (
                            <div className="flex items-center gap-1 text-[9px] text-amber-400 mt-1">
                                <ExternalLink className="w-2.5 h-2.5" /> En savoir plus
                            </div>
                        )}
                    </div>
                    {/* AD badge */}
                    <div className="absolute top-2 right-2 bg-amber-500/90 text-[8px] text-white px-1.5 py-0.5 rounded-md font-black tracking-wider">
                        SPONSORISÉ
                    </div>
                </div>
                {/* Rotation dots */}
                {ads.length > 1 && (
                    <div className="absolute bottom-2 right-3 flex gap-1">
                        {ads.map((_, i) => (
                            <div key={i} className={cn("w-1.5 h-1.5 rounded-full transition-all", i === currentIndex ? "bg-amber-400 w-3" : "bg-white/30")} />
                        ))}
                    </div>
                )}
            </a>
        );
    }

    // ─── CARD variant (small card, for sidebar, marketplace) ───
    if (variant === 'card') {
        return (
            <a
                href={ad.link_url || '#'}
                target={ad.link_url ? '_blank' : undefined}
                rel="noopener noreferrer"
                onClick={handleClick}
                className={cn(
                    "block rounded-xl overflow-hidden border border-amber-500/20 bg-linear-to-br from-amber-500/10 to-orange-500/10 hover:border-amber-400/40 transition-all group relative",
                    className
                )}
            >
                {ad.image_url && (
                    <div className="aspect-video overflow-hidden">
                        <img src={ad.image_url} alt={ad.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    </div>
                )}
                <div className="p-2.5">
                    <p className="text-xs font-bold text-amber-300 truncate">{ad.title}</p>
                    {ad.description && (
                        <p className="text-[10px] text-amber-400/60 truncate mt-0.5">{ad.description}</p>
                    )}
                </div>
                <div className="absolute top-1 right-1 bg-amber-500/80 text-[7px] text-white px-1 py-0.5 rounded font-bold">AD</div>
            </a>
        );
    }

    // ─── INLINE variant (within search results, between items) ───
    return (
        <a
            href={ad.link_url || '#'}
            target={ad.link_url ? '_blank' : undefined}
            rel="noopener noreferrer"
            onClick={handleClick}
            className={cn(
                "flex items-center gap-3 p-3 rounded-xl border border-amber-500/15 bg-amber-500/5 hover:bg-amber-500/10 transition-all group",
                className
            )}
        >
            {ad.image_url && (
                <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0">
                    <img src={ad.image_url} alt={ad.title} className="w-full h-full object-cover" />
                </div>
            )}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="bg-amber-500/80 text-[7px] text-white px-1 py-0.5 rounded font-bold">AD</span>
                    <p className="text-xs font-bold text-amber-300 truncate">{ad.title}</p>
                </div>
                {ad.description && (
                    <p className="text-[10px] text-slate-400 line-clamp-2">{ad.description}</p>
                )}
                {ad.link_url && (
                    <p className="text-[9px] text-amber-400/60 mt-1 flex items-center gap-1">
                        <ExternalLink className="w-2.5 h-2.5" /> Découvrir
                    </p>
                )}
            </div>
        </a>
    );
}

/** Clear ad cache (e.g., when admin updates ads) */
export function clearAdCache() {
    adCache.clear();
}

/** Hook to get ads for a specific placement (for custom rendering) */
export function useAds(placement: AdPlacement) {
    const [ads, setAds] = useState<AdData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAdsForPlacement(placement).then(result => {
            setAds(result);
            setLoading(false);
        });
    }, [placement]);

    return { ads, loading, trackClick, trackImpression };
}
