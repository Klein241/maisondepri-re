'use client';

import { useEffect, useState, useCallback } from "react";
import { bibleApi, BibleBook, TRANSLATIONS as BIBLES, DEFAULT_TRANSLATION as DEFAULT_BIBLE_ID, BibleVerse } from "@/lib/unified-bible-api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Loader2, ArrowLeft, Book, ChevronRight, ChevronLeft, ChevronDown,
    Copy, Star, Share2, ZoomIn, ZoomOut, Sparkles, BookOpen, Brain
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { useBibleFavorites, useBibleHighlights, shareVerse, copyVerse, HIGHLIGHT_COLORS, HighlightColor } from "@/lib/bible-features";
import parse, { domToReact } from 'html-react-parser';
import { useReadingPlanStore } from "@/lib/reading-plans";

const OLD_TESTAMENT = ['GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA', '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH', 'EST', 'JOB', 'PSA', 'PRO', 'ECC', 'SNG', 'ISA', 'JER', 'LAM', 'EZK', 'DAN', 'HOS', 'JOL', 'AMO', 'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL'];

interface BibleReaderProps {
    onBack: () => void;
    initialBookId?: string;
    initialChapter?: string;
}

export function BibleReader({ onBack, initialBookId, initialChapter }: BibleReaderProps) {
    const { bibleNavigation, setBibleNavigation, bibleSettings, setBibleSettings, user, appSettings } = useAppStore();
    const { favorites, addFavorite, removeFavorite, isFavorite } = useBibleFavorites(user?.id);
    const { highlights, addHighlight, removeHighlight, getHighlight } = useBibleHighlights(user?.id);
    const { addMemoryCard } = useReadingPlanStore();

    const [currentBibleId, setCurrentBibleId] = useState(DEFAULT_BIBLE_ID);
    const [books, setBooks] = useState<BibleBook[]>([]);
    const [chapters, setChapters] = useState<number[]>([]);
    const [activeBook, setActiveBook] = useState<BibleBook | null>(null);
    const [activeChapterNum, setActiveChapterNum] = useState("1");
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(false);
    const [showSelector, setShowSelector] = useState(false);
    const [fontSize, setFontSize] = useState(18);
    const [showBookFilter, setShowBookFilter] = useState<'all' | 'ot' | 'nt'>('all');
    const [verseOfDay, setVerseOfDay] = useState<{ reference: string; content: string } | null>(null);

    // Init
    useEffect(() => {
        const b = bibleApi.getBooks();
        setBooks(b);
        loadVerseOfDay();

        if (initialBookId) {
            const book = b.find(bk => bk.id === initialBookId);
            if (book) {
                setActiveBook(book);
                setChapters(bibleApi.getChapters(book.id));
                const ch = initialChapter || "1";
                setActiveChapterNum(ch);
                loadContent(currentBibleId, `${book.id}.${ch}`);
            }
        }
    }, []);

    useEffect(() => {
        if (bibleNavigation) {
            handleNavigation(bibleNavigation.bookId, bibleNavigation.chapterId);
            setBibleNavigation(null);
        }
    }, [bibleNavigation]);

    const loadVerseOfDay = async () => {
        try {
            const verse = await bibleApi.getVerseOfTheDay(currentBibleId);
            if (verse) setVerseOfDay({ reference: verse.reference, content: verse.text.substring(0, 300) });
        } catch { /* ignore */ }
    };

    const loadContent = async (bid: string, cid: string) => {
        setLoading(true);
        try {
            const [bookId, chapterNum] = cid.includes('.') ? cid.split('.') : [activeBook?.id || 'GEN', cid];
            const data = await bibleApi.getChapterContent(bookId, parseInt(chapterNum), bid);
            if (data?.verses?.length) {
                let html = '';
                data.verses.forEach((v, i) => {
                    const vn = v.verse || (i + 1);
                    html += `<p><span data-id="${vn}" class="v">${vn}</span>${v.text}</p>`;
                });
                setContent(html);
            } else {
                setContent("<p>Contenu non disponible.</p>");
            }
        } catch {
            setContent("<p>Erreur de chargement.</p>");
        }
        setLoading(false);
    };

    const handleNavigation = async (bookId: string, chapterId: string) => {
        const book = books.find(b => b.id === bookId) || books[0];
        if (!book) return;
        setActiveBook(book);
        setChapters(bibleApi.getChapters(book.id));
        let ch = "1";
        if (chapterId?.includes('.')) ch = chapterId.split('.')[1];
        else if (chapterId) ch = chapterId;
        setActiveChapterNum(ch);
        const loadId = chapterId.includes('.') ? chapterId : `${bookId}.${ch}`;
        await loadContent(currentBibleId, loadId);
    };

    const goChapter = (delta: number) => {
        if (!activeBook) return;
        const next = parseInt(activeChapterNum) + delta;
        if (next < 1 || next > (activeBook.chapters || 150)) return;
        handleNavigation(activeBook.id, `${activeBook.id}.${next}`);
    };

    const getTextContent = (node: any): string => {
        let parentP = node;
        while (parentP && parentP.name !== 'p') parentP = parentP.parent;
        if (parentP?.children) {
            return parentP.children
                .filter((c: any) => !(c.type === 'tag' && c.name === 'span' && c.attribs?.class?.includes('v')))
                .map((c: any) => c.data || '')
                .join('').trim();
        }
        return "";
    };

    const handleCopy = (node: any, ref: string) => {
        const text = getTextContent(node);
        navigator.clipboard.writeText(`"${text}" - ${ref}`);
        toast.success("Verset copié !");
    };

    const handleFavorite = (node: any, ref: string) => {
        const text = getTextContent(node);
        if (isFavorite(ref)) {
            const fav = favorites.find(f => f.reference === ref);
            if (fav) removeFavorite(fav.id);
            toast.info("Retiré des favoris");
        } else {
            addFavorite(ref, text, currentBibleId);
            toast.success("Ajouté aux favoris ⭐");
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

    const handleMemorize = (node: any, ref: string) => {
        const text = getTextContent(node);
        if (activeBook) {
            const verseNum = parseInt(ref.split(':').pop() || '1');
            addMemoryCard(ref, text, activeBook.id, parseInt(activeChapterNum), verseNum);
            toast.success("Ajouté à la mémorisation 🧠");
        }
    };

    const transformContent = (htmlString: string) => {
        const options: any = {
            replace: (domNode: any) => {
                if (domNode.type === 'tag' && domNode.name === 'span') {
                    const className = domNode.attribs.class;
                    if (className?.includes('v') || domNode.attribs['data-v']) {
                        const verseId = domNode.attribs['data-v'] || domNode.attribs['data-id'];
                        const ref = `${activeBook?.name} ${activeChapterNum}:${verseId}`;
                        const isFav = isFavorite(ref);
                        const highlight = getHighlight(ref);

                        return (
                            <Popover>
                                <PopoverTrigger asChild>
                                    <span className={cn(
                                        "cursor-pointer hover:bg-white/5 rounded px-0.5 transition-all duration-200 relative group",
                                        highlight ? HIGHLIGHT_COLORS[highlight.color as HighlightColor]?.bgClass : "",
                                        isFav ? "underline decoration-amber-400/50 decoration-2 underline-offset-4" : ""
                                    )}>
                                        {isFav && <span className="absolute -top-1.5 -right-0.5 text-[7px] opacity-80">⭐</span>}
                                        {domToReact(domNode.children as any, options)}
                                    </span>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-1.5 bg-[#1A1D24]/95 backdrop-blur-xl border-white/10 text-white flex gap-1 rounded-2xl z-50 shadow-2xl shadow-black/40" sideOffset={8}>
                                    <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl hover:bg-white/10" onClick={() => handleCopy(domNode, ref)}>
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className={cn("h-9 w-9 rounded-xl hover:bg-white/10", isFav && "text-amber-400")} onClick={() => handleFavorite(domNode, ref)}>
                                        <Star className={cn("h-4 w-4", isFav && "fill-current")} />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl hover:bg-white/10" onClick={() => { const text = getTextContent(domNode); shareVerse(ref, text, currentBibleId); }}>
                                        <Share2 className="h-4 w-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl hover:bg-white/10 text-purple-400" onClick={() => handleMemorize(domNode, ref)}>
                                        <Brain className="h-4 w-4" />
                                    </Button>
                                    <div className="w-px h-8 bg-white/10 mx-0.5 self-center" />
                                    {Object.entries(HIGHLIGHT_COLORS).map(([color, style]) => (
                                        <button key={color} className={cn("w-7 h-7 rounded-full border-2 transition-transform hover:scale-110", style.bgClass, style.borderClass)} onClick={() => handleHighlight(domNode, ref, color as HighlightColor)} />
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

    const filteredBooks = books.filter(b => {
        if (showBookFilter === 'all') return true;
        if (showBookFilter === 'ot') return OLD_TESTAMENT.includes(b.id);
        return !OLD_TESTAMENT.includes(b.id);
    });

    // If no book selected, show home with verse of day + book grid
    if (!activeBook || !content) {
        return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 overflow-y-auto pb-32">
                {/* Verse of the Day */}
                <section className="px-5 pt-4 mb-6">
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600/20 via-violet-600/15 to-transparent border border-white/[0.08] p-6">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15),transparent_70%)]" />
                        <div className="relative">
                            <div className="flex items-center gap-2 mb-3">
                                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                                <span className="text-[10px] font-black text-amber-400 uppercase tracking-[0.2em]">Verset du jour</span>
                            </div>
                            <p className="font-serif text-base text-white/90 italic leading-relaxed mb-4">
                                &ldquo;{verseOfDay?.content || "L'Éternel est mon berger: je ne manquerai de rien."}&rdquo;
                            </p>
                            <Badge variant="outline" className="border-white/15 text-slate-300 text-[10px] font-bold">
                                {verseOfDay?.reference || "Psaumes 23:1"}
                            </Badge>
                        </div>
                    </div>
                </section>

                {/* Filter */}
                <section className="px-5 mb-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.15em]">Explorer les livres</h3>
                        <div className="flex gap-1 bg-white/[0.04] rounded-xl p-1 border border-white/[0.06]">
                            {[{ k: 'all', l: 'Tous' }, { k: 'ot', l: 'AT' }, { k: 'nt', l: 'NT' }].map(f => (
                                <button key={f.k} className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all", showBookFilter === f.k ? "bg-white/10 text-white" : "text-slate-500")} onClick={() => setShowBookFilter(f.k as any)}>{f.l}</button>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        {filteredBooks.map(book => (
                            <button key={book.id} className="group flex flex-col items-center justify-center aspect-square rounded-2xl bg-white/[0.04] border border-white/[0.06] hover:bg-indigo-600/15 hover:border-indigo-500/30 transition-all duration-200" onClick={() => { setActiveBook(book); setChapters(bibleApi.getChapters(book.id)); setShowSelector(true); }}>
                                <span className="font-black text-[11px] text-white/80 group-hover:text-white transition-colors">{book.abbreviation}</span>
                                <span className="text-[8px] text-slate-500 mt-0.5 truncate max-w-full px-1">{book.name}</span>
                            </button>
                        ))}
                    </div>
                </section>

                {/* Chapter selector dialog */}
                <Dialog open={showSelector} onOpenChange={setShowSelector}>
                    <DialogContent className="bg-[#0F1219] border-white/10 text-white max-w-sm p-0 overflow-hidden rounded-3xl max-h-[75vh]">
                        <DialogHeader className="sr-only"><DialogTitle>Chapitres</DialogTitle></DialogHeader>
                        {activeBook && (
                            <div className="p-5">
                                <p className="text-center font-black text-lg mb-1">{activeBook.name}</p>
                                <p className="text-center text-[11px] text-slate-500 mb-5">{activeBook.chapters} chapitres</p>
                                <div className="grid grid-cols-5 gap-2 max-h-[50vh] overflow-y-auto">
                                    {chapters.map(ch => (
                                        <Button key={ch} className={cn("aspect-square h-auto p-0 rounded-xl text-sm font-black transition-all", activeChapterNum === String(ch) ? "bg-indigo-600 scale-105" : "bg-white/5 hover:bg-white/10")} onClick={() => { handleNavigation(activeBook.id, `${activeBook.id}.${ch}`); setShowSelector(false); }}>{ch}</Button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </motion.div>
        );
    }

    // Reader view
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col overflow-hidden">
            {/* Reader Header */}
            <header className="flex items-center justify-between px-4 py-2.5 bg-[#0B0E14]/80 backdrop-blur-xl sticky top-0 z-40 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-slate-400" onClick={onBack}><ArrowLeft className="h-5 w-5" /></Button>
                    <button className="flex items-center gap-1.5 bg-white/[0.05] px-4 py-2 rounded-2xl hover:bg-white/[0.08] transition-all border border-white/[0.06]" onClick={() => setShowSelector(true)}>
                        <span className="text-base font-black text-white">{activeBook.name} {activeChapterNum}</span>
                        <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                    </button>
                </div>
                <div className="flex items-center gap-1.5">
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-slate-400 bg-white/[0.04]" onClick={() => setFontSize(s => Math.min(36, s + 2))}><ZoomIn className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-slate-400 bg-white/[0.04]" onClick={() => setFontSize(s => Math.max(12, s - 2))}><ZoomOut className="h-4 w-4" /></Button>
                </div>
            </header>

            {/* Content */}
            <ScrollArea className="flex-1">
                {loading ? (
                    <div className="flex h-64 flex-col items-center justify-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                        <p className="text-slate-500 text-xs font-bold tracking-widest animate-pulse uppercase">Chargement...</p>
                    </div>
                ) : (
                    <article className="max-w-3xl mx-auto px-6 py-8 pb-40">
                        <style jsx global>{`
                            .bible-reader .v {
                                color: #818cf8;
                                font-weight: 800;
                                font-size: 0.7em;
                                margin-right: 0.5em;
                                vertical-align: super;
                                opacity: 0.8;
                            }
                            .bible-reader p {
                                line-height: 2.2;
                                margin-bottom: 1.2em;
                                color: rgba(226, 232, 240, 0.9);
                            }
                        `}</style>
                        <div className="bible-reader font-serif text-slate-200" style={{ fontSize: `${fontSize}px` }}>
                            {transformContent(content)}
                        </div>
                    </article>
                )}
            </ScrollArea>

            {/* Chapter navigation footer */}
            <div className="flex items-center justify-between px-6 py-3 bg-[#0B0E14]/80 backdrop-blur-xl border-t border-white/[0.06]">
                <Button variant="ghost" size="sm" className="rounded-xl text-slate-400 gap-1.5" onClick={() => goChapter(-1)} disabled={parseInt(activeChapterNum) <= 1}>
                    <ChevronLeft className="h-4 w-4" /> Précédent
                </Button>
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{activeBook.abbreviation} {activeChapterNum}</span>
                <Button variant="ghost" size="sm" className="rounded-xl text-slate-400 gap-1.5" onClick={() => goChapter(1)}>
                    Suivant <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            {/* Dialog */}
            <Dialog open={showSelector} onOpenChange={setShowSelector}>
                <DialogContent className="bg-[#0F1219] border-white/10 text-white max-w-sm p-0 overflow-hidden rounded-3xl max-h-[80vh]">
                    <DialogHeader className="sr-only"><DialogTitle>Sélection</DialogTitle></DialogHeader>
                    <Tabs defaultValue="books" className="flex flex-col">
                        <div className="p-4 border-b border-white/[0.06]">
                            <TabsList className="w-full bg-white/[0.04] p-1 rounded-2xl">
                                <TabsTrigger value="books" className="flex-1 font-bold text-xs rounded-xl data-[state=active]:bg-indigo-600">Livres</TabsTrigger>
                                <TabsTrigger value="chapters" className="flex-1 font-bold text-xs rounded-xl data-[state=active]:bg-indigo-600">Chapitres</TabsTrigger>
                            </TabsList>
                        </div>
                        <TabsContent value="books" className="m-0">
                            <ScrollArea className="h-[400px]">
                                <div className="p-4 space-y-3">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em]">Ancien Testament</p>
                                    <div className="grid grid-cols-3 gap-2 mb-4">
                                        {books.filter(b => b.testament === 'OT').map(b => (
                                            <Button key={b.id} variant="ghost" className={cn("h-11 rounded-xl font-bold text-xs", activeBook?.id === b.id ? "bg-indigo-600 text-white" : "bg-white/5 hover:bg-white/10")} onClick={() => { setActiveBook(b); setChapters(bibleApi.getChapters(b.id)); }}>{b.abbreviation}</Button>
                                        ))}
                                    </div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] pt-2">Nouveau Testament</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {books.filter(b => b.testament === 'NT').map(b => (
                                            <Button key={b.id} variant="ghost" className={cn("h-11 rounded-xl font-bold text-xs", activeBook?.id === b.id ? "bg-indigo-600 text-white" : "bg-white/5 hover:bg-white/10")} onClick={() => { setActiveBook(b); setChapters(bibleApi.getChapters(b.id)); }}>{b.abbreviation}</Button>
                                        ))}
                                    </div>
                                </div>
                            </ScrollArea>
                        </TabsContent>
                        <TabsContent value="chapters" className="m-0">
                            <ScrollArea className="h-[400px]">
                                <div className="p-4">
                                    {activeBook && <p className="text-center font-bold text-lg mb-4">{activeBook.name}</p>}
                                    <div className="grid grid-cols-5 gap-2">
                                        {chapters.map(ch => (
                                            <Button key={ch} className={cn("aspect-square h-auto p-0 rounded-xl text-sm font-black", activeChapterNum === String(ch) ? "bg-indigo-600 scale-105" : "bg-white/5 hover:bg-white/10")} onClick={() => { if (activeBook) { handleNavigation(activeBook.id, `${activeBook.id}.${ch}`); setShowSelector(false); } }}>{ch}</Button>
                                        ))}
                                    </div>
                                </div>
                            </ScrollArea>
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>
        </motion.div>
    );
}
