'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle2, Trophy, Clock, ArrowLeft, ArrowRight, Pause, Play } from 'lucide-react';
import confetti from 'canvas-confetti';
import { bibleApi, BibleVerse } from '@/lib/unified-bible-api';
import { cn } from '@/lib/utils';
import { Player } from './multiplayer-lobby';
import { addGameHistory } from '@/lib/game-history';

interface Word {
    id: string;
    text: string;
    status: 'hidden' | 'visible' | 'selected' | 'correct';
}

interface BibleMemoryGameProps {
    onBack: () => void;
    mode?: 'solo' | 'multiplayer';
    initialVerse?: BibleVerse;
    players?: Player[];
    currentUserId?: string;
    onProgress?: (pct: number) => void;
    onComplete?: (score: number) => void;
    isHost?: boolean;
    roundInfo?: { current: number, total: number };
    onNextRound?: () => void;
}

export function BibleMemoryGame({
    onBack,
    mode = 'solo',
    initialVerse,
    players = [],
    currentUserId,
    onProgress,
    onComplete,
    isHost,
    roundInfo,
    onNextRound
}: BibleMemoryGameProps) {
    const [verse, setVerse] = useState<BibleVerse | null>(initialVerse || null);
    const [shuffledWords, setShuffledWords] = useState<Word[]>([]);
    const [selectedWords, setSelectedWords] = useState<Word[]>([]);
    const [gameState, setGameState] = useState<'loading' | 'playing' | 'success'>('loading');
    const [originalVerse, setOriginalVerse] = useState<BibleVerse | null>(null);
    const [streak, setStreak] = useState(0);

    // Timer state
    const [startTime, setStartTime] = useState<number | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const pausedTimeRef = useRef(0);
    const lastPauseRef = useRef<number | null>(null);

    // Initial Load
    useEffect(() => {
        if (initialVerse) {
            setupGame(initialVerse);
        } else {
            loadNewVerse();
        }
    }, [initialVerse]);

    // Timer Logic
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (gameState === 'playing' && startTime && !isPaused) {
            interval = setInterval(() => {
                setElapsedTime(Math.floor((Date.now() - startTime - pausedTimeRef.current) / 1000));
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [gameState, startTime, isPaused]);

    const togglePause = () => {
        if (isPaused) {
            if (lastPauseRef.current) {
                pausedTimeRef.current += Date.now() - lastPauseRef.current;
                lastPauseRef.current = null;
            }
            setIsPaused(false);
        } else {
            lastPauseRef.current = Date.now();
            setIsPaused(true);
        }
    };

    // Format Time
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const setupGame = (verseData: BibleVerse) => {
        setOriginalVerse(verseData);
        setVerse(verseData);

        // Split text into words and shuffle
        const words = verseData.text.split(' ').map((text, index) => ({
            id: `${index}-${text}`,
            text,
            status: 'visible' as const
        }));

        setShuffledWords([...words].sort(() => Math.random() - 0.5));
        setSelectedWords([]);
        setGameState('playing');
        setStartTime(Date.now());
        setElapsedTime(0);
        if (onProgress) onProgress(0);
    };

    const loadNewVerse = async () => {
        setGameState('loading');
        try {
            const verseData = await bibleApi.getRandomVerse();
            setupGame(verseData);
        } catch (error) {
            console.error('Error loading verse:', error);
        }
    };

    const handleWordClick = (word: Word) => {
        if (gameState !== 'playing') return;

        // Remove from shuffled, add to selected
        const newShuffled = shuffledWords.filter(w => w.id !== word.id);
        const newSelected = [...selectedWords, word];

        setShuffledWords(newShuffled);
        setSelectedWords(newSelected);

        // Calculate progress based on words placed
        if (originalVerse && onProgress) {
            const totalWords = originalVerse.text.split(' ').length;
            const progress = Math.round((newSelected.length / totalWords) * 100);
            onProgress(Math.min(progress, 99)); // Cap at 99 until checked
        }
    };

    const handleWordRemove = (word: Word) => {
        if (gameState !== 'playing') return;

        // Remove from selected, add back to shuffled
        const newSelected = selectedWords.filter(w => w.id !== word.id);
        const newShuffled = [...shuffledWords, word]; // Could resort or just append

        setSelectedWords(newSelected);
        setShuffledWords(newShuffled);
    };

    const checkAnswer = () => {
        if (!originalVerse) return;

        const currentText = selectedWords.map(w => w.text).join(' ');
        if (currentText === originalVerse.text) {
            setGameState('success');
            setStreak(s => s + 1);
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });
            // Complete Logic
            if (onProgress) onProgress(100);

            // Save to game history
            const finalTime = Math.floor((Date.now() - (startTime || Date.now())) / 1000);
            addGameHistory({
                gameType: 'memory',
                score: Math.max(0, 400 - finalTime * 4),
                maxScore: 400,
                timeSeconds: finalTime,
                metadata: { reference: originalVerse?.reference, streak: streak + 1 },
            });

            if (mode === 'multiplayer' && onComplete) {
                onComplete(finalTime);
            }
        } else {
            // Shake effect or feedback (simple alert for now or UI state)
            const btn = document.getElementById('check-btn');
            if (btn) {
                btn.classList.add('animate-shake');
                setTimeout(() => btn.classList.remove('animate-shake'), 500);
            }
        }
    };

    return (
        <div className="flex flex-col h-full max-w-4xl mx-auto w-full p-4 relative">
            {/* Header / Top Bar */}
            <div className="flex justify-between items-center mb-6">
                <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-400 hover:text-white">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    {mode === 'multiplayer' ? 'Quitter la partie' : 'Retour'}
                </Button>

                <div className="flex items-center gap-4">
                    {gameState === 'playing' && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={togglePause}
                            className="h-9 w-9 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
                        >
                            <Pause className="h-4 w-4" />
                        </Button>
                    )}
                    <Badge variant="outline" className="text-lg font-mono text-cyan-400 border-cyan-500/50 px-3 py-1 gap-2">
                        <Clock className="w-4 h-4" />
                        {formatTime(elapsedTime)}
                    </Badge>
                    {mode === 'solo' && (
                        <div className="flex items-center gap-2 bg-orange-500/20 px-3 py-1 rounded-full border border-orange-500/30">
                            <Trophy className="w-4 h-4 text-orange-400" />
                            <span className="text-orange-400 font-bold">{streak}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Pause Overlay */}
            <AnimatePresence>
                {isPaused && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center"
                    >
                        <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="text-center">
                            <div className="w-24 h-24 rounded-full bg-purple-600/30 flex items-center justify-center mx-auto mb-6 border-2 border-purple-500/50">
                                <Pause className="h-12 w-12 text-purple-400" />
                            </div>
                            <h2 className="text-3xl font-black text-white mb-2">Pause</h2>
                            <p className="text-slate-400 mb-8">Le chronomètre est en pause</p>
                            <div className="flex flex-col gap-3">
                                <Button
                                    onClick={togglePause}
                                    className="bg-purple-600 hover:bg-purple-500 h-14 px-10 rounded-2xl text-lg font-bold gap-2"
                                >
                                    <Play className="h-5 w-5" />
                                    Reprendre
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => { setIsPaused(false); onBack(); }}
                                    className="text-slate-400 hover:text-white"
                                >
                                    <ArrowLeft className="h-4 w-4 mr-2" />
                                    Quitter le jeu
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Multiplayer Live Progress (Opponents) */}
            {mode === 'multiplayer' && players.length > 0 && gameState === 'playing' && (
                <div className="w-full mb-6 space-y-2 bg-black/20 p-4 rounded-xl border border-white/5">
                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Adversaires</h4>
                    {players.filter(p => p.id !== currentUserId).map(p => (
                        <div key={p.id} className="flex items-center gap-3 text-xs">
                            <div className="w-20 truncate text-slate-300 font-medium">{p.display_name}</div>
                            <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden relative">
                                <div
                                    className="h-full bg-indigo-500 transition-all duration-500 relative"
                                    style={{ width: `${p.progress}%` }}
                                >
                                    {p.progress >= 100 && (
                                        <div className="absolute right-0 top-0 bottom-0 flex items-center px-1">
                                            <CheckCircle2 className="w-3 h-3 text-white" />
                                        </div>
                                    )}
                                </div>
                            </div>
                            <span className="text-slate-500 w-8 text-right">{p.progress}%</span>
                        </div>
                    ))}
                </div>
            )}

            <Card className="flex-1 bg-white/5 border-white/10 backdrop-blur-sm shadow-xl overflow-hidden relative">
                <CardContent className="p-8 h-full flex flex-col items-center justify-center min-h-[400px]">
                    <AnimatePresence mode="wait">
                        {gameState === 'playing' ? (
                            <motion.div
                                key="playing"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="w-full max-w-2xl space-y-8"
                            >
                                <div className="space-y-2 text-center">
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                                        Reconstituez le verset
                                    </h3>
                                    <p className="text-indigo-400 font-medium">
                                        {verse?.reference}
                                    </p>
                                </div>

                                {/* Placeholder for selected words */}
                                <div className="min-h-[120px] bg-black/20 rounded-xl p-6 border-2 border-dashed border-white/10 flex flex-wrap gap-2 content-start transition-all hover:border-white/20">
                                    {selectedWords.length === 0 && (
                                        <p className="w-full text-center text-slate-600 italic mt-4 pointer-events-none">
                                            Cliquez sur les mots ci-dessous pour les placer ici...
                                        </p>
                                    )}
                                    {selectedWords.map((word) => (
                                        <motion.button
                                            layoutId={word.id}
                                            key={word.id}
                                            onClick={() => handleWordRemove(word)}
                                            className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-medium shadow-lg hover:bg-indigo-500 transition-colors text-lg"
                                        >
                                            {word.text}
                                        </motion.button>
                                    ))}
                                </div>

                                {/* Shuffled words pool */}
                                <div className="flex flex-wrap gap-2 justify-center">
                                    {shuffledWords.map((word) => (
                                        <motion.button
                                            layoutId={word.id}
                                            key={word.id}
                                            onClick={() => handleWordClick(word)}
                                            className="px-3 py-1.5 bg-white/10 text-slate-200 rounded-lg font-medium hover:bg-white/20 transition-colors border border-white/5 text-lg"
                                        >
                                            {word.text}
                                        </motion.button>
                                    ))}
                                </div>

                                <Button
                                    id="check-btn"
                                    className="w-full h-12 text-lg font-bold bg-green-600 hover:bg-green-500 shadow-lg shadow-green-900/20"
                                    onClick={checkAnswer}
                                    disabled={selectedWords.length === 0}
                                >
                                    <CheckCircle2 className="w-5 h-5 mr-2" />
                                    Vérifier
                                </Button>
                            </motion.div>
                        ) : gameState === 'success' ? (
                            <motion.div
                                key="success"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center space-y-6 flex flex-col items-center"
                            >
                                <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                                    <Trophy className="w-10 h-10 text-green-400" />
                                </div>
                                <h2 className="text-3xl font-black text-white">Excellent !</h2>

                                <blockquote className="text-2xl font-serif italic text-slate-300 max-w-lg leading-relaxed">
                                    "{originalVerse?.text}"
                                </blockquote>
                                <p className="text-indigo-400 font-bold text-lg">— {originalVerse?.reference}</p>

                                <div className="flex gap-4 items-center mt-4">
                                    <Badge variant="outline" className="bg-emerald-900/30 text-emerald-400 border-emerald-500/30 px-4 py-2 text-lg">
                                        <Clock className="w-4 h-4 mr-2" />
                                        {formatTime(elapsedTime)}
                                    </Badge>
                                </div>

                                {/* Multiplayer Leaderboard Logic */}
                                {mode === 'multiplayer' && (
                                    <div className="mt-6 w-full max-w-md bg-black/40 p-4 rounded-xl border border-white/10">
                                        <h4 className="text-sm font-bold text-slate-400 mb-4 uppercase tracking-wider">Classement Live</h4>
                                        <div className="space-y-3">
                                            {[...players]
                                                .sort((a, b) => {
                                                    // Logic: Finished players first (sorted by score asc), then others by progress desc
                                                    if (a.status === 'finished' && b.status !== 'finished') return -1;
                                                    if (b.status === 'finished' && a.status !== 'finished') return 1;
                                                    if (a.status === 'finished' && b.status === 'finished') return (a.score || 9999) - (b.score || 9999);
                                                    return b.progress - a.progress;
                                                })
                                                .map((p, i) => (
                                                    <div key={p.id} className={cn("flex items-center justify-between p-2 rounded-lg", p.id === currentUserId ? "bg-indigo-500/10 border border-indigo-500/30" : "bg-white/5")}>
                                                        <div className="flex items-center gap-3">
                                                            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-sm",
                                                                i === 0 ? "bg-amber-400 text-black" :
                                                                    i === 1 ? "bg-slate-300 text-black" :
                                                                        i === 2 ? "bg-amber-700 text-white" : "bg-slate-700 text-slate-300"
                                                            )}>
                                                                {i + 1}
                                                            </div>
                                                            <span className={cn("text-sm font-medium", p.id === currentUserId && "text-indigo-300 font-bold")}>
                                                                {p.display_name} {p.id === currentUserId && "(Moi)"}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {p.status === 'finished' ? (
                                                                <Badge className="bg-green-500/20 text-green-400 border-none px-2 h-6 font-mono">
                                                                    {formatTime(p.score)}
                                                                </Badge>
                                                            ) : (
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                                                        <div className="h-full bg-indigo-500" style={{ width: `${p.progress}%` }} />
                                                                    </div>
                                                                    <span className="text-xs text-slate-500">{p.progress}%</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                        <div className="mt-4 text-xs text-center text-slate-500 animate-pulse">
                                            {players.every(p => p.status === 'finished') ? "Partie terminée !" : "En attente des autres joueurs..."}
                                        </div>
                                    </div>
                                )}

                                {mode === 'solo' && (
                                    <Button onClick={loadNewVerse} size="lg" className="h-12 px-8 bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-900/20">
                                        <RefreshCw className="w-5 h-5 mr-2" />
                                        Verset Suivant
                                    </Button>
                                )}

                                {mode === 'multiplayer' && (
                                    <div className="flex flex-col gap-3 mt-6 w-full max-w-xs">
                                        {isHost && roundInfo && onNextRound && roundInfo.current < roundInfo.total ? (
                                            <Button onClick={onNextRound} className="w-full bg-green-600 hover:bg-green-500 h-12 font-bold shadow-lg shadow-green-900/20 animate-pulse">
                                                Manche Suivante ({roundInfo.current}/{roundInfo.total})
                                            </Button>
                                        ) : (
                                            <Button onClick={onBack} className="w-full bg-indigo-600 hover:bg-indigo-500 h-12 font-bold shadow-lg shadow-indigo-900/20">
                                                Retour au Salon (Revanche)
                                            </Button>
                                        )}
                                        <Button onClick={onBack} variant="ghost" className="w-full text-slate-500 hover:text-red-400 hover:bg-red-500/10">
                                            Quitter la partie
                                        </Button>
                                    </div>
                                )}
                            </motion.div>
                        ) : (
                            <div className="flex flex-col items-center justify-center space-y-4">
                                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                <p className="text-slate-400">Chargement...</p>
                            </div>
                        )}
                    </AnimatePresence>
                </CardContent>
            </Card>
        </div>
    );
}
