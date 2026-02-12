"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { bibleApi, BibleBook, TRANSLATIONS as BIBLES, DEFAULT_TRANSLATION as DEFAULT_BIBLE_ID, BibleVerse, BiblePassage } from "@/lib/unified-bible-api"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Loader2, ArrowLeft, Book, ChevronRight, Languages,
    Bookmark, Share2, ZoomIn, ZoomOut, Search, Copy,
    Check, Star, Settings, Columns, Volume2, Maximize2,
    Download, Trash2, MoreVertical, Play, Pause, X, Palette,
    Type, PenLine, MessageSquare, Menu, BookOpen, Sparkles,
    Heart, ChevronDown, ListFilter, Grid3X3, Home, Gamepad2, Users
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAppStore } from "@/lib/store"
import parse, { domToReact, Element } from 'html-react-parser';
import { BibleSearch } from "./bible-search";
import { BibleQuiz } from "../games/bible-quiz";
import { BibleMemoryGame } from "../games/bible-memory-game";
import { MultiplayerManager } from "../games/multiplayer-manager";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WordSearchGame } from "../games/word-search-game";
import { ChronoGame } from "../games/chrono-game";
import { WhoAmIGame } from "../games/who-am-i-game";
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import { motion, AnimatePresence } from "framer-motion"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Separator } from "@/components/ui/separator"

// --- TYPES ---
// --- TYPES ---
type BibleViewState = 'home' | 'read' | 'study' | 'search' | 'favorites' | 'games';

// Book categories for easier navigation
const OLD_TESTAMENT = ['GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA', '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH', 'EST', 'JOB', 'PSA', 'PRO', 'ECC', 'SNG', 'ISA', 'JER', 'LAM', 'EZK', 'DAN', 'HOS', 'JOL', 'AMO', 'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL'];
const NEW_TESTAMENT = ['MAT', 'MRK', 'LUK', 'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL', 'EPH', 'PHP', 'COL', '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM', 'HEB', 'JAS', '1PE', '2PE', '1JN', '2JN', '3JN', 'JUD', 'REV'];

import { useBibleFavorites, useBibleHighlights, shareVerse, copyVerse, HIGHLIGHT_COLORS, HighlightColor } from "@/lib/bible-features";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";


export function BibleView() {
    const {
        bibleNavigation, setBibleNavigation,
        bibleViewTarget, setBibleViewTarget,
        downloadedBibles, toggleDownloadBible,
        bibleSettings, setBibleSettings,
        dailyVerse, setDailyVerse,
        currentDay,
        appSettings,
        setActiveTab,
        user // Assume user is available in store or check supabase directly
    } = useAppStore();

    // Features Hooks
    const { favorites, addFavorite, removeFavorite, isFavorite } = useBibleFavorites(user?.id);
    const { highlights, addHighlight, removeHighlight, getHighlight } = useBibleHighlights(user?.id);


    // UI State
    const [viewState, setViewState] = useState<BibleViewState>('home')
    const [currentBibleId, setCurrentBibleId] = useState<string>(DEFAULT_BIBLE_ID)
    const [books, setBooks] = useState<BibleBook[]>([])
    const [chapters, setChapters] = useState<number[]>([])
    const [activeBook, setActiveBook] = useState<BibleBook | null>(null)
    const [activeChapterNum, setActiveChapterNum] = useState<string>("1")
    const [content, setContent] = useState<string>("")
    const [parallelContent, setParallelContent] = useState<string>("")
    const [loading, setLoading] = useState(false)
    const [showSelector, setShowSelector] = useState(false)
    const [selectedVerses, setSelectedVerses] = useState<string[]>([])
    const [fontSize, setFontSize] = useState(18)
    const [audioUrl, setAudioUrl] = useState<string | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [sharingVerse, setSharingVerse] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [searchResults, setSearchResults] = useState<any[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [verseOfDay, setVerseOfDay] = useState<any>(null)
    const [showBookFilter, setShowBookFilter] = useState<'all' | 'ot' | 'nt'>('all')
    const [recentChapters, setRecentChapters] = useState<{ bookId: string, bookName: string, chapter: string }[]>([])
    const [activeGame, setActiveGame] = useState<string | null>(null)

    const audioRef = useRef<HTMLAudioElement>(null)

    // Initialization
    useEffect(() => {
        loadInitialData();
        loadVerseOfDay();
    }, [currentBibleId]);

    useEffect(() => {
        if (bibleNavigation) {
            handleNavigation(bibleNavigation.bookId, bibleNavigation.chapterId);
            setBibleNavigation(null);
            setViewState('read');
        }
    }, [bibleNavigation]);

    useEffect(() => {
        if (bibleViewTarget) {
            setViewState(bibleViewTarget);
            setBibleViewTarget(null);
        }
    }, [bibleViewTarget]);

    const loadVerseOfDay = async () => {
        try {
            const verse = await bibleApi.getVerseOfTheDay(currentBibleId);
            if (verse) {
                setVerseOfDay({
                    reference: verse.reference,
                    content: verse.text.substring(0, 500)
                });
            }
        } catch (e) {
            console.log('Could not load verse of day');
        }
    };

    const loadChapters = async (bid: string, bookId: string) => {
        // The new API doesn't need bible ID for chapters, but we accept it for compatibility
        const c = bibleApi.getChapters(bookId);
        setChapters(c);
        return c;
    };

    const loadChapterContent = async (bid: string, cid: string, isParallel: boolean = false) => {
        try {
            const [bookId, chapterNum] = cid.includes('.') ? cid.split('.') : [activeBook?.id || 'GEN', cid];
            console.log(`[BibleView] Loading chapter: bookId=${bookId}, chapter=${chapterNum}, translation=${bid}`);
            const data = await bibleApi.getChapterContent(bookId, parseInt(chapterNum), bid);

            if (data && data.verses && data.verses.length > 0) {
                console.log(`[BibleView] Loaded ${data.verses.length} verses for ${bookId} ${chapterNum}`);
                // Generate HTML from verses for the view
                let html = '';
                data.verses.forEach((v, index) => {
                    // Use verse number from object or fallback to index+1
                    const verseNum = v.verse || (index + 1);
                    html += `<p><span data-id="${verseNum}" class="v">${verseNum}</span>${v.text}</p>`;
                });

                if (isParallel) setParallelContent(html);
                else setContent(html);
            } else {
                console.warn(`[BibleView] No verses returned for ${bookId} ${chapterNum}. Data:`, data);
                // Fallback when API returns no verses
                if (isParallel) setParallelContent("<p>Contenu non disponible.</p>");
                else setContent("<p>Contenu non disponible. Veuillez sélectionner un livre et un chapitre.</p>");
            }
        } catch (e) {
            console.error("[BibleView] Error loading content:", e);
            if (isParallel) setParallelContent("<p>Erreur de chargement.</p>");
            else setContent("<p>Erreur de chargement. Vérifiez votre connexion.</p>");
        }
    };

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const b = bibleApi.getBooks(); // No argument needed for new API
            setBooks(b);
        } catch (e) {
            console.error('Error loading books:', e);
            toast.error("Erreur de chargement de la Bible. Vérifiez votre connexion.");
        }
        setLoading(false);
    };

    const handleNavigation = async (bookId: string, chapterId: string) => {
        setLoading(true);
        try {
            const book = books.find(b => b.id === bookId) || books[0];
            setActiveBook(book);

            // Fix crash: handle cases where chapterId format might vary
            let chapterNum = "1";
            if (chapterId && chapterId.includes('.')) {
                chapterNum = chapterId.split('.')[1];
            } else if (chapterId) {
                chapterNum = chapterId;
            } else {
                chapterNum = "1";
            }

            setActiveChapterNum(chapterNum);
            // Ensure we use the correct format for loading content
            const loadId = chapterId.includes('.') ? chapterId : `${bookId}.${chapterNum}`;
            await loadChapterContent(currentBibleId, loadId);

            // Add to recent chapters
            setRecentChapters(prev => {
                const newRecent = [{ bookId, bookName: book?.name || bookId, chapter: chapterNum }, ...prev.filter(r => r.bookId !== bookId || r.chapter !== chapterNum)].slice(0, 5);
                return newRecent;
            });

            if (bibleSettings.splitView && bibleSettings.parallelBibleId) {
                await loadChapterContent(bibleSettings.parallelBibleId, chapterId, true);
            }
            setViewState('read');
        } catch (e) {
            console.error('Error loading chapter:', e);
            toast.error("Erreur de chargement du chapitre");
        }
        setLoading(false);
    };

    const handleBibleChange = async (bid: string) => {
        setCurrentBibleId(bid);
        if (activeBook) {
            const cid = `${activeBook.id}.${activeChapterNum}`;
            await loadChapterContent(bid, cid);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        try {
            const results = await bibleApi.searchBible(searchQuery, currentBibleId);
            setSearchResults(results);
        } catch (e) {
            toast.error("Erreur de recherche");
        }
        setIsSearching(false);
    };

    const copyVerse = (text: string, ref: string) => {
        navigator.clipboard.writeText(`"${text}" - ${ref}`);
        toast.success("Verset copié !");
    };

    const filteredBooks = books.filter(b => {
        if (showBookFilter === 'all') return true;
        if (showBookFilter === 'ot') return OLD_TESTAMENT.includes(b.id);
        if (showBookFilter === 'nt') return NEW_TESTAMENT.includes(b.id);
        return true;
    });

    const transformContent = (htmlString: string, bid: string) => {
        const options: any = {
            replace: (domNode: any) => {
                if (domNode.type === 'tag' && domNode.name === 'span') {
                    const className = domNode.attribs.class;
                    // Identify verse numbers and content based on common Bible API structures
                    // Often verses are in spans with class 'v' or similar attributes
                    // Let's assume standard structure or the one we inspected earlier
                    if (className?.includes('v') || domNode.attribs['data-v']) {
                        const verseId = domNode.attribs['data-v'] || domNode.attribs['data-id'];
                        // Construct a readable reference (e.g., "Jean 3:16")
                        const ref = `${activeBook?.name} ${activeChapterNum}:${verseId}`;
                        const isFav = isFavorite(ref);
                        const highlight = getHighlight(ref);

                        return (
                            <Popover>
                                <PopoverTrigger asChild>
                                    <span
                                        className={cn(
                                            "cursor-pointer hover:bg-white/5 rounded px-0.5 transition-colors relative",
                                            highlight ? HIGHLIGHT_COLORS[highlight.color as HighlightColor].bgClass : "",
                                            isFav ? "underline decoration-amber-400/50 decoration-2 underline-offset-4" : ""
                                        )}
                                        onClick={(e) => {
                                            // Optional: prevent default if needed, but trigger should handle it
                                        }}
                                    >
                                        {isFav && <span className="absolute -top-1 -right-1 text-[8px]">⭐</span>}
                                        {domToReact(domNode.children as any, options)}
                                    </span>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-2 bg-[#1A1D24] border-white/10 text-white flex gap-2 rounded-xl z-50">
                                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg hover:bg-white/10"
                                        onClick={() => handleCopy(domNode, ref)}>
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className={cn("h-8 w-8 rounded-lg hover:bg-white/10", isFav ? "text-amber-400" : "")}
                                        onClick={() => handleFavorite(domNode, ref)}>
                                        <Star className={cn("h-4 w-4", isFav && "fill-current")} />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg hover:bg-white/10"
                                        onClick={() => handleShare(domNode, ref)}>
                                        <Share2 className="h-4 w-4" />
                                    </Button>
                                    <div className="w-px h-8 bg-white/10 mx-1" />
                                    {Object.entries(HIGHLIGHT_COLORS).map(([color, style]) => (
                                        <button
                                            key={color}
                                            className={cn("w-6 h-6 rounded-full border-2", style.bgClass, style.borderClass)}
                                            onClick={() => handleHighlight(domNode, ref, color as HighlightColor)}
                                        />
                                    ))}
                                </PopoverContent>
                            </Popover>
                        );
                    }
                }
            }
        };
        return parse(htmlString, options);
    };

    // Helper functions for actions
    const getTextContent = (node: any): string => {
        // Very basic extraction, might need refinement based on structure
        // Find the parent <p> tag and extract its text content
        let parentP = node;
        while (parentP && parentP.name !== 'p') {
            parentP = parentP.parent;
        }
        if (parentP && parentP.children) {
            // Filter out the verse number span and join text content
            return parentP.children
                .filter((child: any) => !(child.type === 'tag' && child.name === 'span' && child.attribs?.class?.includes('v')))
                .map((child: any) => child.data || (child.children ? getTextContent({ children: child.children }) : ''))
                .join('')
                .trim();
        }
        return "";
    };

    const handleCopy = (node: any, ref: string) => {
        const text = getTextContent(node);
        copyVerse(text, ref);
    };

    const handleFavorite = (node: any, ref: string) => {
        const text = getTextContent(node);
        if (isFavorite(ref)) {
            const fav = favorites.find(f => f.reference === ref);
            if (fav) removeFavorite(fav.id);
            toast.info("Verset retiré des favoris");
        } else {
            addFavorite(ref, text, currentBibleId);
            toast.success("Verset ajouté aux favoris");
        }
    };

    const handleHighlight = (node: any, ref: string, color: HighlightColor) => {
        const text = getTextContent(node);
        const existing = getHighlight(ref);
        if (existing && existing.color === color) {
            removeHighlight(existing.id);
            toast.info("Surlignage retiré");
        } else {
            addHighlight(ref, text, currentBibleId, color);
            toast.success("Verset surligné");
        }
    };

    const handleShare = (node: any, ref: string) => {
        const text = getTextContent(node);
        shareVerse(ref, text, currentBibleId);
    };


    // Get current bible info
    const currentBible = BIBLES.find(b => b.id === currentBibleId);

    return (
        <div className="flex flex-col h-full bg-gradient-to-b from-[#0B0E14] via-[#0F1219] to-[#0B0E14] text-slate-100 overflow-hidden relative font-sans">

            {/* Ambient Background Effects */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] bg-indigo-600/5 blur-[150px] rounded-full" />
                <div className="absolute bottom-[-20%] left-[-20%] w-[50%] h-[50%] bg-purple-600/5 blur-[150px] rounded-full" />
            </div>

            <div className="relative z-10 max-w-4xl mx-auto w-full flex-1 flex flex-col overflow-hidden">
                <AnimatePresence mode="wait">
                    {/* ========== HOME VIEW ========== */}
                    {viewState === 'home' && (
                        <motion.div
                            key="home"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex-1 overflow-y-auto pb-32"
                        >
                            {/* Hero Header */}
                            <header className="relative px-6 pt-14 pb-8">
                                <div className="flex items-center justify-between mb-8">
                                    <div>
                                        <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-white via-indigo-200 to-purple-200 bg-clip-text text-transparent">
                                            Bible
                                        </h1>
                                        <p className="text-slate-500 text-sm font-medium mt-1">La Parole de Dieu</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="rounded-2xl bg-white/5 border border-white/5"
                                            onClick={() => setViewState('search')}
                                        >
                                            <Search className="h-5 w-5 text-slate-400" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="rounded-2xl bg-white/5 border border-white/5"
                                            onClick={() => setViewState('favorites')}
                                        >
                                            <Star className="h-5 w-5 text-amber-400" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="rounded-2xl bg-white/5 border border-white/5"
                                            onClick={() => setViewState('study')}
                                        >
                                            <Settings className="h-5 w-5 text-slate-400" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Version Selector - Now visible with all translations */}
                                <div className="mb-4">
                                    <p className="text-xs text-slate-500 mb-2 font-medium">Traduction</p>
                                    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                                        {BIBLES.map(b => (
                                            <Button
                                                key={b.id}
                                                variant="ghost"
                                                className={cn(
                                                    "shrink-0 h-10 px-4 rounded-xl text-xs font-bold transition-all border",
                                                    currentBibleId === b.id
                                                        ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/20"
                                                        : "bg-white/5 text-slate-400 border-white/5 hover:bg-white/10"
                                                )}
                                                onClick={() => handleBibleChange(b.id)}
                                            >
                                                <span className="flex items-center gap-1.5">
                                                    {b.language === 'fr' ? '🇫🇷' : '🇬🇧'}
                                                    {b.abbreviation}
                                                </span>
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            </header>

                            {/* Verse of the Day Card */}
                            <section className="px-6 mb-8">
                                <Card className="relative overflow-hidden bg-gradient-to-br from-indigo-600/20 via-purple-600/10 to-transparent border border-white/10 rounded-3xl">
                                    <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
                                    <CardContent className="relative p-6">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Sparkles className="h-4 w-4 text-amber-400" />
                                            <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Verset du Jour</span>
                                        </div>
                                        <p className="font-serif text-lg text-white/90 italic leading-relaxed mb-4">
                                            "{verseOfDay?.content || "L'Éternel est mon berger: je ne manquerai de rien."}"
                                        </p>
                                        <div className="flex items-center justify-between">
                                            <Badge variant="outline" className="border-white/20 text-slate-300 font-medium">
                                                {verseOfDay?.reference || "Psaumes 23:1"}
                                            </Badge>
                                            <div className="flex gap-2">
                                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl bg-white/5">
                                                    <Heart className="h-4 w-4 text-slate-400" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl bg-white/5">
                                                    <Share2 className="h-4 w-4 text-slate-400" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </section>

                            {/* Quick Actions */}
                            <section className="px-6 mb-8">
                                <div className="grid grid-cols-2 gap-3">
                                    <Button
                                        variant="ghost"
                                        className="h-24 rounded-3xl bg-gradient-to-br from-emerald-600/20 to-teal-600/10 border border-white/5 flex flex-col items-start p-5 hover:scale-[1.02] transition-transform"
                                        onClick={() => { if (recentChapters[0]) handleNavigation(recentChapters[0].bookId, `${recentChapters[0].bookId}.${recentChapters[0].chapter}`); else setShowSelector(true); }}
                                    >
                                        <BookOpen className="h-6 w-6 text-emerald-400 mb-2" />
                                        <span className="font-bold text-white text-sm">Continuer</span>
                                        <span className="text-[10px] text-slate-400">{recentChapters[0]?.bookName || 'Commencer'} {recentChapters[0]?.chapter || ''}</span>
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        className="h-24 rounded-3xl bg-gradient-to-br from-purple-600/20 to-pink-600/10 border border-white/5 flex flex-col items-start p-5 hover:scale-[1.02] transition-transform"
                                        onClick={() => setViewState('games')}
                                    >
                                        <Gamepad2 className="h-6 w-6 text-purple-400 mb-2" />
                                        <span className="font-bold text-white text-sm">Jeux Bibliques</span>
                                        <span className="text-[10px] text-slate-400">Quiz & Memory</span>
                                    </Button>
                                </div>
                            </section>

                            {/* Recent Chapters */}
                            {recentChapters.length > 0 && (
                                <section className="px-6 mb-8">
                                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Récemment lu</h3>
                                    <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
                                        {recentChapters.map((rc, i) => (
                                            <Button
                                                key={i}
                                                variant="ghost"
                                                className="shrink-0 h-14 px-5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 flex items-center gap-3"
                                                onClick={() => handleNavigation(rc.bookId, `${rc.bookId}.${rc.chapter}`)}
                                            >
                                                <Book className="h-4 w-4 text-indigo-400" />
                                                <div className="text-left">
                                                    <p className="font-bold text-sm text-white">{rc.bookName}</p>
                                                    <p className="text-[10px] text-slate-500">Chapitre {rc.chapter}</p>
                                                </div>
                                            </Button>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* Book Categories */}
                            <section className="px-6 mb-8">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Explorer</h3>
                                    <div className="flex gap-1 bg-white/5 rounded-xl p-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className={cn("h-8 px-3 rounded-lg text-[10px] font-bold", showBookFilter === 'all' && "bg-white/10")}
                                            onClick={() => setShowBookFilter('all')}
                                        >
                                            Tous
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className={cn("h-8 px-3 rounded-lg text-[10px] font-bold", showBookFilter === 'ot' && "bg-white/10")}
                                            onClick={() => setShowBookFilter('ot')}
                                        >
                                            AT
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className={cn("h-8 px-3 rounded-lg text-[10px] font-bold", showBookFilter === 'nt' && "bg-white/10")}
                                            onClick={() => setShowBookFilter('nt')}
                                        >
                                            NT
                                        </Button>
                                    </div>
                                </div>

                                {loading ? (
                                    <div className="flex justify-center py-12">
                                        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-3 gap-2">
                                        {filteredBooks.slice(0, 12).map(book => (
                                            <Button
                                                key={book.id}
                                                variant="ghost"
                                                className="h-16 rounded-2xl bg-white/5 border border-white/5 hover:bg-indigo-600/20 hover:border-indigo-500/30 flex flex-col items-center justify-center p-2 transition-all"
                                                onClick={() => {
                                                    setActiveBook(book);
                                                    loadChapters(currentBibleId, book.id);
                                                    setShowSelector(true);
                                                }}
                                            >
                                                <span className="font-bold text-xs text-white truncate w-full text-center">{book.abbreviation}</span>
                                                <span className="text-[9px] text-slate-500 truncate w-full text-center">{book.name}</span>
                                            </Button>
                                        ))}
                                    </div>
                                )}

                                <Button
                                    variant="ghost"
                                    className="w-full mt-4 h-12 rounded-2xl bg-white/5 border border-white/5 text-slate-400 hover:bg-white/10"
                                    onClick={() => setShowSelector(true)}
                                >
                                    Voir tous les livres
                                    <ChevronRight className="h-4 w-4 ml-2" />
                                </Button>
                            </section>
                        </motion.div>
                    )}

                    {/* ========== READER VIEW ========== */}
                    {viewState === 'read' && (
                        <motion.div
                            key="reader"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex-1 flex flex-col"
                        >
                            {/* Reader Header */}
                            <header className="flex items-center justify-between px-4 py-3 bg-[#0B0E14]/90 backdrop-blur-md sticky top-0 z-40 border-b border-white/5">
                                <div className="flex items-center gap-3">
                                    <Button variant="ghost" size="icon" className="text-slate-400" onClick={() => setViewState('home')}>
                                        <ArrowLeft className="h-5 w-5" />
                                    </Button>
                                    <div
                                        className="flex items-center gap-1.5 cursor-pointer bg-white/5 px-4 py-2 rounded-2xl hover:bg-white/10 transition-all border border-white/5"
                                        onClick={() => setShowSelector(true)}
                                    >
                                        <span className="text-lg font-black tracking-tight text-white">
                                            {activeBook?.name || "Bible"} {activeChapterNum}
                                        </span>
                                        <ChevronDown className="h-4 w-4 text-slate-500" />
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {appSettings.bible_feature_split_view !== 'false' && (
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            className={cn(
                                                "rounded-2xl px-3 h-9 font-bold text-[10px] tracking-widest transition-all gap-1.5 border border-white/5",
                                                bibleSettings.splitView ? "bg-indigo-600 text-white" : "bg-white/5 text-slate-300"
                                            )}
                                            onClick={() => setBibleSettings({ splitView: !bibleSettings.splitView })}
                                        >
                                            <Columns className="h-4 w-4" />
                                        </Button>
                                    )}
                                    <Button variant="ghost" size="icon" className="text-slate-400" onClick={() => setViewState('search')}>
                                        <Search className="h-5 w-5" />
                                    </Button>
                                </div>
                            </header>

                            {/* Version Pills - HIDDEN PER USER REQUEST */}
                            {/*
                        <div className="px-2 py-1 bg-[#0B0E14]/80 backdrop-blur-md sticky top-[52px] z-30 border-b border-white/5 overflow-x-auto scrollbar-hide flex items-center gap-1">
                            {BIBLES.map(b => (
                                <Button
                                    key={b.id}
                                    variant="ghost"
                                    className={cn(
                                        "h-9 px-4 text-[10px] font-black uppercase tracking-[0.15em] transition-all rounded-xl relative shrink-0",
                                        currentBibleId === b.id
                                            ? "text-white bg-indigo-600 shadow-lg shadow-indigo-600/20"
                                            : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                                    )}
                                    onClick={() => handleBibleChange(b.id)}
                                >
                                    {b.name.match(/\((.*?)\)/)?.[1] || b.name.split(' ')[0]}
                                </Button>
                            ))}
                        </div>
                        */}

                            {/* Main Content */}
                            <ScrollArea className="flex-1 px-6">
                                {loading ? (
                                    <div className="flex h-64 flex-col items-center justify-center gap-3">
                                        <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
                                        <p className="text-slate-500 text-xs font-black tracking-widest animate-pulse uppercase">Chargement...</p>
                                    </div>
                                ) : content ? (
                                    <div className={cn("max-w-4xl mx-auto py-10 pb-40 flex gap-10", bibleSettings.splitView ? "flex-row" : "flex-col")}>
                                        {/* Primary Chapter Content */}
                                        <article className="flex-1 prose prose-invert prose-slate max-w-none">
                                            <style jsx global>{`
                                            .bible-text .v {
                                                color: #6366f1;
                                                font-weight: 800;
                                                font-size: 0.75em;
                                                margin-right: 0.6em;
                                                font-style: normal;
                                                vertical-align: super;
                                            }
                                            .bible-text p {
                                                line-height: 2.2;
                                                margin-bottom: 1.5em;
                                            }
                                            .bible-text .s, .bible-text .s1 {
                                                font-weight: 900;
                                                font-size: 1.4em;
                                                color: white;
                                                margin: 2.5em 0 1em 0;
                                                display: block;
                                                letter-spacing: -0.02em;
                                            }
                                            .bible-text p.p { display: block; }
                                            .bible-text .q, .bible-text .q1 { padding-left: 2em; font-style: italic; }
                                            .bible-text .q2 { padding-left: 4em; font-style: italic; }
                                        `}</style>
                                            <div className="bible-text font-serif text-slate-200" style={{ fontSize: `${fontSize}px` }}>
                                                {transformContent(content, currentBibleId)}
                                            </div>
                                        </article>

                                        {/* Parallel Chapter Content */}
                                        {bibleSettings.splitView && (
                                            <article className="flex-1 border-l border-white/5 pl-10 prose prose-invert prose-slate max-w-none">
                                                <div className="text-[10px] font-black text-slate-500 uppercase mb-6 tracking-widest opacity-60">
                                                    {BIBLES.find(b => b.id === (bibleSettings.parallelBibleId || 'de4e12af7f28f599-01'))?.name.match(/\((.*?)\)/)?.[1] || "KJV"}
                                                </div>
                                                <div className="bible-text font-serif text-slate-400 opacity-60" style={{ fontSize: `${fontSize - 2}px` }}>
                                                    {transformContent(parallelContent, bibleSettings.parallelBibleId || 'de4e12af7f28f599-01')}
                                                </div>
                                            </article>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-64 text-center">
                                        <Book className="h-16 w-16 text-slate-700 mb-4" />
                                        <p className="text-slate-500">Sélectionnez un livre et un chapitre</p>
                                        <Button className="mt-4" onClick={() => setShowSelector(true)}>
                                            Choisir un passage
                                        </Button>
                                    </div>
                                )}
                            </ScrollArea>

                            {/* Font Size Controls */}
                            {!loading && content && (
                                <div className="absolute right-4 top-32 z-30 flex flex-col gap-2">
                                    <Button variant="secondary" size="icon" className="rounded-xl bg-white/5 border border-white/5 text-slate-400 h-10 w-10" onClick={() => setFontSize(s => Math.min(36, s + 2))}>
                                        <ZoomIn className="h-4 w-4" />
                                    </Button>
                                    <Button variant="secondary" size="icon" className="rounded-xl bg-white/5 border border-white/5 text-slate-400 h-10 w-10" onClick={() => setFontSize(s => Math.max(12, s - 2))}>
                                        <ZoomOut className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* ========== SEARCH VIEW ========== */}
                    {viewState === 'search' && (
                        <motion.div
                            key="search"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            className="flex-1 flex flex-col"
                        >
                            <header className="px-6 pt-12 pb-6">
                                <div className="flex items-center gap-3 mb-6">
                                    <Button variant="ghost" size="icon" onClick={() => setViewState('home')}>
                                        <ArrowLeft className="h-5 w-5" />
                                    </Button>
                                    <h2 className="text-2xl font-black">Rechercher</h2>
                                </div>

                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                                    <Input
                                        placeholder="Rechercher dans la Bible..."
                                        className="h-14 pl-12 pr-4 rounded-2xl bg-white/5 border-white/10 text-lg"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    />
                                </div>
                            </header>

                            <ScrollArea className="flex-1 px-6">
                                {isSearching ? (
                                    <div className="flex justify-center py-12">
                                        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                                    </div>
                                ) : searchResults.length > 0 ? (
                                    <div className="space-y-4 pb-32">
                                        <p className="text-sm text-slate-500">{searchResults.length} résultats</p>
                                        {searchResults.map((result, i) => (
                                            <Card key={i} className="bg-white/5 border-white/5 rounded-2xl overflow-hidden">
                                                <CardContent className="p-5">
                                                    <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 mb-3">
                                                        {result.reference}
                                                    </Badge>
                                                    <p className="text-slate-200 leading-relaxed" dangerouslySetInnerHTML={{ __html: result.text }} />
                                                    <div className="flex gap-2 mt-4">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="rounded-xl"
                                                            onClick={() => {
                                                                const [book, chapter] = result.reference.split(' ');
                                                                // Fix search navigation parsing
                                                                const chapterNum = chapter?.split(':')[0] || "1";
                                                                const chId = `${result.bookId || book}.${chapterNum}`;
                                                                handleNavigation(result.bookId || book, chId);
                                                            }}
                                                        >
                                                            <BookOpen className="h-4 w-4 mr-2" />
                                                            Lire
                                                        </Button>
                                                        <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => copyVerse(result.text, result.reference)}>
                                                            <Copy className="h-4 w-4 mr-2" />
                                                            Copier
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                ) : searchQuery ? (
                                    <div className="text-center py-12 text-slate-500">
                                        Aucun résultat pour "{searchQuery}"
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-slate-500">
                                        <Search className="h-12 w-12 mx-auto mb-4 opacity-30" />
                                        Recherchez des versets, des mots ou des thèmes
                                    </div>
                                )}
                            </ScrollArea>
                        </motion.div>
                    )}

                    {/* ========== GAMES VIEW ========== */}
                    {viewState === 'games' && (
                        <motion.div
                            key="games"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex-1 overflow-y-auto pb-32"
                        >
                            {activeGame === 'quiz' ? (
                                <BibleQuiz onBack={() => setActiveGame(null)} />
                            ) : activeGame === 'memory' ? (
                                <BibleMemoryGame onBack={() => setActiveGame(null)} />
                            ) : activeGame === 'multiplayer_manager' ? (
                                <MultiplayerManager onBack={() => setActiveGame(null)} />
                            ) : activeGame === 'word_search' ? (
                                <WordSearchGame onBack={() => setActiveGame(null)} />
                            ) : activeGame === 'chrono' ? (
                                <ChronoGame onBack={() => setActiveGame(null)} />
                            ) : activeGame === 'who_am_i' ? (
                                <WhoAmIGame onBack={() => setActiveGame(null)} />
                            ) : activeGame === 'multiplayer_groups' ? (
                                <MultiplayerManager onBack={() => setActiveGame(null)} initialView="groups" />
                            ) : (
                                <>
                                    <header className="px-6 pt-12 pb-6">
                                        <div className="flex items-center gap-3 mb-6">
                                            <Button variant="ghost" size="icon" onClick={() => setViewState('home')}>
                                                <ArrowLeft className="h-5 w-5" />
                                            </Button>
                                            <div>
                                                <h2 className="text-2xl font-black">Jeux Bibliques</h2>
                                                <p className="text-slate-500 text-sm">Apprenez en vous amusant</p>
                                            </div>
                                        </div>
                                    </header>

                                    <div className="px-6 pb-20">
                                        <Button
                                            className="w-full h-16 blink-button shadow-indigo-500/30 shadow-xl rounded-3xl mb-8 flex items-center justify-center font-black"
                                            onClick={() => setActiveGame('multiplayer_groups')}
                                        >
                                            <Users className="w-5 h-5 mr-3" />
                                            REJOIGNEZ UN GROUPE DE JOUEURS
                                        </Button>

                                        <div className="space-y-4">
                                            {/* Quiz Card */}
                                            <Card
                                                className="bg-gradient-to-br from-emerald-600/20 to-teal-600/10 border-white/5 rounded-3xl overflow-hidden cursor-pointer hover:border-emerald-500/30 transition-all group hover:scale-[1.02]"
                                                onClick={() => setActiveGame('quiz')}
                                            >
                                                <CardContent className="p-6">
                                                    <div className="flex items-center gap-4 mb-4">
                                                        <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                            <span className="text-3xl">🧠</span>
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-lg text-white">Quiz Biblique</h3>
                                                            <p className="text-sm text-slate-400">Testez vos connaissances</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Badge className="bg-emerald-500/20 text-emerald-400 border-none">Facile</Badge>
                                                        <Badge className="bg-amber-500/20 text-amber-400 border-none">Moyen</Badge>
                                                        <Badge className="bg-red-500/20 text-red-400 border-none">Difficile</Badge>
                                                    </div>
                                                    <Button className="w-full mt-4 h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-500 font-bold" onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveGame('quiz');
                                                    }}>
                                                        <Play className="h-5 w-5 mr-2" />
                                                        Jouer Maintenant
                                                    </Button>
                                                </CardContent>
                                            </Card>

                                            {/* Memory Card */}
                                            <Card
                                                className="bg-gradient-to-br from-purple-600/20 to-pink-600/10 border-white/5 rounded-3xl overflow-hidden cursor-pointer hover:border-purple-500/30 transition-all group hover:scale-[1.02]"
                                                onClick={() => setActiveGame('memory')}
                                            >
                                                <CardContent className="p-6">
                                                    <div className="flex items-center gap-4 mb-4">
                                                        <div className="w-14 h-14 rounded-2xl bg-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                            <span className="text-3xl">🎴</span>
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-lg text-white">Memory Versets</h3>
                                                            <p className="text-sm text-slate-400">Reconstituez les versets (Illimité)</p>
                                                        </div>
                                                    </div>
                                                    <Button className="w-full mt-4 h-12 rounded-2xl bg-purple-600 hover:bg-purple-500 font-bold" onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveGame('memory');
                                                    }}>
                                                        <Play className="h-5 w-5 mr-2" />
                                                        Jouer Maintenant
                                                    </Button>
                                                </CardContent>
                                            </Card>

                                            {/* Multiplayer Duel Card */}
                                            <Card
                                                className="bg-gradient-to-br from-indigo-600/20 to-purple-600/10 border-white/5 rounded-3xl overflow-hidden cursor-pointer hover:border-indigo-500/30 transition-all group hover:scale-[1.02]"
                                                onClick={() => setActiveGame('multiplayer_manager')}
                                            >
                                                <CardContent className="p-6">
                                                    <div className="flex items-center gap-4 mb-4">
                                                        <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                            <span className="text-3xl">⚔️</span>
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-lg text-white">Duel Versets</h3>
                                                            <p className="text-sm text-slate-400">Affrontez vos amis en direct</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Badge className="bg-indigo-500/20 text-indigo-400 border-none">Multijoueur</Badge>
                                                        <Badge className="bg-pink-500/20 text-pink-400 border-none">Live</Badge>
                                                    </div>
                                                    <Button className="w-full mt-4 h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 font-bold" onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveGame('multiplayer_manager');
                                                    }}>
                                                        <Play className="h-5 w-5 mr-2" />
                                                        Jouer Maintenant
                                                    </Button>
                                                </CardContent>
                                            </Card>

                                            {/* Word Search */}
                                            <Card
                                                className="bg-gradient-to-br from-blue-600/20 to-cyan-600/10 border-white/5 rounded-3xl overflow-hidden cursor-pointer hover:border-blue-500/30 transition-all group hover:scale-[1.02]"
                                                onClick={() => setActiveGame('word_search')}
                                            >
                                                <CardContent className="p-6">
                                                    <div className="flex items-center gap-4 mb-4">
                                                        <div className="w-14 h-14 rounded-2xl bg-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                            <span className="text-3xl">🔤</span>
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-lg text-white">Mots Cachés</h3>
                                                            <p className="text-sm text-slate-400">Trouvez les mots bibliques</p>
                                                        </div>
                                                    </div>
                                                    <Button className="w-full mt-4 h-12 rounded-2xl bg-blue-600 hover:bg-blue-500 font-bold" onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveGame('word_search');
                                                    }}>
                                                        <Play className="h-5 w-5 mr-2" />
                                                        Jouer Maintenant
                                                    </Button>
                                                </CardContent>
                                            </Card>

                                            {/* Chrono Game */}
                                            <Card
                                                className="bg-gradient-to-br from-amber-600/20 to-orange-600/10 border-white/5 rounded-3xl overflow-hidden cursor-pointer hover:border-amber-500/30 transition-all group hover:scale-[1.02]"
                                                onClick={() => setActiveGame('chrono')}
                                            >
                                                <CardContent className="p-6">
                                                    <div className="flex items-center gap-4 mb-4">
                                                        <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                            <span className="text-3xl">⏳</span>
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-lg text-white">Chronologie</h3>
                                                            <p className="text-sm text-slate-400">Remettez l'histoire en ordre</p>
                                                        </div>
                                                    </div>
                                                    <Button className="w-full mt-4 h-12 rounded-2xl bg-amber-600 hover:bg-amber-500 font-bold" onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveGame('chrono');
                                                    }}>
                                                        <Play className="h-5 w-5 mr-2" />
                                                        Jouer Maintenant
                                                    </Button>
                                                </CardContent>
                                            </Card>

                                            {/* Who Am I Game */}
                                            <Card
                                                className="bg-gradient-to-br from-cyan-600/20 to-blue-600/10 border-white/5 rounded-3xl overflow-hidden cursor-pointer hover:border-cyan-500/30 transition-all group hover:scale-[1.02]"
                                                onClick={() => setActiveGame('who_am_i')}
                                            >
                                                <CardContent className="p-6">
                                                    <div className="flex items-center gap-4 mb-4">
                                                        <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                            <span className="text-3xl">❓</span>
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-lg text-white">Qui suis-je ?</h3>
                                                            <p className="text-sm text-slate-400">Devinez le personnage biblique</p>
                                                        </div>
                                                    </div>
                                                    <Button className="w-full mt-4 h-12 rounded-2xl bg-cyan-600 hover:bg-cyan-500 font-bold" onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveGame('who_am_i');
                                                    }}>
                                                        <Play className="h-5 w-5 mr-2" />
                                                        Jouer Maintenant
                                                    </Button>
                                                </CardContent>
                                            </Card>
                                        </div>
                                    </div>
                                </>
                            )}
                        </motion.div>
                    )}

                    {/* ========== STUDY/SETTINGS VIEW ========== */}
                    {viewState === 'study' && (
                        <motion.div
                            key="study"
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="flex-1 bg-[#0B0E14] z-50 overflow-y-auto pb-40"
                        >
                            <header className="p-5 flex items-center justify-between border-b border-white/5 sticky top-0 bg-[#0B0E14]/90 backdrop-blur-md">
                                <Button variant="ghost" size="icon" onClick={() => setViewState('home')}><ArrowLeft /></Button>
                                <h2 className="text-xl font-black">Paramètres Bible</h2>
                                <div className="w-10" />
                            </header>

                            <div className="p-6 space-y-8">
                                {/* Font Size */}
                                <section className="space-y-4">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Taille du texte</h3>
                                    <div className="flex items-center gap-4">
                                        <Type className="h-4 w-4 text-slate-500" />
                                        <Slider
                                            value={[fontSize]}
                                            onValueChange={([v]) => setFontSize(v)}
                                            min={12}
                                            max={32}
                                            step={1}
                                            className="flex-1"
                                        />
                                        <span className="text-sm font-bold text-white w-8">{fontSize}</span>
                                    </div>
                                </section>

                                <Separator className="bg-white/5" />

                                {/* Versions Management */}
                                <section className="space-y-6">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Versions Disponibles</h3>

                                    {BIBLES.map(bible => (
                                        <div key={bible.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl">
                                            <div className="flex gap-4 items-center">
                                                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center">
                                                    <Book className="h-6 w-6 text-white" />
                                                </div>
                                                <div>
                                                    <h5 className="font-bold text-slate-200">{bible.name}</h5>
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase">{bible.language === 'fr' ? 'Français' : 'English'}</p>
                                                </div>
                                            </div>
                                            <Badge className={cn(
                                                "px-3",
                                                currentBibleId === bible.id ? "bg-indigo-600" : "bg-white/10"
                                            )}>
                                                {currentBibleId === bible.id ? 'Actif' : 'Disponible'}
                                            </Badge>
                                        </div>
                                    ))}
                                </section>

                                <Separator className="bg-white/5" />

                                {/* Highlights */}
                                <section className="space-y-4">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Vos Surlignages ({highlights.length})</h3>
                                    {highlights.length === 0 ? (
                                        <p className="text-sm text-slate-500 italic">Aucun surlignage. Sélectionnez des versets pour les surligner.</p>
                                    ) : (
                                        highlights.map((h, i) => (
                                            <div key={i} className="p-4 bg-white/5 rounded-2xl flex items-center justify-between group">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: h.color }} />
                                                    <span className="text-sm font-medium">{h.id.split(':')[1]}</span>
                                                </div>
                                                <Button variant="ghost" size="icon" className="text-slate-500 hover:text-red-400" onClick={() => removeHighlight(h.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))
                                    )}
                                </section>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>



                {/* ========== BOOK/CHAPTER SELECTOR DIALOG ========== */}
                <Dialog open={showSelector} onOpenChange={setShowSelector}>
                    <DialogContent className="bg-[#0B0E14] border-white/10 text-white max-w-md p-0 overflow-hidden rounded-[2.5rem] shadow-2xl max-h-[80vh]">
                        <DialogHeader className="sr-only">
                            <DialogTitle>Sélecteur de Chapitre</DialogTitle>
                        </DialogHeader>
                        <Tabs defaultValue="books" className="flex flex-col h-full">
                            <div className="p-4 border-b border-white/5">
                                <TabsList className="w-full bg-white/5 p-1 rounded-2xl">
                                    <TabsTrigger value="books" className="flex-1 font-bold text-xs rounded-xl data-[state=active]:bg-indigo-600">Livres</TabsTrigger>
                                    <TabsTrigger value="chapters" className="flex-1 font-bold text-xs rounded-xl data-[state=active]:bg-indigo-600">Chapitres</TabsTrigger>
                                </TabsList>
                            </div>

                            <TabsContent value="books" className="flex-1 overflow-hidden m-0">
                                <ScrollArea className="h-[400px]">
                                    <div className="p-4 space-y-2">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Ancien Testament</p>
                                        <div className="grid grid-cols-3 gap-2 mb-4">
                                            {books.filter(b => b.testament === 'OT').map(b => (
                                                <Button
                                                    key={b.id}
                                                    variant="ghost"
                                                    className={cn(
                                                        "h-12 rounded-xl font-bold text-xs transition-all",
                                                        activeBook?.id === b.id ? "bg-indigo-600 text-white" : "bg-white/5 hover:bg-white/10"
                                                    )}
                                                    onClick={() => {
                                                        setActiveBook(b);
                                                        loadChapters(currentBibleId, b.id);
                                                    }}
                                                >
                                                    {b.abbreviation}
                                                </Button>
                                            ))}
                                        </div>
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 pt-4">Nouveau Testament</p>
                                        <div className="grid grid-cols-3 gap-2">
                                            {books.filter(b => b.testament === 'NT').map(b => (
                                                <Button
                                                    key={b.id}
                                                    variant="ghost"
                                                    className={cn(
                                                        "h-12 rounded-xl font-bold text-xs transition-all",
                                                        activeBook?.id === b.id ? "bg-indigo-600 text-white" : "bg-white/5 hover:bg-white/10"
                                                    )}
                                                    onClick={() => {
                                                        setActiveBook(b);
                                                        loadChapters(currentBibleId, b.id);
                                                    }}
                                                >
                                                    {b.abbreviation}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                </ScrollArea>
                            </TabsContent>

                            <TabsContent value="chapters" className="flex-1 overflow-hidden m-0">
                                <ScrollArea className="h-[400px]">
                                    <div className="p-4">
                                        {activeBook && (
                                            <p className="text-center font-bold text-lg mb-4 text-white">{activeBook.name}</p>
                                        )}
                                        <div className="grid grid-cols-5 gap-2">
                                            {chapters.map(chapterNum => (
                                                <Button
                                                    key={chapterNum}
                                                    className={cn(
                                                        "aspect-square h-auto p-0 rounded-xl text-base font-black transition-all",
                                                        activeBook && activeChapterNum === String(chapterNum) ? "bg-indigo-600 scale-105" : "bg-white/5 hover:bg-white/10"
                                                    )}
                                                    onClick={() => {
                                                        if (activeBook) {
                                                            handleNavigation(activeBook.id, `${activeBook.id}.${chapterNum}`);
                                                            setShowSelector(false);
                                                        }
                                                    }}
                                                >
                                                    {chapterNum}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                </ScrollArea>
                            </TabsContent>
                        </Tabs>
                    </DialogContent>
                </Dialog>

                {/* Hidden Audio Element */}
                {audioUrl && (
                    <audio
                        ref={audioRef}
                        src={audioUrl || undefined}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onEnded={() => setIsPlaying(false)}
                    />
                )}
            </div>
        </div>
    );
}
