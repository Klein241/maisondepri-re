'use client';

/**
 * BIBLE FEATURES HOOKS
 * ====================
 * Provides favorites, highlights, and verse comparison functionality
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// Types
export interface BibleFavorite {
    id: string;
    user_id: string;
    reference: string;
    text: string;
    translation: string;
    created_at: string;
    notes?: string;
}

export interface BibleHighlight {
    id: string;
    user_id: string;
    reference: string;
    text: string;
    translation: string;
    color: string;
    created_at: string;
}

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple' | 'orange';

export const HIGHLIGHT_COLORS: Record<HighlightColor, { name: string; bgClass: string; borderClass: string }> = {
    yellow: { name: 'Jaune', bgClass: 'bg-yellow-500/30', borderClass: 'border-yellow-500' },
    green: { name: 'Vert', bgClass: 'bg-green-500/30', borderClass: 'border-green-500' },
    blue: { name: 'Bleu', bgClass: 'bg-blue-500/30', borderClass: 'border-blue-500' },
    pink: { name: 'Rose', bgClass: 'bg-pink-500/30', borderClass: 'border-pink-500' },
    purple: { name: 'Violet', bgClass: 'bg-purple-500/30', borderClass: 'border-purple-500' },
    orange: { name: 'Orange', bgClass: 'bg-orange-500/30', borderClass: 'border-orange-500' },
};

// Hook for managing favorites
export function useBibleFavorites(userId?: string) {
    const [favorites, setFavorites] = useState<BibleFavorite[]>([]);
    const [loading, setLoading] = useState(false);

    // Load favorites from Supabase
    const loadFavorites = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('bible_favorites')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) {
                // Table might not exist yet - create it via localStorage fallback
                console.log('Favorites table not available, using localStorage');
                const stored = localStorage.getItem(`bible_favorites_${userId}`);
                if (stored) {
                    setFavorites(JSON.parse(stored));
                }
            } else {
                setFavorites(data || []);
            }
        } catch (e) {
            console.error('Error loading favorites:', e);
        }
        setLoading(false);
    }, [userId]);

    useEffect(() => {
        loadFavorites();
    }, [loadFavorites]);

    // Add to favorites
    const addFavorite = async (reference: string, text: string, translation: string, notes?: string) => {
        if (!userId) {
            toast.error('Connectez-vous pour ajouter aux favoris');
            return false;
        }

        const newFavorite: BibleFavorite = {
            id: crypto.randomUUID(),
            user_id: userId,
            reference,
            text,
            translation,
            notes,
            created_at: new Date().toISOString()
        };

        try {
            const { error } = await supabase
                .from('bible_favorites')
                .insert(newFavorite);

            if (error) {
                // Fallback to localStorage
                const updated = [...favorites, newFavorite];
                setFavorites(updated);
                localStorage.setItem(`bible_favorites_${userId}`, JSON.stringify(updated));
            } else {
                setFavorites(prev => [newFavorite, ...prev]);
            }
            toast.success('Ajouté aux favoris ⭐');
            return true;
        } catch (e) {
            console.error('Error adding favorite:', e);
            toast.error('Erreur lors de l\'ajout');
            return false;
        }
    };

    // Remove from favorites
    const removeFavorite = async (id: string) => {
        try {
            const { error } = await supabase
                .from('bible_favorites')
                .delete()
                .eq('id', id);

            if (error) {
                // Fallback to localStorage
                const updated = favorites.filter(f => f.id !== id);
                setFavorites(updated);
                localStorage.setItem(`bible_favorites_${userId}`, JSON.stringify(updated));
            } else {
                setFavorites(prev => prev.filter(f => f.id !== id));
            }
            toast.success('Retiré des favoris');
        } catch (e) {
            console.error('Error removing favorite:', e);
        }
    };

    // Check if reference is favorited
    const isFavorite = (reference: string) => {
        return favorites.some(f => f.reference === reference);
    };

    return { favorites, loading, addFavorite, removeFavorite, isFavorite, loadFavorites };
}

// Hook for managing highlights
export function useBibleHighlights(userId?: string) {
    const [highlights, setHighlights] = useState<BibleHighlight[]>([]);
    const [loading, setLoading] = useState(false);

    // Load highlights
    const loadHighlights = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('bible_highlights')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) {
                console.log('Highlights table not available, using localStorage');
                const stored = localStorage.getItem(`bible_highlights_${userId}`);
                if (stored) {
                    setHighlights(JSON.parse(stored));
                }
            } else {
                setHighlights(data || []);
            }
        } catch (e) {
            console.error('Error loading highlights:', e);
        }
        setLoading(false);
    }, [userId]);

    useEffect(() => {
        loadHighlights();
    }, [loadHighlights]);

    // Add highlight
    const addHighlight = async (reference: string, text: string, translation: string, color: HighlightColor) => {
        if (!userId) {
            toast.error('Connectez-vous pour surligner');
            return false;
        }

        const newHighlight: BibleHighlight = {
            id: crypto.randomUUID(),
            user_id: userId,
            reference,
            text,
            translation,
            color,
            created_at: new Date().toISOString()
        };

        try {
            const { error } = await supabase
                .from('bible_highlights')
                .insert(newHighlight);

            if (error) {
                const updated = [...highlights, newHighlight];
                setHighlights(updated);
                localStorage.setItem(`bible_highlights_${userId}`, JSON.stringify(updated));
            } else {
                setHighlights(prev => [newHighlight, ...prev]);
            }
            toast.success(`Verset surligné en ${HIGHLIGHT_COLORS[color].name}`);
            return true;
        } catch (e) {
            console.error('Error adding highlight:', e);
            return false;
        }
    };

    // Remove highlight
    const removeHighlight = async (id: string) => {
        try {
            const { error } = await supabase
                .from('bible_highlights')
                .delete()
                .eq('id', id);

            if (error) {
                const updated = highlights.filter(h => h.id !== id);
                setHighlights(updated);
                localStorage.setItem(`bible_highlights_${userId}`, JSON.stringify(updated));
            } else {
                setHighlights(prev => prev.filter(h => h.id !== id));
            }
            toast.success('Surlignage retiré');
        } catch (e) {
            console.error('Error removing highlight:', e);
        }
    };

    // Get highlight for reference
    const getHighlight = (reference: string): BibleHighlight | undefined => {
        return highlights.find(h => h.reference === reference);
    };

    return { highlights, loading, addHighlight, removeHighlight, getHighlight, loadHighlights };
}

// Share verse function
export async function shareVerse(reference: string, text: string, translation: string) {
    const shareText = `📖 ${reference} (${translation})\n\n"${text}"\n\n— Prayer Marathon App`;

    try {
        if (navigator.share) {
            await navigator.share({
                title: reference,
                text: shareText,
            });
            return true;
        } else {
            // Fallback to clipboard
            await navigator.clipboard.writeText(shareText);
            toast.success('Verset copié dans le presse-papier');
            return true;
        }
    } catch (e) {
        console.error('Error sharing:', e);
        return false;
    }
}

// Copy verse to clipboard
export async function copyVerse(reference: string, text: string) {
    try {
        await navigator.clipboard.writeText(`${reference}\n${text}`);
        toast.success('Verset copié');
        return true;
    } catch (e) {
        console.error('Error copying:', e);
        return false;
    }
}
