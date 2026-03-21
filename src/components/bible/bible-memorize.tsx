'use client';

import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Brain, RotateCcw, Check, X, Zap, Eye, EyeOff, Trash2, BookOpen, Sparkles, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useReadingPlanStore, MemoryCard, SRSRating } from "@/lib/reading-plans";

export function BibleMemorize() {
    const { memoryCards, removeMemoryCard, reviewCard, getDueCards, getCardStats } = useReadingPlanStore();
    const [mode, setMode] = useState<'list' | 'review'>('list');
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [showAnswer, setShowAnswer] = useState(false);
    const [dueCards, setDueCards] = useState<MemoryCard[]>([]);
    const [sessionComplete, setSessionComplete] = useState(false);
    const [sessionStats, setSessionStats] = useState({ reviewed: 0, correct: 0 });
    const stats = getCardStats();

    useEffect(() => {
        setDueCards(getDueCards());
    }, [memoryCards]);

    const startReview = () => {
        const due = getDueCards();
        if (due.length === 0) { toast.info("Aucune carte à revoir pour le moment !"); return; }
        setDueCards(due);
        setCurrentCardIndex(0);
        setShowAnswer(false);
        setSessionComplete(false);
        setSessionStats({ reviewed: 0, correct: 0 });
        setMode('review');
    };

    const handleRating = (rating: SRSRating) => {
        const card = dueCards[currentCardIndex];
        reviewCard(card.id, rating);
        const isCorrect = rating === 'good' || rating === 'easy';
        setSessionStats(s => ({ reviewed: s.reviewed + 1, correct: s.correct + (isCorrect ? 1 : 0) }));

        if (currentCardIndex + 1 >= dueCards.length) {
            setSessionComplete(true);
        } else {
            setCurrentCardIndex(i => i + 1);
            setShowAnswer(false);
        }
    };

    const ratingButtons: { rating: SRSRating; label: string; desc: string; color: string; icon: React.ReactNode }[] = [
        { rating: 'again', label: 'À revoir', desc: '< 1 min', color: 'from-red-500/20 to-red-600/10 border-red-500/20 text-red-400', icon: <RotateCcw className="h-4 w-4" /> },
        { rating: 'hard', label: 'Difficile', desc: '~1 jour', color: 'from-orange-500/20 to-orange-600/10 border-orange-500/20 text-orange-400', icon: <X className="h-4 w-4" /> },
        { rating: 'good', label: 'Bien', desc: '~3 jours', color: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/20 text-emerald-400', icon: <Check className="h-4 w-4" /> },
        { rating: 'easy', label: 'Facile', desc: '~7 jours', color: 'from-indigo-500/20 to-indigo-600/10 border-indigo-500/20 text-indigo-400', icon: <Zap className="h-4 w-4" /> },
    ];

    // Session complete screen
    if (mode === 'review' && sessionComplete) {
        const accuracy = sessionStats.reviewed > 0 ? Math.round((sessionStats.correct / sessionStats.reviewed) * 100) : 0;
        return (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col items-center justify-center px-8">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 flex items-center justify-center mb-6">
                    <Sparkles className="h-12 w-12 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-black text-white mb-2">Session terminée !</h2>
                <p className="text-slate-400 text-sm mb-8">Excellent travail de mémorisation.</p>
                <div className="grid grid-cols-2 gap-4 w-full max-w-xs mb-8">
                    <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-4 text-center">
                        <p className="text-2xl font-black text-white">{sessionStats.reviewed}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Révisés</p>
                    </div>
                    <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-4 text-center">
                        <p className="text-2xl font-black text-emerald-400">{accuracy}%</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Précision</p>
                    </div>
                </div>
                <Button className="w-full max-w-xs h-12 rounded-2xl bg-gradient-to-r from-purple-600 to-fuchsia-600 font-bold" onClick={() => setMode('list')}>
                    Retour aux cartes
                </Button>
            </motion.div>
        );
    }

    // Review mode (flashcard)
    if (mode === 'review' && dueCards.length > 0) {
        const card = dueCards[currentCardIndex];
        return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col overflow-hidden">
                {/* Progress */}
                <div className="px-5 pt-4 pb-2">
                    <div className="flex items-center justify-between mb-2">
                        <Button variant="ghost" size="sm" className="rounded-xl text-slate-400 gap-1.5" onClick={() => setMode('list')}>
                            <X className="h-4 w-4" /> Quitter
                        </Button>
                        <span className="text-xs font-bold text-slate-500">{currentCardIndex + 1} / {dueCards.length}</span>
                    </div>
                    <Progress value={((currentCardIndex + 1) / dueCards.length) * 100} className="h-1.5 bg-white/[0.06] rounded-full [&>div]:bg-gradient-to-r [&>div]:from-purple-500 [&>div]:to-fuchsia-500 [&>div]:rounded-full" />
                </div>

                {/* Flashcard */}
                <div className="flex-1 flex flex-col items-center justify-center px-6">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={`${card.id}-${showAnswer}`}
                            initial={{ rotateY: 90, opacity: 0 }}
                            animate={{ rotateY: 0, opacity: 1 }}
                            exit={{ rotateY: -90, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="w-full max-w-md"
                        >
                            <div className={cn(
                                "relative overflow-hidden rounded-3xl border p-8 min-h-[280px] flex flex-col items-center justify-center text-center transition-all",
                                showAnswer
                                    ? "bg-gradient-to-br from-purple-600/15 via-fuchsia-600/10 to-transparent border-purple-500/15"
                                    : "bg-gradient-to-br from-indigo-600/15 via-violet-600/10 to-transparent border-indigo-500/15"
                            )}>
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.08),transparent_70%)]" />
                                <div className="relative">
                                    {!showAnswer ? (
                                        <>
                                            <Badge variant="outline" className="border-indigo-500/20 text-indigo-400 text-[10px] font-bold mb-6">
                                                {card.reference}
                                            </Badge>
                                            <p className="text-lg text-slate-300 mb-6">Quel est ce verset ?</p>
                                            <Button onClick={() => setShowAnswer(true)} className="rounded-2xl h-12 px-8 bg-white/10 hover:bg-white/15 font-bold gap-2 border border-white/10">
                                                <Eye className="h-4 w-4" /> Voir la réponse
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <Badge variant="outline" className="border-purple-500/20 text-purple-400 text-[10px] font-bold mb-4">
                                                {card.reference}
                                            </Badge>
                                            <p className="font-serif text-base text-white/90 italic leading-relaxed">
                                                &ldquo;{card.text}&rdquo;
                                            </p>
                                        </>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Rating buttons */}
                {showAnswer && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="px-5 py-4 bg-[#0B0E14]/80 backdrop-blur-xl border-t border-white/[0.06]">
                        <p className="text-center text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-3">Comment était-ce ?</p>
                        <div className="grid grid-cols-4 gap-2">
                            {ratingButtons.map(rb => (
                                <button key={rb.rating} onClick={() => handleRating(rb.rating)} className={cn("flex flex-col items-center gap-1 p-3 rounded-2xl bg-gradient-to-br border transition-all hover:scale-105", rb.color)}>
                                    {rb.icon}
                                    <span className="text-[10px] font-bold">{rb.label}</span>
                                    <span className="text-[8px] opacity-60">{rb.desc}</span>
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </motion.div>
        );
    }

    // Card list view
    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col overflow-hidden">
            {/* Stats */}
            <div className="px-5 pt-4 pb-2">
                <div className="grid grid-cols-4 gap-2 mb-4">
                    {[
                        { label: 'Total', value: stats.total, color: 'text-white', bg: 'from-slate-500/15 to-slate-600/10 border-white/[0.06]' },
                        { label: 'Nouveau', value: stats.new, color: 'text-indigo-400', bg: 'from-indigo-500/15 to-indigo-600/10 border-indigo-500/10' },
                        { label: 'En cours', value: stats.learning + stats.reviewing, color: 'text-amber-400', bg: 'from-amber-500/15 to-amber-600/10 border-amber-500/10' },
                        { label: 'Maîtrisé', value: stats.mastered, color: 'text-emerald-400', bg: 'from-emerald-500/15 to-emerald-600/10 border-emerald-500/10' },
                    ].map(s => (
                        <div key={s.label} className={cn("rounded-2xl bg-gradient-to-br border p-3 text-center", s.bg)}>
                            <p className={cn("text-xl font-black", s.color)}>{s.value}</p>
                            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">{s.label}</p>
                        </div>
                    ))}
                </div>

                {/* Review button */}
                {dueCards.length > 0 && (
                    <Button onClick={startReview} className="w-full h-14 rounded-2xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 font-bold text-base shadow-lg shadow-purple-600/20 gap-2 mb-4">
                        <Brain className="h-5 w-5" />
                        Réviser {dueCards.length} carte{dueCards.length > 1 ? 's' : ''}
                    </Button>
                )}
            </div>

            {/* Cards list */}
            <ScrollArea className="flex-1 px-5">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] mb-3">Vos cartes ({memoryCards.length})</h3>
                {memoryCards.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-500/10 to-fuchsia-500/10 flex items-center justify-center mx-auto mb-5">
                            <Brain className="h-9 w-9 text-purple-400/40" />
                        </div>
                        <p className="font-bold text-slate-300 mb-2">Pas encore de carte</p>
                        <p className="text-sm text-slate-500 max-w-xs mx-auto">Ouvrez un verset et appuyez sur 🧠 pour l&apos;ajouter à vos flashcards.</p>
                    </div>
                ) : (
                    <div className="space-y-2 pb-32">
                        {memoryCards.map((card, i) => {
                            const statusColors: Record<string, string> = {
                                'new': 'bg-indigo-500/20 text-indigo-400',
                                'learning': 'bg-amber-500/20 text-amber-400',
                                'reviewing': 'bg-sky-500/20 text-sky-400',
                                'mastered': 'bg-emerald-500/20 text-emerald-400',
                            };
                            const statusLabels: Record<string, string> = { 'new': 'Nouveau', 'learning': 'En cours', 'reviewing': 'Révision', 'mastered': 'Maîtrisé' };
                            const isDue = new Date(card.nextReview) <= new Date();

                            return (
                                <motion.div key={card.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="group p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-purple-500/15 transition-all">
                                    <div className="flex items-start justify-between mb-2">
                                        <Badge variant="outline" className="border-purple-500/20 text-purple-400 text-[10px] font-bold">{card.reference}</Badge>
                                        <div className="flex items-center gap-2">
                                            {isDue && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
                                            <Badge className={cn("text-[9px] border-none", statusColors[card.status])}>{statusLabels[card.status]}</Badge>
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-300 leading-relaxed font-serif italic line-clamp-2 mb-2">
                                        &ldquo;{card.text}&rdquo;
                                    </p>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[9px] text-slate-600">
                                            {card.repetitions > 0 ? `${card.repetitions} révisions • Prochain: ${new Date(card.nextReview).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` : 'Jamais révisé'}
                                        </span>
                                        <Button variant="ghost" size="sm" className="h-7 text-[10px] rounded-lg text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => { removeMemoryCard(card.id); toast.info('Carte retirée'); }}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </ScrollArea>
        </motion.div>
    );
}
