'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Book, ChevronRight, ArrowLeft, Search, BookOpen, Share2, Loader2, X, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { bibleApi, BibleBook, TRANSLATIONS, DEFAULT_TRANSLATION } from '@/lib/unified-bible-api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface BibleShareDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onShareVerse: (text: string) => void;
}

const OLD_TESTAMENT_IDS = ['GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA', '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH', 'EST', 'JOB', 'PSA', 'PRO', 'ECC', 'SNG', 'ISA', 'JER', 'LAM', 'EZK', 'DAN', 'HOS', 'JOL', 'AMO', 'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL'];

type DialogStep = 'books' | 'chapters' | 'verses';

export function BibleShareDialog({ open, onOpenChange, onShareVerse }: BibleShareDialogProps) {
    const [step, setStep] = useState<DialogStep>('books');
    const [books] = useState<BibleBook[]>(() => bibleApi.getBooks());
    const [selectedBook, setSelectedBook] = useState<BibleBook | null>(null);
    const [selectedChapter, setSelectedChapter] = useState<number>(1);
    const [chapters, setChapters] = useState<number[]>([]);
    const [verses, setVerses] = useState<{ verse: number; text: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedVerses, setSelectedVerses] = useState<Set<number>>(new Set());
    const [searchFilter, setSearchFilter] = useState('');
    const [translationId, setTranslationId] = useState(DEFAULT_TRANSLATION);

    const selectBook = useCallback((book: BibleBook) => {
        setSelectedBook(book);
        const ch = bibleApi.getChapters(book.id);
        setChapters(ch);
        setSelectedVerses(new Set());
        setStep('chapters');
    }, []);

    const selectChapter = useCallback(async (chapter: number) => {
        if (!selectedBook) return;
        setSelectedChapter(chapter);
        setLoading(true);
        setSelectedVerses(new Set());
        try {
            const data = await bibleApi.getChapterContent(selectedBook.id, chapter, translationId);
            if (data?.verses) {
                setVerses(data.verses.map((v, i) => ({
                    verse: v.verse || i + 1,
                    text: v.text
                })));
            }
        } catch {
            toast.error('Erreur de chargement');
            setVerses([]);
        }
        setLoading(false);
        setStep('verses');
    }, [selectedBook, translationId]);

    const toggleVerse = (verseNum: number) => {
        setSelectedVerses(prev => {
            const ns = new Set(prev);
            if (ns.has(verseNum)) ns.delete(verseNum);
            else ns.add(verseNum);
            return ns;
        });
    };

    const shareSelected = () => {
        if (!selectedBook || selectedVerses.size === 0) return;
        const selected = verses
            .filter(v => selectedVerses.has(v.verse))
            .sort((a, b) => a.verse - b.verse);

        const text = selected.map(v =>
            `📖 ${selectedBook.name} ${selectedChapter}:${v.verse}\n"${v.text}"`
        ).join('\n\n') + '\n\n— Maison de Prière';

        onShareVerse(text);
        resetAndClose();
    };

    const shareEntireChapter = () => {
        if (!selectedBook || verses.length === 0) return;
        const header = `📖 **${selectedBook.name} ${selectedChapter}** (chapitre complet)\n\n`;
        const body = verses.map(v => `${v.verse}. ${v.text}`).join('\n');
        const text = header + body + '\n\n— Maison de Prière';
        onShareVerse(text);
        resetAndClose();
    };

    const resetAndClose = () => {
        setStep('books');
        setSelectedBook(null);
        setSelectedVerses(new Set());
        setVerses([]);
        setSearchFilter('');
        onOpenChange(false);
    };

    const goBack = () => {
        if (step === 'verses') setStep('chapters');
        else if (step === 'chapters') { setStep('books'); setSelectedBook(null); }
        else resetAndClose();
    };

    const filteredBooks = searchFilter
        ? books.filter(b => b.name.toLowerCase().includes(searchFilter.toLowerCase()) || b.abbreviation.toLowerCase().includes(searchFilter.toLowerCase()))
        : books;

    const otBooks = filteredBooks.filter(b => OLD_TESTAMENT_IDS.includes(b.id));
    const ntBooks = filteredBooks.filter(b => !OLD_TESTAMENT_IDS.includes(b.id));

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-[#0F1219] border-white/10 text-white max-w-md p-0 overflow-hidden rounded-3xl shadow-2xl max-h-[85vh]">
                <DialogHeader className="sr-only">
                    <DialogTitle>Partager un verset biblique</DialogTitle>
                </DialogHeader>

                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-[#0B0E14]/90 backdrop-blur-md">
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={goBack}>
                        {step === 'books' ? <X className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
                    </Button>
                    <div className="flex-1">
                        <p className="font-bold text-sm text-white">
                            {step === 'books' && '📖 Partager un verset'}
                            {step === 'chapters' && selectedBook?.name}
                            {step === 'verses' && `${selectedBook?.name} ${selectedChapter}`}
                        </p>
                        <p className="text-[10px] text-slate-500">
                            {step === 'books' && 'Choisissez un livre'}
                            {step === 'chapters' && 'Choisissez un chapitre'}
                            {step === 'verses' && `${selectedVerses.size > 0 ? `${selectedVerses.size} verset(s) sélectionné(s)` : 'Appuyez pour sélectionner'}`}
                        </p>
                    </div>
                    {step === 'verses' && selectedVerses.size > 0 && (
                        <Button
                            size="sm"
                            className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-xs"
                            onClick={shareSelected}
                        >
                            <Share2 className="h-3 w-3 mr-1" /> Envoyer
                        </Button>
                    )}
                </div>

                <ScrollArea className="h-[60vh]">
                    <AnimatePresence mode="wait">
                        {/* Books Step */}
                        {step === 'books' && (
                            <motion.div
                                key="books"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="p-4"
                            >
                                <div className="relative mb-4">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                                    <Input
                                        placeholder="Rechercher un livre..."
                                        className="pl-9 h-10 rounded-xl bg-white/5 border-white/10 text-sm"
                                        value={searchFilter}
                                        onChange={e => setSearchFilter(e.target.value)}
                                    />
                                </div>

                                {otBooks.length > 0 && (
                                    <>
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Ancien Testament</p>
                                        <div className="grid grid-cols-3 gap-1.5 mb-4">
                                            {otBooks.map(b => (
                                                <button
                                                    key={b.id}
                                                    className="h-11 rounded-xl bg-white/5 hover:bg-amber-600/20 hover:border-amber-500/30 border border-white/5 text-xs font-bold text-white transition-all truncate px-2"
                                                    onClick={() => selectBook(b)}
                                                >
                                                    {b.abbreviation}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}

                                {ntBooks.length > 0 && (
                                    <>
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 mt-4">Nouveau Testament</p>
                                        <div className="grid grid-cols-3 gap-1.5">
                                            {ntBooks.map(b => (
                                                <button
                                                    key={b.id}
                                                    className="h-11 rounded-xl bg-white/5 hover:bg-indigo-600/20 hover:border-indigo-500/30 border border-white/5 text-xs font-bold text-white transition-all truncate px-2"
                                                    onClick={() => selectBook(b)}
                                                >
                                                    {b.abbreviation}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </motion.div>
                        )}

                        {/* Chapters Step */}
                        {step === 'chapters' && (
                            <motion.div
                                key="chapters"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="p-4"
                            >
                                <div className="grid grid-cols-5 gap-2">
                                    {chapters.map(ch => (
                                        <button
                                            key={ch}
                                            className="aspect-square rounded-xl bg-white/5 hover:bg-indigo-600/30 border border-white/5 hover:border-indigo-500/30 font-black text-sm transition-all flex items-center justify-center"
                                            onClick={() => selectChapter(ch)}
                                        >
                                            {ch}
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {/* Verses Step */}
                        {step === 'verses' && (
                            <motion.div
                                key="verses"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="p-4"
                            >
                                {loading ? (
                                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                                        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                                        <p className="text-sm text-slate-500">Chargement...</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Share entire chapter button */}
                                        <Button
                                            variant="outline"
                                            className="w-full mb-4 h-12 rounded-xl border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/20 font-bold text-xs"
                                            onClick={shareEntireChapter}
                                        >
                                            <BookOpen className="h-4 w-4 mr-2" />
                                            Envoyer le chapitre entier
                                        </Button>

                                        <p className="text-[10px] text-slate-500 mb-3 font-bold uppercase tracking-wider">
                                            Ou sélectionnez des versets individuels :
                                        </p>

                                        <div className="space-y-1.5">
                                            {verses.map(v => (
                                                <button
                                                    key={v.verse}
                                                    className={cn(
                                                        "w-full text-left p-3 rounded-xl border transition-all text-sm leading-relaxed",
                                                        selectedVerses.has(v.verse)
                                                            ? "bg-indigo-600/20 border-indigo-500/30 text-white"
                                                            : "bg-white/3 border-white/5 text-slate-300 hover:bg-white/5"
                                                    )}
                                                    onClick={() => toggleVerse(v.verse)}
                                                >
                                                    <span className="text-indigo-400 font-black text-xs mr-2 align-super">{v.verse}</span>
                                                    {v.text}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
