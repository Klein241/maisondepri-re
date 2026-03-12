'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BookOpen, Star, Download, Heart, Search, ArrowLeft,
    Clock, Eye, ChevronRight, Loader2, BookMarked, History,
    X, Share2
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

export function LibraryView() {
    const { user } = useAppStore();
    const [books, setBooks] = useState<Book[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedBook, setSelectedBook] = useState<Book | null>(null);
    const [showFavorites, setShowFavorites] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    // Supabase-backed user data
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [ratings, setRatings] = useState<Record<string, number>>({});
    const [readHistory, setReadHistory] = useState<any[]>([]);

    // Reading state
    const [isReading, setIsReading] = useState(false);
    const [readingUrl, setReadingUrl] = useState('');

    // Load books from Supabase
    useEffect(() => {
        loadBooks();
        if (user?.id) {
            loadUserFavorites();
            loadUserRatings();
            loadReadingHistory();
        }
    }, [user?.id]);

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
        if (!user?.id) { toast.error("Connectez-vous pour ajouter aux favoris"); return; }

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
        if (!user?.id) { toast.error("Connectez-vous pour noter"); return; }

        setRatings(prev => ({ ...prev, [bookId]: rating }));

        try {
            const { error } = await supabase.from('library_ratings')
                .upsert({ book_id: bookId, user_id: user.id, rating, updated_at: new Date().toISOString() },
                    { onConflict: 'book_id,user_id' });
            if (error) throw error;
            toast.success(`Note ${rating}/5 enregistrée ⭐`);
            // Refresh books to get updated avg
            loadBooks();
        } catch (e: any) {
            toast.error("Erreur: " + e.message);
        }
    }, [user?.id]);

    const openBook = useCallback(async (book: Book) => {
        // Track in reading history
        if (user?.id) {
            try {
                await supabase.from('library_reading_history')
                    .upsert({
                        book_id: book.id,
                        user_id: user.id,
                        total_pages: book.page_count || 0,
                        last_read_at: new Date().toISOString(),
                    }, { onConflict: 'book_id,user_id' });
            } catch (e) { /* ignore */ }
        }

        if (book.file_url) {
            // For PDFs: use embedded viewer
            if (book.file_type === 'pdf') {
                setReadingUrl(book.file_url);
            } else {
                // For other types, open in new tab
                window.open(book.file_url, '_blank');
                return;
            }
            setIsReading(true);
        } else {
            toast.info("Fichier non disponible");
        }
    }, [user?.id]);

    const downloadBook = useCallback(async (book: Book) => {
        if (book.file_url) {
            // Track download count
            try {
                await supabase.from('library_books')
                    .update({ download_count: (book.download_count || 0) + 1 })
                    .eq('id', book.id);
            } catch (e) { /* ignore */ }

            window.open(book.file_url, '_blank');
            toast.success('Téléchargement lancé 📥');
        }
    }, []);

    const shareBook = useCallback(async (book: Book) => {
        const shareText = `📚 ${book.title}\npar ${book.author}\n\nDécouvrez ce livre sur Maison de Prière !`;
        const shareUrl = typeof window !== 'undefined' ? window.location.origin : '';

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

    // Filter books
    const filteredBooks = books.filter(book => {
        const matchesSearch = !searchQuery ||
            book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            book.author.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || book.category === selectedCategory;
        const matchesFavorites = !showFavorites || favorites.has(book.id);
        return matchesSearch && matchesCategory && matchesFavorites;
    });

    // Reading view
    if (isReading && readingUrl) {
        return (
            <div className="fixed inset-0 z-50 bg-black">
                <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-3 bg-linear-to-b from-black/80 to-transparent">
                    <Button size="sm" variant="ghost" className="text-white hover:bg-white/10"
                        onClick={() => { setIsReading(false); setReadingUrl(''); }}>
                        <ArrowLeft className="h-4 w-4 mr-1" /> Retour
                    </Button>
                </div>
                <iframe src={readingUrl} className="w-full h-full border-none" allow="autoplay" />
            </div>
        );
    }

    // Book detail view
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
                            {selectedBook.file_size > 0 && (
                                <p className="text-xs text-slate-500 mb-1">{formatSize(selectedBook.file_size)}</p>
                            )}
                            {/* Average rating */}
                            <div className="flex items-center gap-1.5 mb-2">
                                <StarRating rating={Math.round(Number(selectedBook.avg_rating))} size="sm" />
                                <span className="text-xs text-slate-400">
                                    {Number(selectedBook.avg_rating).toFixed(1)} ({selectedBook.rating_count} avis)
                                </span>
                            </div>
                            {/* Your rating */}
                            <div>
                                <p className="text-[10px] text-slate-500 mb-1">Votre note</p>
                                <StarRating rating={userRating} onChange={(r) => setBookRating(selectedBook.id, r)} size="lg" />
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

                    <div className="flex gap-3 mb-6">
                        <Button className="flex-1 bg-linear-to-r from-primary to-purple-600 text-white shadow-lg shadow-primary/30"
                            onClick={() => openBook(selectedBook)}>
                            <Eye className="h-4 w-4 mr-2" /> Lire
                        </Button>
                        <Button variant="outline" className="border-white/10 text-white hover:bg-white/5"
                            onClick={() => downloadBook(selectedBook)}>
                            <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="outline"
                            className={`border-white/10 ${isFav ? 'text-red-400 border-red-400/30' : 'text-white'} hover:bg-white/5`}
                            onClick={() => toggleFavorite(selectedBook.id)}>
                            <Heart className={`h-4 w-4 ${isFav ? 'fill-red-400' : ''}`} />
                        </Button>
                        <Button variant="outline" className="border-white/10 text-white hover:bg-white/5"
                            onClick={() => shareBook(selectedBook)}>
                            <Share2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // Main library view
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

                {/* Reading History */}
                {showHistory && (
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
                            const userRating = ratings[book.id] || 0;

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
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
