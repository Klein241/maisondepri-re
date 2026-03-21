'use client';

import { useState } from "react";
import { bibleApi, DEFAULT_TRANSLATION as DEFAULT_BIBLE_ID } from "@/lib/unified-bible-api";
import type { AdvancedSearchResult } from "@/lib/local-bible-service";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Loader2, BookOpen, Copy, ChevronDown, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useAppStore } from "@/lib/store";

interface BibleFullSearchProps {
    onNavigate: (bookId: string, chapter: string) => void;
}

const SUGGESTIONS = ['amour', 'foi', 'espérance', 'grâce', 'paix', 'lumière', 'miséricorde', 'justice'];

export function BibleFullSearch({ onNavigate }: BibleFullSearchProps) {
    const [query, setQuery] = useState("");
    const [advancedResults, setAdvancedResults] = useState<AdvancedSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [totalOccurrences, setTotalOccurrences] = useState(0);
    const [expandedBook, setExpandedBook] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = async (searchTerm?: string) => {
        const term = searchTerm || query;
        if (!term.trim()) return;
        if (searchTerm) setQuery(searchTerm);
        setIsSearching(true);
        setAdvancedResults([]);
        setExpandedBook(null);
        setHasSearched(true);

        try {
            const results = await bibleApi.advancedSearchBible(term);
            setAdvancedResults(results);
            setTotalOccurrences(results.reduce((sum, r) => sum + r.occurrences, 0));
        } catch {
            toast.error("Erreur de recherche");
        }
        setIsSearching(false);
    };

    const copyVerse = (text: string, ref: string) => {
        navigator.clipboard.writeText(`"${text}" - ${ref}`);
        toast.success("Verset copié !");
    };

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col overflow-hidden">
            {/* Search Header */}
            <div className="px-5 pt-4 pb-3">
                <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-linear-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                        <Search className="h-4 w-4 text-amber-400" />
                    </div>
                    <Input
                        placeholder="Rechercher un mot, une expression..."
                        className="h-14 pl-14 pr-28 rounded-2xl bg-white/4 border-white/8 text-base placeholder:text-slate-600 focus:border-amber-500/30 focus:ring-amber-500/10 transition-all"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Button
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-10 px-5 rounded-xl bg-linear-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 font-bold text-sm shadow-lg shadow-amber-600/20 transition-all"
                        onClick={() => handleSearch()}
                        disabled={isSearching || !query.trim()}
                    >
                        {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Chercher'}
                    </Button>
                </div>

                {/* Suggestions */}
                {!hasSearched && (
                    <div className="flex flex-wrap gap-2 mt-3">
                        {SUGGESTIONS.map(s => (
                            <button key={s} onClick={() => handleSearch(s)} className="px-3 py-1.5 rounded-xl bg-white/4 border border-white/6 text-[11px] font-medium text-slate-400 hover:text-amber-400 hover:border-amber-500/20 transition-all capitalize">{s}</button>
                        ))}
                    </div>
                )}
            </div>

            {/* Results */}
            <ScrollArea className="flex-1 px-5">
                {isSearching ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="relative">
                            <div className="w-16 h-16 rounded-full border-2 border-amber-500/20 animate-ping absolute inset-0" />
                            <div className="w-16 h-16 rounded-full bg-linear-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                                <Search className="h-7 w-7 text-amber-400 animate-pulse" />
                            </div>
                        </div>
                        <p className="text-slate-500 text-sm font-medium animate-pulse">Recherche dans toute la Bible...</p>
                    </div>
                ) : advancedResults.length > 0 ? (
                    <div className="space-y-3 pb-32">
                        {/* Summary */}
                        <div className="relative overflow-hidden rounded-2xl bg-linear-to-r from-amber-600/15 via-orange-600/10 to-transparent border border-amber-500/15 p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] text-amber-400 font-black uppercase tracking-[0.15em]">Résultats pour &laquo; {query} &raquo;</p>
                                    <p className="text-2xl font-black text-white mt-1">{totalOccurrences} <span className="text-sm font-medium text-slate-400">occurrences</span></p>
                                </div>
                                <div className="text-right">
                                    <p className="text-3xl font-black bg-linear-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">{advancedResults.length}</p>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">livres</p>
                                </div>
                            </div>
                        </div>

                        {/* Book Results */}
                        {advancedResults.map((bookResult) => (
                            <div key={bookResult.bookId} className="rounded-2xl overflow-hidden border border-white/6 bg-white/2">
                                <button onClick={() => setExpandedBook(expandedBook === bookResult.bookId ? null : bookResult.bookId)} className="w-full flex items-center justify-between p-4 hover:bg-white/4 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm", bookResult.testament === 'AT' ? 'bg-amber-500/15 text-amber-400' : 'bg-indigo-500/15 text-indigo-400')}>
                                            {bookResult.occurrences}
                                        </div>
                                        <div className="text-left">
                                            <p className="font-bold text-white text-sm">{bookResult.bookName}</p>
                                            <p className="text-[10px] text-slate-500">{bookResult.testament === 'AT' ? 'Ancien Testament' : 'Nouveau Testament'}</p>
                                        </div>
                                    </div>
                                    <ChevronDown className={cn("h-4 w-4 text-slate-500 transition-transform", expandedBook === bookResult.bookId && 'rotate-180')} />
                                </button>

                                {expandedBook === bookResult.bookId && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="border-t border-white/6">
                                        <div className="p-3 space-y-2">
                                            {bookResult.verses.slice(0, 15).map((v, i) => {
                                                const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                                                const parts = v.text.split(regex);
                                                return (
                                                    <div key={i} className="p-3 rounded-xl bg-white/3 hover:bg-white/6 transition-all">
                                                        <Badge variant="outline" className="border-amber-500/20 text-amber-400 mb-2 text-[10px] font-bold">{v.reference}</Badge>
                                                        <p className="text-sm text-slate-300 leading-relaxed">
                                                            {parts.map((part, j) => regex.test(part) ? <mark key={j} className="bg-amber-500/25 text-amber-200 rounded px-0.5">{part}</mark> : <span key={j}>{part}</span>)}
                                                        </p>
                                                        <div className="flex gap-1 mt-2">
                                                            <Button variant="ghost" size="sm" className="h-7 text-[10px] rounded-lg gap-1" onClick={(e) => { e.stopPropagation(); onNavigate(bookResult.bookId, `${bookResult.bookId}.${v.chapter}`); }}>
                                                                <BookOpen className="h-3 w-3" /> Lire
                                                            </Button>
                                                            <Button variant="ghost" size="sm" className="h-7 text-[10px] rounded-lg gap-1" onClick={(e) => { e.stopPropagation(); copyVerse(v.text, v.reference); }}>
                                                                <Copy className="h-3 w-3" /> Copier
                                                            </Button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : hasSearched && !isSearching ? (
                    <div className="text-center py-16">
                        <Search className="h-12 w-12 mx-auto mb-4 text-slate-700" />
                        <p className="font-bold text-slate-400">Aucun résultat pour &laquo; {query} &raquo;</p>
                    </div>
                ) : (
                    <div className="text-center py-16">
                        <div className="w-20 h-20 rounded-3xl bg-linear-to-br from-amber-500/10 to-orange-500/10 flex items-center justify-center mx-auto mb-5">
                            <Search className="h-9 w-9 text-amber-400/50" />
                        </div>
                        <p className="font-bold text-slate-300 mb-2">Recherche dans toute la Bible</p>
                        <p className="text-sm text-slate-500 max-w-xs mx-auto">Tapez un mot pour voir tous les livres et versets qui le contiennent.</p>
                    </div>
                )}
            </ScrollArea>
        </motion.div>
    );
}
