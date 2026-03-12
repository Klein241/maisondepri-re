'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BookOpen, Star, Download, Heart, Search, ArrowLeft,
    Clock, Eye, ChevronRight, Loader2, BookMarked, History,
    Filter, X, StarHalf
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

// ==========================================
// Google Drive Integration (invisible to user)
// ==========================================
const DRIVE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY || '';
const DRIVE_FOLDER_ID = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_ID || '';

interface Book {
    id: string;
    title: string;
    author: string;
    coverUrl: string;
    category: string;
    fileId: string; // Google Drive file ID
    fileSize: string;
    pages?: number;
    rating: number;
    ratingCount: number;
    description: string;
    addedAt: string;
}

interface ReadingProgress {
    bookId: string;
    currentPage: number;
    totalPages: number;
    lastReadAt: string;
    completed: boolean;
}

// Categories for filtering
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

// Local storage keys
const FAVORITES_KEY = 'library_favorites';
const RATINGS_KEY = 'library_ratings';
const HISTORY_KEY = 'library_history';

function getLocalData<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined') return fallback;
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : fallback;
    } catch { return fallback; }
}

function setLocalData(key: string, data: any) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(data));
}

// Detect category from filename
function detectCategory(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('bible') || lower.includes('étude') || lower.includes('study')) return 'bible-study';
    if (lower.includes('prière') || lower.includes('prayer') || lower.includes('intercession')) return 'prayer';
    if (lower.includes('théolog') || lower.includes('theolog') || lower.includes('doctrine')) return 'theology';
    if (lower.includes('dévotion') || lower.includes('devotion') || lower.includes('méditation')) return 'devotional';
    if (lower.includes('biograph') || lower.includes('témoignage') || lower.includes('testimony')) return 'biography';
    if (lower.includes('jeune') || lower.includes('youth') || lower.includes('enfant')) return 'youth';
    if (lower.includes('louange') || lower.includes('worship') || lower.includes('adoration')) return 'worship';
    return 'other';
}

// Extract author from filename pattern "Author - Title.pdf"
function extractAuthorTitle(filename: string): { author: string; title: string } {
    const name = filename.replace(/\.(pdf|epub|doc|docx|txt)$/i, '');
    if (name.includes(' - ')) {
        const parts = name.split(' - ');
        return { author: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
    }
    if (name.includes('_')) {
        return { author: 'Auteur inconnu', title: name.replace(/_/g, ' ').trim() };
    }
    return { author: 'Auteur inconnu', title: name.trim() };
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
                    onClick={() => onChange?.(s)}
                    disabled={!onChange}
                    className={`transition-colors ${onChange ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
                >
                    <Star className={`${sizeClass} ${s <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}`} />
                </button>
            ))}
        </div>
    );
}

// Book cover placeholder with gradient
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
    const [books, setBooks] = useState<Book[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedBook, setSelectedBook] = useState<Book | null>(null);
    const [showFavorites, setShowFavorites] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [favorites, setFavorites] = useState<string[]>([]);
    const [ratings, setRatings] = useState<Record<string, number>>({});
    const [readHistory, setReadHistory] = useState<ReadingProgress[]>([]);
    const [isReading, setIsReading] = useState(false);
    const [readingUrl, setReadingUrl] = useState('');

    // Load local data
    useEffect(() => {
        setFavorites(getLocalData<string[]>(FAVORITES_KEY, []));
        setRatings(getLocalData<Record<string, number>>(RATINGS_KEY, {}));
        setReadHistory(getLocalData<ReadingProgress[]>(HISTORY_KEY, []));
    }, []);

    // Load books from Google Drive
    useEffect(() => {
        loadBooks();
    }, []);

    const loadBooks = async () => {
        setIsLoading(true);
        try {
            if (!DRIVE_API_KEY || !DRIVE_FOLDER_ID) {
                // Demo books if no API key configured
                setBooks(getDemoBooks());
                setIsLoading(false);
                return;
            }

            // Fetch files from Google Drive folder
            let allFiles: any[] = [];
            let pageToken = '';

            do {
                const url = `https://www.googleapis.com/drive/v3/files?q='${DRIVE_FOLDER_ID}'+in+parents+and+trashed=false&fields=files(id,name,size,createdTime,mimeType,thumbnailLink,webContentLink)&key=${DRIVE_API_KEY}&pageSize=100${pageToken ? `&pageToken=${pageToken}` : ''}`;
                const res = await fetch(url);
                const data = await res.json();

                if (data.files) {
                    allFiles = [...allFiles, ...data.files];
                }
                pageToken = data.nextPageToken || '';
            } while (pageToken);

            const mapped: Book[] = allFiles
                .filter((f: any) => /\.(pdf|epub|doc|docx|txt)$/i.test(f.name))
                .map((f: any) => {
                    const { author, title } = extractAuthorTitle(f.name);
                    const category = detectCategory(f.name);
                    const sizeBytes = parseInt(f.size || '0');
                    const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(1);

                    return {
                        id: f.id,
                        title,
                        author,
                        coverUrl: f.thumbnailLink || '',
                        category,
                        fileId: f.id,
                        fileSize: `${sizeMB} MB`,
                        rating: 0,
                        ratingCount: 0,
                        description: '',
                        addedAt: f.createdTime || new Date().toISOString(),
                    };
                });

            setBooks(mapped);
        } catch (e) {
            console.error('Error loading books:', e);
            setBooks(getDemoBooks());
        }
        setIsLoading(false);
    };

    const toggleFavorite = useCallback((bookId: string) => {
        setFavorites(prev => {
            const next = prev.includes(bookId) ? prev.filter(id => id !== bookId) : [...prev, bookId];
            setLocalData(FAVORITES_KEY, next);
            return next;
        });
    }, []);

    const setBookRating = useCallback((bookId: string, rating: number) => {
        setRatings(prev => {
            const next = { ...prev, [bookId]: rating };
            setLocalData(RATINGS_KEY, next);
            return next;
        });
        toast.success(`Note ${rating}/5 enregistrée ⭐`);
    }, []);

    const openBook = useCallback((book: Book) => {
        // Add to reading history
        const entry: ReadingProgress = {
            bookId: book.id,
            currentPage: 1,
            totalPages: book.pages || 100,
            lastReadAt: new Date().toISOString(),
            completed: false,
        };
        setReadHistory(prev => {
            const filtered = prev.filter(h => h.bookId !== book.id);
            const next = [entry, ...filtered];
            setLocalData(HISTORY_KEY, next);
            return next;
        });

        // Open in embedded reader or Google Drive viewer
        if (DRIVE_API_KEY) {
            setReadingUrl(`https://drive.google.com/file/d/${book.fileId}/preview`);
            setIsReading(true);
        } else {
            toast.info('Lecture en mode démo');
        }
    }, []);

    const downloadBook = useCallback((book: Book) => {
        if (DRIVE_API_KEY) {
            window.open(`https://drive.google.com/uc?export=download&id=${book.fileId}`, '_blank');
            toast.success('Téléchargement lancé 📥');
        } else {
            toast.info('Téléchargement disponible après configuration');
        }
    }, []);

    // Filter books
    const filteredBooks = books.filter(book => {
        const matchesSearch = !searchQuery ||
            book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            book.author.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || book.category === selectedCategory;
        const matchesFavorites = !showFavorites || favorites.includes(book.id);
        return matchesSearch && matchesCategory && matchesFavorites;
    });

    // Reading view
    if (isReading && readingUrl) {
        return (
            <div className="fixed inset-0 z-50 bg-black">
                <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-3 bg-linear-to-b from-black/80 to-transparent">
                    <Button
                        size="sm"
                        variant="ghost"
                        className="text-white hover:bg-white/10"
                        onClick={() => { setIsReading(false); setReadingUrl(''); }}
                    >
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Retour
                    </Button>
                </div>
                <iframe src={readingUrl} className="w-full h-full border-none" allow="autoplay" />
            </div>
        );
    }

    // Book detail view
    if (selectedBook) {
        const userRating = ratings[selectedBook.id] || 0;
        const historyEntry = readHistory.find(h => h.bookId === selectedBook.id);
        const isFav = favorites.includes(selectedBook.id);

        return (
            <div className="relative min-h-screen bg-linear-to-b from-[#0B0E14] to-[#0F1219] text-white pb-24 overflow-y-auto">
                <div className="relative z-10 max-w-lg mx-auto w-full px-4 pt-4">
                    <Button
                        size="sm"
                        variant="ghost"
                        className="text-slate-400 hover:text-white mb-4"
                        onClick={() => setSelectedBook(null)}
                    >
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Bibliothèque
                    </Button>

                    <div className="flex gap-4 mb-6">
                        <div className="w-32 h-44 rounded-xl overflow-hidden shadow-2xl shrink-0">
                            {selectedBook.coverUrl ? (
                                <img src={selectedBook.coverUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <BookCover title={selectedBook.title} category={selectedBook.category} />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-lg font-bold text-white mb-1">{selectedBook.title}</h2>
                            <p className="text-sm text-slate-400 mb-2">{selectedBook.author}</p>
                            <Badge className="bg-primary/20 text-primary border-none text-[10px] mb-3">
                                {CATEGORIES.find(c => c.id === selectedBook.category)?.icon} {CATEGORIES.find(c => c.id === selectedBook.category)?.label}
                            </Badge>
                            <p className="text-xs text-slate-500 mb-2">{selectedBook.fileSize}</p>

                            <div className="mb-3">
                                <p className="text-[10px] text-slate-500 mb-1">Votre note</p>
                                <StarRating rating={userRating} onChange={(r) => setBookRating(selectedBook.id, r)} size="lg" />
                            </div>
                        </div>
                    </div>

                    {historyEntry && (
                        <Card className="bg-white/5 border-white/10 mb-4">
                            <CardContent className="p-3 flex items-center gap-3">
                                <Clock className="h-4 w-4 text-slate-400" />
                                <div className="flex-1">
                                    <p className="text-xs text-white">Dernière lecture</p>
                                    <p className="text-[10px] text-slate-400">
                                        {new Date(historyEntry.lastReadAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <div className="flex gap-3 mb-6">
                        <Button
                            className="flex-1 bg-linear-to-r from-primary to-purple-600 text-white shadow-lg shadow-primary/30"
                            onClick={() => openBook(selectedBook)}
                        >
                            <Eye className="h-4 w-4 mr-2" />
                            Lire
                        </Button>
                        <Button
                            variant="outline"
                            className="border-white/10 text-white hover:bg-white/5"
                            onClick={() => downloadBook(selectedBook)}
                        >
                            <Download className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            className={`border-white/10 ${isFav ? 'text-red-400 border-red-400/30' : 'text-white'} hover:bg-white/5`}
                            onClick={() => toggleFavorite(selectedBook.id)}
                        >
                            <Heart className={`h-4 w-4 ${isFav ? 'fill-red-400' : ''}`} />
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
                        <Button
                            size="sm"
                            variant={showHistory ? 'default' : 'ghost'}
                            className={`h-9 ${showHistory ? 'bg-emerald-600' : 'text-slate-400 hover:text-white'}`}
                            onClick={() => { setShowHistory(!showHistory); setShowFavorites(false); }}
                        >
                            <History className="h-4 w-4" />
                        </Button>
                        <Button
                            size="sm"
                            variant={showFavorites ? 'default' : 'ghost'}
                            className={`h-9 ${showFavorites ? 'bg-red-600' : 'text-slate-400 hover:text-white'}`}
                            onClick={() => { setShowFavorites(!showFavorites); setShowHistory(false); }}
                        >
                            <Heart className={`h-4 w-4 ${showFavorites ? 'fill-white' : ''}`} />
                        </Button>
                    </div>
                </div>

                {/* Search */}
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <Input
                        placeholder="Rechercher un livre ou un auteur..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 h-10"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                            <X className="h-4 w-4 text-slate-500 hover:text-white" />
                        </button>
                    )}
                </div>

                {/* Categories */}
                <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${selectedCategory === cat.id
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                                : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                }`}
                        >
                            {cat.icon} {cat.label}
                        </button>
                    ))}
                </div>

                {/* Reading History Section */}
                {showHistory && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mb-6"
                    >
                        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                            <Clock className="h-4 w-4 text-emerald-400" />
                            Historique de lecture
                        </h3>
                        {readHistory.length === 0 ? (
                            <p className="text-xs text-slate-500 text-center py-4">Aucun livre lu récemment</p>
                        ) : (
                            <div className="space-y-2">
                                {readHistory.slice(0, 10).map(entry => {
                                    const book = books.find(b => b.id === entry.bookId);
                                    if (!book) return null;
                                    return (
                                        <Card
                                            key={entry.bookId}
                                            className="bg-white/5 border-white/10 cursor-pointer hover:border-emerald-500/30 transition-all"
                                            onClick={() => setSelectedBook(book)}
                                        >
                                            <CardContent className="p-3 flex items-center gap-3">
                                                <div className="w-10 h-14 rounded overflow-hidden shrink-0">
                                                    <BookCover title={book.title} category={book.category} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-medium text-white truncate">{book.title}</p>
                                                    <p className="text-[10px] text-slate-400">{book.author}</p>
                                                    <p className="text-[10px] text-emerald-400">
                                                        Lu le {new Date(entry.lastReadAt).toLocaleDateString('fr-FR')}
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
                        <p className="text-sm text-slate-400">Aucun livre trouvé</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-3">
                        {filteredBooks.map(book => {
                            const isFav = favorites.includes(book.id);
                            const userRating = ratings[book.id] || 0;

                            return (
                                <motion.div
                                    key={book.id}
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => setSelectedBook(book)}
                                    className="cursor-pointer"
                                >
                                    <div className="relative">
                                        <div className="w-full aspect-[2/3] rounded-xl overflow-hidden shadow-lg mb-2">
                                            {book.coverUrl ? (
                                                <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
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
                                    {userRating > 0 && (
                                        <StarRating rating={userRating} size="sm" />
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

// Demo books for testing without Google Drive API
function getDemoBooks(): Book[] {
    return [
        { id: 'd1', title: "La puissance de la prière", author: "E.M. Bounds", coverUrl: '', category: 'prayer', fileId: '', fileSize: '2.3 MB', rating: 4.5, ratingCount: 128, description: 'Un classique sur la prière', addedAt: '2024-01-15' },
        { id: 'd2', title: "Le combat spirituel", author: "John Bunyan", coverUrl: '', category: 'theology', fileId: '', fileSize: '3.1 MB', rating: 4.8, ratingCount: 256, description: "Un guide pour le combat spirituel", addedAt: '2024-01-20' },
        { id: 'd3', title: "Ils ont marché avec Dieu", author: "Watchman Nee", coverUrl: '', category: 'biography', fileId: '', fileSize: '1.8 MB', rating: 4.2, ratingCount: 89, description: "Témoignages de foi", addedAt: '2024-02-01' },
        { id: 'd4', title: "30 jours de louange", author: "Ruth Myers", coverUrl: '', category: 'devotional', fileId: '', fileSize: '1.2 MB', rating: 4.6, ratingCount: 167, description: "Dévotionnel quotidien", addedAt: '2024-02-10' },
        { id: 'd5', title: "Comprendre la Bible", author: "John Stott", coverUrl: '', category: 'bible-study', fileId: '', fileSize: '4.5 MB', rating: 4.9, ratingCount: 312, description: "Guide d'étude biblique", addedAt: '2024-02-15' },
        { id: 'd6', title: "La vie chrétienne normale", author: "Watchman Nee", coverUrl: '', category: 'theology', fileId: '', fileSize: '2.7 MB', rating: 4.7, ratingCount: 234, description: "Comprendre la vie en Christ", addedAt: '2024-03-01' },
        { id: 'd7', title: "Adorons le Roi", author: "Jack Hayford", coverUrl: '', category: 'worship', fileId: '', fileSize: '1.9 MB', rating: 4.3, ratingCount: 76, description: "Guide de louange", addedAt: '2024-03-05' },
        { id: 'd8', title: "Histoires bibliques pour enfants", author: "Catherine Vos", coverUrl: '', category: 'youth', fileId: '', fileSize: '5.2 MB', rating: 4.4, ratingCount: 145, description: "Pour les jeunes", addedAt: '2024-03-10' },
        { id: 'd9', title: "Méditations du matin", author: "Charles Spurgeon", coverUrl: '', category: 'devotional', fileId: '', fileSize: '3.8 MB', rating: 4.8, ratingCount: 289, description: "Dévotionnel du matin", addedAt: '2024-03-15' },
        { id: 'd10', title: "L'intercesseur", author: "Rees Howells", coverUrl: '', category: 'prayer', fileId: '', fileSize: '2.1 MB', rating: 4.6, ratingCount: 198, description: "Biographie d'un intercesseur", addedAt: '2024-03-20' },
        { id: 'd11', title: "Le Dieu qui exauce", author: "George Müller", coverUrl: '', category: 'biography', fileId: '', fileSize: '2.9 MB', rating: 4.9, ratingCount: 356, description: "Autobiographie et témoignage", addedAt: '2024-03-25' },
        { id: 'd12', title: "Fondements de la foi", author: "R.C. Sproul", coverUrl: '', category: 'theology', fileId: '', fileSize: '3.4 MB', rating: 4.5, ratingCount: 203, description: "Doctrines essentielles", addedAt: '2024-04-01' },
    ];
}
