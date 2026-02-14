'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, HelpCircle, Trophy, CheckCircle2, Pause, Play } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from '@/lib/utils';
import { Player } from './multiplayer-lobby';
import { WHO_AM_I_CHARACTERS } from '@/lib/game-data';
import { addGameHistory } from '@/lib/game-history';

interface Character {
    id: string;
    name: string;
    clues: string[];
}

interface WhoAmIGameProps {
    onBack: () => void;
    mode?: 'solo' | 'multiplayer';
    characters: Character[];
    players?: Player[];
    currentUserId?: string;
    onProgress?: (pct: number) => void;
    onComplete?: (score: number) => void;
    isHost?: boolean;
    roundInfo?: { current: number, total: number };
    onNextRound?: () => void;
}

export function WhoAmIGame({
    onBack,
    mode = 'solo',
    characters = [],
    players = [],
    currentUserId,
    onProgress,
    onComplete,
    isHost,
    roundInfo,
    onNextRound
}: WhoAmIGameProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [gameState, setGameState] = useState<'playing' | 'finished'>('playing');
    const [startTime] = useState(Date.now());
    const [elapsedTime, setElapsedTime] = useState(0);
    const [currentClueIndex, setCurrentClueIndex] = useState(0);
    const [options, setOptions] = useState<string[]>([]);
    const [isPaused, setIsPaused] = useState(false);
    const pausedTimeRef = useRef(0);
    const lastPauseRef = useRef<number | null>(null);

    useEffect(() => {
        if (gameState !== 'playing' || isPaused) return;
        const interval = setInterval(() => {
            setElapsedTime(Math.floor((Date.now() - startTime - pausedTimeRef.current) / 1000));
        }, 1000);
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

    useEffect(() => {
        if (!characters[currentIndex]) return;

        const target = characters[currentIndex];
        const others = WHO_AM_I_CHARACTERS.filter(c => c.name !== target.name);
        const distractors = others.sort(() => 0.5 - Math.random()).slice(0, 3).map(c => c.name);
        const all = [...distractors, target.name].sort(() => 0.5 - Math.random());
        setOptions(all);
        setCurrentClueIndex(0);
    }, [currentIndex, characters]);

    useEffect(() => {
        if (gameState !== 'playing' || isPaused) return;
        const interval = setInterval(() => {
            setCurrentClueIndex(prev => Math.min(prev + 1, 2));
        }, 5000);
        return () => clearInterval(interval);
    }, [currentIndex, gameState, isPaused]);

    const handleGuess = (name: string) => {
        const target = characters[currentIndex];
        if (name === target.name) {
            if (currentIndex < characters.length - 1) {
                setCurrentIndex(prev => prev + 1);
                const pct = Math.round(((currentIndex + 1) / characters.length) * 100);
                if (onProgress) onProgress(pct);
            } else {
                setGameState('finished');
                const timeTaken = Math.floor((Date.now() - startTime) / 1000);
                if (onComplete) onComplete(timeTaken);
                if (onProgress) onProgress(100);

                // Save to game history
                addGameHistory({
                    gameType: 'who_am_i',
                    score: Math.max(0, 300 - timeTaken * 5),
                    maxScore: 300,
                    timeSeconds: timeTaken,
                });

                confetti();
            }
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#0B0E14] to-[#1a1f2e] text-white p-6 flex flex-col items-center">
            <div className="w-full max-w-2xl flex items-center justify-between mb-8">
                <Button variant="ghost" onClick={onBack}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Quitter
                </Button>
                <div className="flex items-center gap-3">
                    {gameState === 'playing' && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={togglePause}
                            className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
                        >
                            <Pause className="h-5 w-5" />
                        </Button>
                    )}
                    <Badge variant="outline" className="text-xl font-mono text-cyan-400 border-cyan-500/50 px-3 py-1">
                        {formatTime(elapsedTime)}
                    </Badge>
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
                            <div className="w-24 h-24 rounded-full bg-amber-600/30 flex items-center justify-center mx-auto mb-6 border-2 border-amber-500/50">
                                <Pause className="h-12 w-12 text-amber-400" />
                            </div>
                            <h2 className="text-3xl font-black text-white mb-2">Pause</h2>
                            <p className="text-slate-400 mb-8">Le chronomètre est en pause</p>
                            <div className="flex flex-col gap-3">
                                <Button
                                    onClick={togglePause}
                                    className="bg-amber-600 hover:bg-amber-500 h-14 px-10 rounded-2xl text-lg font-bold gap-2"
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
                <div className="w-full max-w-2xl mb-6 space-y-2 bg-black/20 p-4 rounded-xl border border-white/5">
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

            <Card className="w-full max-w-2xl bg-white/5 border-white/10 backdrop-blur-sm shadow-xl min-h-[400px]">
                <CardContent className="p-8 flex flex-col items-center justify-center min-h-[400px]">
                    {gameState === 'playing' && characters[currentIndex] && (
                        <div className="w-full space-y-8">
                            <div className="text-center">
                                <Badge variant="secondary" className="mb-4">Personnage {currentIndex + 1}/{characters.length}</Badge>
                                <div className="space-y-4">
                                    <div className={cn("text-xl transition-all duration-500", currentClueIndex >= 0 ? "opacity-100" : "opacity-0 blur-sm")}>
                                        Indices:
                                    </div>
                                    <Card className="bg-indigo-500/10 border-indigo-500/30 p-4 min-h-[160px]">
                                        <ul className="space-y-3 text-left">
                                            {characters[currentIndex].clues.map((clue, i) => (
                                                <motion.li
                                                    key={i}
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: i <= currentClueIndex ? 1 : 0, x: i <= currentClueIndex ? 0 : -20 }}
                                                    className="flex items-start gap-2"
                                                >
                                                    <HelpCircle className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
                                                    <span className="text-lg">{clue}</span>
                                                </motion.li>
                                            ))}
                                        </ul>
                                    </Card>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mt-8">
                                {options.map((opt, i) => (
                                    <Button
                                        key={i}
                                        onClick={() => handleGuess(opt)}
                                        className="h-14 text-lg bg-white/10 hover:bg-indigo-600 hover:text-white transition-all"
                                    >
                                        {opt}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}

                    {gameState === 'finished' && (
                        <div className="text-center space-y-6 w-full">
                            <Trophy className="w-20 h-20 text-amber-400 mx-auto animate-bounce" />
                            <h2 className="text-3xl font-black">Terminé !</h2>
                            <p className="text-xl text-slate-300">Temps: <span className="text-white font-bold">{formatTime(elapsedTime)}</span></p>

                            {/* Multiplayer Leaderboard Logic */}
                            {mode === 'multiplayer' && (
                                <div className="mt-8 w-full max-w-md mx-auto bg-black/40 p-4 rounded-xl border border-white/10 shadow-inner">
                                    <h4 className="text-sm font-bold text-slate-400 mb-4 uppercase tracking-wider text-center">Classement Live</h4>
                                    <div className="space-y-3">
                                        {[...players]
                                            .sort((a, b) => {
                                                if (a.status === 'finished' && b.status !== 'finished') return -1;
                                                if (b.status === 'finished' && a.status !== 'finished') return 1;
                                                if (a.status === 'finished' && b.status === 'finished') return (a.score || 9999) - (b.score || 9999);
                                                return b.progress - a.progress;
                                            })
                                            .map((p, i) => (
                                                <div key={p.id} className={cn("flex items-center justify-between p-3 rounded-lg", p.id === currentUserId ? "bg-indigo-500/10 border border-indigo-500/30" : "bg-white/5")}>
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
                                    <div className="mt-4 text-xs text-center text-slate-500 animate-pulse font-mono">
                                        {players.every(p => p.status === 'finished') ? "🏁 TOUS LES JOUEURS ONT TERMINÉ" : "⏳ EN ATTENTE DES AUTRES JOUEURS..."}
                                    </div>
                                </div>
                            )}

                            {mode === 'solo' && <Button onClick={onBack} size="lg" className="bg-indigo-600 mt-6">Retour</Button>}
                            {mode === 'multiplayer' && (
                                <div className="flex flex-col gap-3 mt-6 w-full max-w-xs mx-auto">
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
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
