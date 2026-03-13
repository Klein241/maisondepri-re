'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BookOpen, Star, Download, Heart, Search, ArrowLeft,
    Clock, Eye, ChevronRight, Loader2, BookMarked, History,
    X, Share2, Lock, ChevronLeft, ZoomIn, ZoomOut, Wifi, WifiOff
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/lib/store';

// Categories
const CATEGORIES = [
    { id: 'all', label: 'Tout', icon: '📚' },
    { id: 'bible-study', label: 'Étude biblique', icon: '📖' },
    { id: 'prayer', label: 'Prière', icon: '🙏' },
    { id: 'theology', label: 'Théologie', icon: '⛪' },
    { id: 'devotional', label: 'Dévotionnel', icon: '💝' },
    { id: 'biography', label: 'Biographie', icon: '👤' },
    { id: 'youth', label: 'Jeunesse', icon: '🌟' },
    { id: 'worship', label: 'Louange', icon: '🎵' },
    { id: 'other', label: 'Autres', icon: '📕' },
];

interface Book {
    id: string;
    title: string;
    author: string;
    description: string;
    category: string;
    cover_url: string | null;
    file_url: string;
    file_name: string;
    file_size: number;
    file_type: string;
    page_count: number;
    avg_rating: number;
    rating_count: number;
    download_count: number;
    slug: string | null;
}

function slugify(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 80);
}

// Star rating component
function StarRating({ rating, onChange, size = 'sm' }: { rating: number; onChange?: (r: number) => void; size?: 'sm' | 'lg' }) {
    const stars = [1, 2, 3, 4, 5];
    const sizeClass = size === 'lg' ? 'h-6 w-6' : 'h-3.5 w-3.5';
    return (
        <div className="flex gap-0.5">
            {stars.map(s => (
                <button
                    key={s}
                    onClick={(e) => { e.stopPropagation(); onChange?.(s); }}
                    disabled={!onChange}
                    className={`transition-colors ${onChange ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
                >
                    <Star className={`${sizeClass} ${s <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}`} />
                </button>
            ))}
        </div>
    );
}

// Book cover placeholder
function BookCover({ title, category }: { title: string; category: string }) {
    const gradients: Record<string, string> = {
        'bible-study': 'from-blue-600 to-indigo-800',
        'prayer': 'from-purple-600 to-violet-800',
        'theology': 'from-emerald-600 to-teal-800',
        'devotional': 'from-rose-600 to-pink-800',
        'biography': 'from-amber-600 to-orange-800',
        'youth': 'from-cyan-500 to-blue-700',
        'worship': 'from-pink-500 to-fuchsia-700',
        'other': 'from-slate-600 to-gray-800',
    };
    return (
        <div className={`w-full h-full bg-linear-to-br ${gradients[category] || gradients.other} flex flex-col items-center justify-center p-2 rounded-lg`}>
            <BookOpen className="h-8 w-8 text-white/60 mb-2" />
            <p className="text-[9px] text-white/80 text-center line-clamp-3 font-medium leading-tight">{title}</p>
        </div>
    );
}

// Auth gate: overlay for non-logged-in users trying to use features
function AuthGate({ onClose }: { onClose: () => void }) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-[#161B26] rounded-2xl p-6 max-w-sm w-full text-center border border-white/10"
                onClick={e => e.stopPropagation()}
            >
                <Lock className="h-12 w-12 text-amber-400 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">Connexion requise</h3>
                <p className="text-sm text-slate-400 mb-6">
                    Connectez-vous pour lire, télécharger, noter les livres et gérer vos favoris.
                </p>
                <Button
                    className="w-full bg-linear-to-r from-primary to-purple-600 text-white"
                    onClick={() => {
                        // Navigate to auth - store will handle this
                        window.location.hash = '#auth';
                        onClose();
                    }}
                >
                    Se connecter
                </Button>
            </motion.div>
        </motion.div>
    );
}

export function LibraryView() {
    const { user } = useAppStore();
    const [books, setBooks] = useState<Book[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedBook, setSelectedBook] = useState<Book | null>(null);
    const [showFavorites, setShowFavorites] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showAuthGate, setShowAuthGate] = useState(false);

    // Supabase-backed user data
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [ratings, setRatings] = useState<Record<string, number>>({});
    const [readHistory, setReadHistory] = useState<any[]>([]);

    // Reading state - in-app PDF viewer
    const [isReading, setIsReading] = useState(false);
    const [readingBook, setReadingBook] = useState<Book | null>(null);

    // Offline cache state
    const [cachedBookUrls, setCachedBookUrls] = useState<Set<string>>(new Set());
    const [cachingBookId, setCachingBookId] = useState<string | null>(null);

    const isLoggedIn = !!user?.id;

    // Require auth helper
    const requireAuth = useCallback((action: () => void) => {
        if (!isLoggedIn) {
            setShowAuthGate(true);
            return;
        }
        action();
    }, [isLoggedIn]);

    // Load books (public - no auth required)
    useEffect(() => {
        loadBooks();
    }, []);

    // Load user data only when logged in
    useEffect(() => {
        if (isLoggedIn) {
            loadUserFavorites();
            loadUserRatings();
            loadReadingHistory();
        }
    }, [isLoggedIn]);

    // Listen for SW cache messages + request cached books list
    useEffect(() => {
        const handler = (event: MessageEvent) => {
            if (event.data?.type === 'CACHED_BOOKS_LIST') {
                setCachedBookUrls(new Set(event.data.urls));
            }
            if (event.data?.type === 'BOOK_CACHED') {
                setCachingBookId(null);
                if (event.data.success) {
                    setCachedBookUrls(prev => new Set([...prev, event.data.url]));
                    toast.success(`📶 "${event.data.title}" disponible hors-ligne`);
                } else {
                    toast.error('Erreur de cache hors-ligne');
                }
            }
        };
        navigator.serviceWorker?.addEventListener('message', handler);
        // Ask SW for current cached books
        navigator.serviceWorker?.ready.then(reg => {
            reg.active?.postMessage({ type: 'GET_CACHED_BOOKS' });
        });
        return () => navigator.serviceWorker?.removeEventListener('message', handler);
    }, []);

    const loadBooks = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('library_books')
                .select('*')
                .eq('is_published', true)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setBooks(data || []);
        } catch (e) {
            console.error('Error loading books:', e);
        }
        setIsLoading(false);
    };

    const loadUserFavorites = async () => {
        try {
            const { data } = await supabase
                .from('library_favorites')
                .select('book_id')
                .eq('user_id', user?.id);
            if (data) setFavorites(new Set(data.map(d => d.book_id)));
        } catch (e) { /* table may not exist yet */ }
    };

    const loadUserRatings = async () => {
        try {
            const { data } = await supabase
                .from('library_ratings')
                .select('book_id, rating')
                .eq('user_id', user?.id);
            if (data) {
                const map: Record<string, number> = {};
                data.forEach(d => { map[d.book_id] = d.rating; });
                setRatings(map);
            }
        } catch (e) { /* table may not exist yet */ }
    };

    const loadReadingHistory = async () => {
        try {
            const { data } = await supabase
                .from('library_reading_history')
                .select('*')
                .eq('user_id', user?.id)
                .order('last_read_at', { ascending: false })
                .limit(20);
            if (data) setReadHistory(data);
        } catch (e) { /* table may not exist yet */ }
    };

    const toggleFavorite = useCallback(async (bookId: string) => {
        if (!user?.id) { setShowAuthGate(true); return; }

        const isFav = favorites.has(bookId);
        // Optimistic
        setFavorites(prev => {
            const next = new Set(prev);
            isFav ? next.delete(bookId) : next.add(bookId);
            return next;
        });

        try {
            if (isFav) {
                await supabase.from('library_favorites').delete()
                    .eq('book_id', bookId).eq('user_id', user.id);
            } else {
                await supabase.from('library_favorites').insert({ book_id: bookId, user_id: user.id });
                toast.success("Ajouté aux favoris ❤️");
            }
        } catch (e) {
            // Revert
            setFavorites(prev => {
                const next = new Set(prev);
                isFav ? next.add(bookId) : next.delete(bookId);
                return next;
            });
        }
    }, [user?.id, favorites]);

    const setBookRating = useCallback(async (bookId: string, rating: number) => {
        if (!user?.id) { setShowAuthGate(true); return; }

        setRatings(prev => ({ ...prev, [bookId]: rating }));

        try {
            const { error } = await supabase.from('library_ratings')
                .upsert({ book_id: bookId, user_id: user.id, rating, updated_at: new Date().toISOString() },
                    { onConflict: 'book_id,user_id' });
            if (error) throw error;
            toast.success(`Note ${rating}/5 enregistrée ⭐`);
            // The trigger will auto-update avg_rating and rating_count
            loadBooks();
        } catch (e: any) {
            toast.error("Erreur: " + e.message);
        }
    }, [user?.id]);

    const openBook = useCallback(async (book: Book) => {
        if (!user?.id) { setShowAuthGate(true); return; }

        // Track in reading history
        try {
            await supabase.from('library_reading_history')
                .upsert({
                    book_id: book.id,
                    user_id: user.id,
                    total_pages: book.page_count || 0,
                    last_read_at: new Date().toISOString(),
                }, { onConflict: 'book_id,user_id' });
        } catch (e) { /* ignore */ }

        if (book.file_url) {
            setReadingBook(book);
            setIsReading(true);
        } else {
            toast.info("Fichier non disponible");
        }
    }, [user?.id]);

    const downloadBook = useCallback(async (book: Book) => {
        if (!user?.id) { setShowAuthGate(true); return; }

        if (book.file_url) {
            // Track download in dedicated table (trigger updates count)
            try {
                await supabase.from('library_downloads').insert({
                    book_id: book.id,
                    user_id: user.id,
                });
            } catch (e) { /* ignore if table doesn't exist */ }

            // Download using fetch + blob for in-app experience
            try {
                toast.info("Téléchargement en cours...");
                const response = await fetch(book.file_url);
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = book.file_name || `${book.title}.${book.file_type || 'pdf'}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                toast.success('Téléchargement terminé 📥');
            } catch (e) {
                // Fallback to direct open
                window.open(book.file_url, '_blank');
                toast.success('Téléchargement lancé 📥');
            }
        }
    }, [user?.id]);

    const shareBook = useCallback(async (book: Book) => {
        const slug = book.slug || slugify(book.title);
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        const shareUrl = `${baseUrl}/livre/${slug}`;
        const shareText = `📚 ${book.title}\npar ${book.author}\n\nDécouvrez ce livre sur Maison de Prière !`;

        if (navigator.share) {
            try {
                await navigator.share({ title: book.title, text: shareText, url: shareUrl });
            } catch (e) { /* user cancelled */ }
        } else {
            await navigator.clipboard.writeText(shareText + '\n' + shareUrl);
            toast.success("Lien copié dans le presse-papier 📋");
        }
    }, []);

    const formatSize = (bytes: number) => {
        if (!bytes) return '';
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const cacheBookOffline = useCallback(async (book: Book) => {
        if (!book.file_url) return;
        const isCached = cachedBookUrls.has(book.file_url);

        if (isCached) {
            // Remove from cache
            navigator.serviceWorker?.ready.then(reg => {
                reg.active?.postMessage({ type: 'UNCACHE_BOOK', url: book.file_url });
            });
            setCachedBookUrls(prev => {
                const next = new Set(prev);
                next.delete(book.file_url);
                return next;
            });
            toast.info('Livre retiré du cache hors-ligne');
        } else {
            // Add to cache
            setCachingBookId(book.id);
            navigator.serviceWorker?.ready.then(reg => {
                reg.active?.postMessage({
                    type: 'CACHE_BOOK',
                    url: book.file_url,
                    title: book.title,
                });
            });
        }
    }, [cachedBookUrls]);

    // Filter books
    const filteredBooks = books.filter(book => {
        const matchesSearch = !searchQuery ||
            book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            book.author.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || book.category === selectedCategory;
        const matchesFavorites = !showFavorites || favorites.has(book.id);
        return matchesSearch && matchesCategory && matchesFavorites;
    });

    // ═══════════════════════ IN-APP PDF READER ═══════════════════════
    if (isReading && readingBook) {
        return (
            <div className="fixed inset-0 z-50 bg-[#0B0E14] flex flex-col">
                {/* Reader header */}
                <div className="flex items-center justify-between px-3 py-2 bg-[#161B26] border-b border-white/10 shrink-0">
                    <Button size="sm" variant="ghost" className="text-white hover:bg-white/10 gap-1"
                        onClick={() => { setIsReading(false); setReadingBook(null); }}>
                        <ArrowLeft className="h-4 w-4" /> Retour
                    </Button>
                    <div className="text-center flex-1 min-w-0 px-2">
                        <p className="text-xs font-medium text-white truncate">{readingBook.title}</p>
                        <p className="text-[10px] text-slate-400 truncate">{readingBook.author}</p>
                    </div>
                    <Button size="sm" variant="ghost" className="text-white hover:bg-white/10"
                        onClick={() => downloadBook(readingBook)}>
                        <Download className="h-4 w-4" />
                    </Button>
                </div>
                {/* PDF embed - object/embed gives native rendering without browser nav bar */}
                <div className="flex-1 overflow-hidden">
                    {readingBook.file_type === 'pdf' ? (
                        <object
                            data={`${readingBook.file_url}#toolbar=1&navpanes=0&scrollbar=1`}
                            type="application/pdf"
                            className="w-full h-full"
                        >
                            {/* Fallback for mobile where object doesn't work for PDFs */}
                            <iframe
                                src={`https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(readingBook.file_url)}`}
                                className="w-full h-full border-none"
                                title={readingBook.title}
                            />
                        </object>
                    ) : (
                        <iframe
                            src={readingBook.file_url}
                            className="w-full h-full border-none"
                            title={readingBook.title}
                        />
                    )}
                </div>
            </div>
        );
    }

    // ═══════════════════════ BOOK DETAIL VIEW ═══════════════════════
    if (selectedBook) {
        const userRating = ratings[selectedBook.id] || 0;
        const historyEntry = readHistory.find(h => h.book_id === selectedBook.id);
        const isFav = favorites.has(selectedBook.id);

        return (
            <div className="relative min-h-screen bg-linear-to-b from-[#0B0E14] to-[#0F1219] text-white pb-24 overflow-y-auto">
                <div className="relative z-10 max-w-lg mx-auto w-full px-4 pt-4">
                    <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white mb-4"
                        onClick={() => setSelectedBook(null)}>
                        <ArrowLeft className="h-4 w-4 mr-1" /> Bibliothèque
                    </Button>

                    <div className="flex gap-4 mb-6">
                        <div className="w-32 h-44 rounded-xl overflow-hidden shadow-2xl shrink-0">
                            {selectedBook.cover_url ? (
                                <img src={selectedBook.cover_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <BookCover title={selectedBook.title} category={selectedBook.category} />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-lg font-bold text-white mb-1">{selectedBook.title}</h2>
                            <p className="text-sm text-slate-400 mb-2">{selectedBook.author}</p>
                            <Badge className="bg-primary/20 text-primary border-none text-[10px] mb-2">
                                {CATEGORIES.find(c => c.id === selectedBook.category)?.icon} {CATEGORIES.find(c => c.id === selectedBook.category)?.label}
                            </Badge>
                            <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
                                {selectedBook.file_size > 0 && (
                                    <span>{formatSize(selectedBook.file_size)}</span>
                                )}
                                {selectedBook.download_count > 0 && (
                                    <span className="flex items-center gap-1">
                                        <Download className="h-3 w-3" /> {selectedBook.download_count}
                                    </span>
                                )}
                            </div>
                            {/* Average rating */}
                            <div className="flex items-center gap-1.5 mb-2">
                                <StarRating rating={Math.round(Number(selectedBook.avg_rating))} size="sm" />
                                <span className="text-xs text-slate-400">
                                    {Number(selectedBook.avg_rating).toFixed(1)} ({selectedBook.rating_count} avis)
                                </span>
                            </div>
                            {/* Your rating (requires login) */}
                            <div>
                                <p className="text-[10px] text-slate-500 mb-1">
                                    {isLoggedIn ? 'Votre note' : '🔒 Connectez-vous pour noter'}
                                </p>
                                <StarRating
                                    rating={userRating}
                                    onChange={isLoggedIn ? (r) => setBookRating(selectedBook.id, r) : undefined}
                                    size="lg"
                                />
                            </div>
                        </div>
                    </div>

                    {selectedBook.description && (
                        <p className="text-sm text-slate-300 mb-4 leading-relaxed">{selectedBook.description}</p>
                    )}

                    {historyEntry && (
                        <Card className="bg-white/5 border-white/10 mb-4">
                            <CardContent className="p-3 flex items-center gap-3">
                                <Clock className="h-4 w-4 text-slate-400" />
                                <div className="flex-1">
                                    <p className="text-xs text-white">Dernière lecture</p>
                                    <p className="text-[10px] text-slate-400">
                                        {new Date(historyEntry.last_read_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <div className="flex gap-3 mb-3">
                        <Button className="flex-1 bg-linear-to-r from-primary to-purple-600 text-white shadow-lg shadow-primary/30"
                            onClick={() => requireAuth(() => openBook(selectedBook))}>
                            {isLoggedIn ? <Eye className="h-4 w-4 mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                            Lire
                        </Button>
                        <Button variant="outline" className="border-white/10 text-white hover:bg-white/5"
                            onClick={() => requireAuth(() => downloadBook(selectedBook))}>
                            <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="outline"
                            className={`border-white/10 ${isFav ? 'text-red-400 border-red-400/30' : 'text-white'} hover:bg-white/5`}
                            onClick={() => requireAuth(() => toggleFavorite(selectedBook.id))}>
                            <Heart className={`h-4 w-4 ${isFav ? 'fill-red-400' : ''}`} />
                        </Button>
                        <Button variant="outline" className="border-white/10 text-white hover:bg-white/5"
                            onClick={() => shareBook(selectedBook)}>
                            <Share2 className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Offline cache button */}
                    {isLoggedIn && selectedBook.file_url && (
                        <Button
                            variant="outline"
                            className={`w-full mb-4 border-white/10 ${cachedBookUrls.has(selectedBook.file_url) ? 'text-emerald-400 border-emerald-400/30' : 'text-slate-400'} hover:bg-white/5`}
                            onClick={() => cacheBookOffline(selectedBook)}
                            disabled={cachingBookId === selectedBook.id}
                        >
                            {cachingBookId === selectedBook.id ? (
                                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Téléchargement...</>
                            ) : cachedBookUrls.has(selectedBook.file_url) ? (
                                <><WifiOff className="h-4 w-4 mr-2" /> Disponible hors-ligne ✔️</>
                            ) : (
                                <><Wifi className="h-4 w-4 mr-2" /> Sauvegarder pour lire hors-ligne</>
                            )}
                        </Button>
                    )}

                    {/* Login prompt for non-auth users */}
                    {!isLoggedIn && (
                        <Card className="bg-amber-500/10 border-amber-500/20 mb-4">
                            <CardContent className="p-3 flex items-center gap-3">
                                <Lock className="h-5 w-5 text-amber-400 shrink-0" />
                                <div className="flex-1">
                                    <p className="text-xs text-amber-300 font-medium">Connexion requise</p>
                                    <p className="text-[10px] text-amber-300/70">pour lire, télécharger, noter et ajouter en favoris</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        );
    }

    // ═══════════════════════ MAIN LIBRARY VIEW ═══════════════════════
    return (
        <div className="relative min-h-screen bg-linear-to-b from-[#0B0E14] to-[#0F1219] text-white pb-24 overflow-y-auto">
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] bg-emerald-600/5 blur-[150px] rounded-full" />
                <div className="absolute bottom-[-20%] left-[-20%] w-[50%] h-[50%] bg-teal-600/5 blur-[150px] rounded-full" />
            </div>

            <div className="relative z-10 max-w-lg mx-auto w-full px-4 pt-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold bg-linear-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                            📚 Bibliothèque
                        </h1>
                        <p className="text-xs text-slate-400">{books.length} livres disponibles</p>
                    </div>
                    <div className="flex gap-2">
                        {isLoggedIn && (
                            <>
                                <Button size="sm" variant={showHistory ? 'default' : 'ghost'}
                                    className={`h-9 ${showHistory ? 'bg-emerald-600' : 'text-slate-400 hover:text-white'}`}
                                    onClick={() => { setShowHistory(!showHistory); setShowFavorites(false); }}>
                                    <History className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant={showFavorites ? 'default' : 'ghost'}
                                    className={`h-9 ${showFavorites ? 'bg-red-600' : 'text-slate-400 hover:text-white'}`}
                                    onClick={() => { setShowFavorites(!showFavorites); setShowHistory(false); }}>
                                    <Heart className={`h-4 w-4 ${showFavorites ? 'fill-white' : ''}`} />
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                {/* Search */}
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <Input placeholder="Rechercher un livre ou un auteur..." value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 h-10" />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                            <X className="h-4 w-4 text-slate-500 hover:text-white" />
                        </button>
                    )}
                </div>

                {/* Categories */}
                <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
                    {CATEGORIES.map(cat => (
                        <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${selectedCategory === cat.id
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                                : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
                            {cat.icon} {cat.label}
                        </button>
                    ))}
                </div>

                {/* Reading History (login required) */}
                {showHistory && isLoggedIn && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-6">
                        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                            <Clock className="h-4 w-4 text-emerald-400" /> Historique de lecture
                        </h3>
                        {readHistory.length === 0 ? (
                            <p className="text-xs text-slate-500 text-center py-4">Aucun livre lu récemment</p>
                        ) : (
                            <div className="space-y-2">
                                {readHistory.map(entry => {
                                    const book = books.find(b => b.id === entry.book_id);
                                    if (!book) return null;
                                    return (
                                        <Card key={entry.book_id} className="bg-white/5 border-white/10 cursor-pointer hover:border-emerald-500/30 transition-all"
                                            onClick={() => setSelectedBook(book)}>
                                            <CardContent className="p-3 flex items-center gap-3">
                                                <div className="w-10 h-14 rounded overflow-hidden shrink-0">
                                                    {book.cover_url ? <img src={book.cover_url} alt="" className="w-full h-full object-cover" />
                                                        : <BookCover title={book.title} category={book.category} />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-medium text-white truncate">{book.title}</p>
                                                    <p className="text-[10px] text-slate-400">{book.author}</p>
                                                    <p className="text-[10px] text-emerald-400">
                                                        Lu le {new Date(entry.last_read_at).toLocaleDateString('fr-FR')}
                                                    </p>
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-slate-500" />
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                    </motion.div>
                )}

                {/* Books Grid */}
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-emerald-400 mb-3" />
                        <p className="text-sm text-slate-400">Chargement de la bibliothèque...</p>
                    </div>
                ) : filteredBooks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16">
                        <BookOpen className="h-12 w-12 text-slate-600 mb-3" />
                        <p className="text-sm text-slate-400">
                            {showFavorites ? 'Aucun favori' : 'Aucun livre trouvé'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-3">
                        {filteredBooks.map(book => {
                            const isFav = favorites.has(book.id);

                            return (
                                <motion.div key={book.id} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                    onClick={() => setSelectedBook(book)} className="cursor-pointer">
                                    <div className="relative">
                                        <div className="w-full aspect-[2/3] rounded-xl overflow-hidden shadow-lg mb-2">
                                            {book.cover_url ? (
                                                <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" />
                                            ) : (
                                                <BookCover title={book.title} category={book.category} />
                                            )}
                                        </div>
                                        {isFav && (
                                            <div className="absolute top-1.5 right-1.5 bg-red-500/90 rounded-full p-1">
                                                <Heart className="h-2.5 w-2.5 text-white fill-white" />
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-[11px] font-medium text-white truncate">{book.title}</p>
                                    <p className="text-[9px] text-slate-400 truncate">{book.author}</p>
                                    <div className="flex items-center gap-1 mt-0.5">
                                        {Number(book.avg_rating) > 0 && (
                                            <>
                                                <Star className="h-2.5 w-2.5 text-amber-400 fill-amber-400" />
                                                <span className="text-[9px] text-amber-400">{Number(book.avg_rating).toFixed(1)}</span>
                                            </>
                                        )}
                                        {book.download_count > 0 && (
                                            <span className="text-[9px] text-slate-500 ml-1">
                                                <Download className="h-2 w-2 inline" /> {book.download_count}
                                            </span>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Auth Gate Modal */}
            <AnimatePresence>
                {showAuthGate && <AuthGate onClose={() => setShowAuthGate(false)} />}
            </AnimatePresence>
        </div>
    );
}
