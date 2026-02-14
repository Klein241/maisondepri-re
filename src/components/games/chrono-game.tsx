'use client';

import { useState, useEffect } from 'react';
import { Reorder } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, GripVertical, CheckCircle2, XCircle, Trophy, Clock } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from '@/lib/utils';
import { Player } from './multiplayer-lobby';
import { CHRONO_EVENTS } from '@/lib/game-data';
import { addGameHistory } from '@/lib/game-history';

interface ChronoEvent {
    id: string;
    event: string;
    year: string;
}

interface ChronoGameProps {
    onBack: () => void;
    mode?: 'solo' | 'multiplayer';
    events: ChronoEvent[];
    players?: Player[];
    currentUserId?: string;
    onProgress?: (pct: number) => void;
    onComplete?: (score: number) => void;
    isHost?: boolean;
    roundInfo?: { current: number, total: number };
    onNextRound?: () => void;
}

export function ChronoGame({
    onBack,
    mode = 'solo',
    events = [],
    players = [],
    currentUserId,
    onProgress,
    onComplete,
    isHost,
    roundInfo,
    onNextRound
}: ChronoGameProps) {
    const [items, setItems] = useState<ChronoEvent[]>(events);
    const [gameState, setGameState] = useState<'playing' | 'finished'>('playing');
    const [startTime] = useState(Date.now());
    const [elapsedTime, setElapsedTime] = useState(0);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'wrong'>('none');

    useEffect(() => {
        setItems(events);
    }, [events]);

    useEffect(() => {
        if (gameState !== 'playing') return;
        const interval = setInterval(() => {
            setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [gameState, startTime]);

    const handleCheck = () => {
        let correct = true;
        for (let i = 0; i < items.length - 1; i++) {
            const indexA = CHRONO_EVENTS.findIndex(e => e.id === items[i].id);
            const indexB = CHRONO_EVENTS.findIndex(e => e.id === items[i + 1].id);
            if (indexA > indexB) {
                correct = false;
                break;
            }
        }

        if (correct) {
            setFeedback('success');
            setGameState('finished');
            const timeTaken = Math.floor((Date.now() - startTime) / 1000);
            if (onComplete) onComplete(timeTaken);
            if (onProgress) onProgress(100);

            // Save to game history
            addGameHistory({
                gameType: 'chrono',
                score: Math.max(0, 300 - timeTaken * 5),
                maxScore: 300,
                timeSeconds: timeTaken,
            });

            confetti();
        } else {
            setFeedback('wrong');
            setTimeout(() => setFeedback('none'), 1500);
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
                <Badge variant="outline" className="text-xl font-mono text-cyan-400 border-cyan-500/50 px-3 py-1">
                    {formatTime(elapsedTime)}
                </Badge>
            </div>

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

            <Card className="w-full max-w-md bg-white/5 border-white/10 backdrop-blur-sm shadow-xl">
                <CardContent className="p-6">
                    {gameState === 'playing' ? (
                        <>
                            <div className="text-center mb-6">
                                <h3 className="text-xl font-bold mb-2">Chronologie</h3>
                                <p className="text-slate-400 text-sm">Classez les événements du plus ancien au plus récent</p>
                            </div>

                            <Reorder.Group axis="y" values={items} onReorder={setItems} className="space-y-3 mb-8">
                                {items.map((item) => (
                                    <Reorder.Item
                                        key={item.id}
                                        value={item}
                                        className="bg-white/10 rounded-xl p-4 flex items-center gap-4 cursor-grab active:cursor-grabbing border border-white/5 hover:bg-white/15 select-none"
                                    >
                                        <GripVertical className="text-slate-500" />
                                        <div className="font-medium">{item.event}</div>
                                    </Reorder.Item>
                                ))}
                            </Reorder.Group>

                            <Button
                                onClick={handleCheck}
                                className={cn(
                                    "w-full h-12 text-lg font-bold transition-all",
                                    feedback === 'wrong' ? "bg-red-600 hover:bg-red-600 animate-shake" : "bg-indigo-600 hover:bg-indigo-500",
                                    feedback === 'success' && "bg-green-600"
                                )}
                            >
                                {feedback === 'wrong' ? <><XCircle className="mr-2" /> Incorrect</> :
                                    feedback === 'success' ? <><CheckCircle2 className="mr-2" /> Bravo !</> : "Valider"}
                            </Button>
                        </>
                    ) : (
                        <div className="text-center space-y-6 py-8">
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
