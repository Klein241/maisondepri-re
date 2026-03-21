'use client';

import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Star, PenLine, BookOpen, Copy, Share2, Trash2, MessageSquare, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { useBibleFavorites, useBibleHighlights, shareVerse, HIGHLIGHT_COLORS, HighlightColor } from "@/lib/bible-features";

interface BibleHighlightsNotesProps {
    onNavigate: (bookId: string, chapter: string) => void;
}

type SubTab = 'favorites' | 'highlights' | 'notes';

export function BibleHighlightsNotes({ onNavigate }: BibleHighlightsNotesProps) {
    const { user } = useAppStore();
    const { favorites, removeFavorite } = useBibleFavorites(user?.id);
    const { highlights, removeHighlight } = useBibleHighlights(user?.id);
    const [subTab, setSubTab] = useState<SubTab>('favorites');
    const [noteInput, setNoteInput] = useState<{ id: string; text: string } | null>(null);
    const { bibleNavigation, setBibleNavigation } = useAppStore();
    const books = require('@/lib/unified-bible-api').bibleApi.getBooks();

    const copyVerse = (text: string, ref: string) => {
        navigator.clipboard.writeText(`"${text}" - ${ref}`);
        toast.success("Copié !");
    };

    const navigateToVerse = (reference: string) => {
        const parts = reference.match(/^(.+?)\s+(\d+):(\d+)$/);
        if (parts) {
            const bookName = parts[1];
            const chapter = parts[2];
            const book = books.find((b: any) => b.name === bookName);
            if (book) onNavigate(book.id, `${book.id}.${chapter}`);
        }
    };

    // Group highlights by color
    const highlightsByColor: Record<string, typeof highlights> = {};
    highlights.forEach(h => {
        const color = h.color || 'yellow';
        if (!highlightsByColor[color]) highlightsByColor[color] = [];
        highlightsByColor[color].push(h);
    });

    const tabs: { id: SubTab; label: string; icon: React.ReactNode; count: number; color: string }[] = [
        { id: 'favorites', label: 'Favoris', icon: <Star className="h-3.5 w-3.5" />, count: favorites.length, color: 'amber' },
        { id: 'highlights', label: 'Surlignages', icon: <PenLine className="h-3.5 w-3.5" />, count: highlights.length, color: 'emerald' },
    ];

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col overflow-hidden">
            {/* Stats Cards */}
            <div className="px-5 pt-4 pb-2">
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500/15 to-orange-500/10 border border-amber-500/10 p-4">
                        <Star className="absolute top-3 right-3 h-8 w-8 text-amber-500/10" />
                        <p className="text-3xl font-black text-amber-400">{favorites.length}</p>
                        <p className="text-[10px] font-bold text-amber-400/60 uppercase tracking-wider mt-1">Versets favoris</p>
                    </div>
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/15 to-teal-500/10 border border-emerald-500/10 p-4">
                        <PenLine className="absolute top-3 right-3 h-8 w-8 text-emerald-500/10" />
                        <p className="text-3xl font-black text-emerald-400">{highlights.length}</p>
                        <p className="text-[10px] font-bold text-emerald-400/60 uppercase tracking-wider mt-1">Surlignages</p>
                    </div>
                </div>

                {/* Sub-tabs */}
                <div className="flex gap-1.5 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-1.5">
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => setSubTab(tab.id)} className={cn("flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold transition-all", subTab === tab.id ? `bg-${tab.color}-500/20 text-${tab.color}-400` : 'text-slate-500 hover:text-slate-300')}>
                            {tab.icon} {tab.label}
                            <span className={cn("ml-1 px-1.5 py-0.5 rounded-md text-[9px] font-black", subTab === tab.id ? `bg-${tab.color}-500/20` : 'bg-white/5')}>{tab.count}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1 px-5">
                <AnimatePresence mode="wait">
                    {/* Favorites */}
                    {subTab === 'favorites' && (
                        <motion.div key="fav" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3 pb-32 pt-2">
                            {favorites.length === 0 ? (
                                <div className="text-center py-16">
                                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 flex items-center justify-center mx-auto mb-5">
                                        <Star className="h-9 w-9 text-amber-400/40" />
                                    </div>
                                    <p className="font-bold text-slate-300 mb-2">Aucun favori</p>
                                    <p className="text-sm text-slate-500 max-w-xs mx-auto">Appuyez sur un verset pendant la lecture pour l&apos;ajouter en favori.</p>
                                </div>
                            ) : (
                                favorites.map((fav, i) => (
                                    <motion.div key={fav.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="group relative overflow-hidden rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-amber-500/20 transition-all duration-300">
                                        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <div className="relative p-4">
                                            <div className="flex items-start justify-between mb-2">
                                                <Badge variant="outline" className="border-amber-500/20 text-amber-400 text-[10px] font-bold gap-1">
                                                    ⭐ {fav.reference}
                                                </Badge>
                                                <span className="text-[9px] text-slate-600">
                                                    {new Date(fav.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-300 leading-relaxed mb-3 font-serif italic">
                                                &ldquo;{fav.text.length > 200 ? fav.text.substring(0, 200) + '...' : fav.text}&rdquo;
                                            </p>
                                            {fav.notes && (
                                                <div className="bg-white/[0.04] rounded-xl p-3 mb-3 border-l-2 border-amber-500/30">
                                                    <p className="text-xs text-slate-400"><MessageSquare className="h-3 w-3 inline mr-1.5 text-amber-400" />{fav.notes}</p>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-1">
                                                <Button variant="ghost" size="sm" className="h-7 text-[10px] rounded-lg gap-1 text-indigo-400" onClick={() => navigateToVerse(fav.reference)}>
                                                    <BookOpen className="h-3 w-3" /> Lire
                                                </Button>
                                                <Button variant="ghost" size="sm" className="h-7 text-[10px] rounded-lg gap-1" onClick={() => copyVerse(fav.text, fav.reference)}>
                                                    <Copy className="h-3 w-3" /> Copier
                                                </Button>
                                                <Button variant="ghost" size="sm" className="h-7 text-[10px] rounded-lg gap-1" onClick={() => shareVerse(fav.reference, fav.text, fav.translation)}>
                                                    <Share2 className="h-3 w-3" /> Partager
                                                </Button>
                                                <Button variant="ghost" size="sm" className="h-7 text-[10px] rounded-lg text-red-400 hover:text-red-300 ml-auto" onClick={() => { removeFavorite(fav.id); toast.info('Favori retiré'); }}>
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </motion.div>
                    )}

                    {/* Highlights */}
                    {subTab === 'highlights' && (
                        <motion.div key="hl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3 pb-32 pt-2">
                            {highlights.length === 0 ? (
                                <div className="text-center py-16">
                                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center mx-auto mb-5">
                                        <PenLine className="h-9 w-9 text-emerald-400/40" />
                                    </div>
                                    <p className="font-bold text-slate-300 mb-2">Aucun surlignage</p>
                                    <p className="text-sm text-slate-500 max-w-xs mx-auto">Sélectionnez un verset et choisissez une couleur pour le surligner.</p>
                                </div>
                            ) : (
                                <>
                                    {/* Color legend */}
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {Object.entries(highlightsByColor).map(([color, items]) => (
                                            <div key={color} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                                                <div className={cn("w-3 h-3 rounded-full", HIGHLIGHT_COLORS[color as HighlightColor]?.bgClass || 'bg-yellow-500/40')} />
                                                <span className="text-[10px] font-bold text-slate-400">{HIGHLIGHT_COLORS[color as HighlightColor]?.name || color} ({items.length})</span>
                                            </div>
                                        ))}
                                    </div>

                                    {highlights.map((h, i) => (
                                        <motion.div key={h.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className={cn("group relative overflow-hidden rounded-2xl border border-white/[0.06]", HIGHLIGHT_COLORS[h.color as HighlightColor]?.bgClass || 'bg-white/5')}>
                                            <div className="p-4">
                                                <div className="flex items-start justify-between mb-2">
                                                    <Badge variant="outline" className="border-white/15 text-slate-200 text-[10px] font-bold">{h.reference}</Badge>
                                                    <div className="flex items-center gap-2">
                                                        <div className={cn("w-3 h-3 rounded-full", `bg-${h.color}-500`)} />
                                                        <span className="text-[9px] text-slate-500 capitalize">{HIGHLIGHT_COLORS[h.color as HighlightColor]?.name || h.color}</span>
                                                    </div>
                                                </div>
                                                <p className="text-sm text-slate-200 leading-relaxed mb-3 font-serif italic">
                                                    &ldquo;{h.text.length > 200 ? h.text.substring(0, 200) + '...' : h.text}&rdquo;
                                                </p>
                                                <div className="flex items-center gap-1">
                                                    <Button variant="ghost" size="sm" className="h-7 text-[10px] rounded-lg gap-1" onClick={() => navigateToVerse(h.reference)}>
                                                        <BookOpen className="h-3 w-3" /> Lire
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="h-7 text-[10px] rounded-lg gap-1" onClick={() => copyVerse(h.text, h.reference)}>
                                                        <Copy className="h-3 w-3" /> Copier
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="h-7 text-[10px] rounded-lg text-red-400 hover:text-red-300 ml-auto" onClick={() => { removeHighlight(h.id); toast.info('Surlignage retiré'); }}>
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </ScrollArea>
        </motion.div>
    );
}
