'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckCircle2, Trophy, Clock, Search, RefreshCw, Star, Pause, Play } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from '@/lib/utils';
import { Player } from './multiplayer-lobby';
import { generateWordSearch } from '@/lib/word-search-generator';
import { addGameHistory } from '@/lib/game-history';

interface WordSearchGameProps {
    onBack: () => void;
    mode?: 'solo' | 'multiplayer';
    grid?: string[][]; // Optional now, generated if missing
    words?: string[]; // Optional now
    players?: Player[];
    currentUserId?: string;
    onProgress?: (pct: number) => void;
    onComplete?: (score: number) => void;
    isHost?: boolean;
    roundInfo?: { current: number, total: number };
    onNextRound?: () => void;
}

import { getWordSearchWords } from '@/lib/game-data';

// ... (keep unused imports if any, but we are replacing imports too potentially)

// Removed DEFAULT_WORDS internal constant in favor of dynamic generator

// Colors for found words highlights
const HIGHLIGHT_COLORS = [
    'bg-red-500/40', 'bg-blue-500/40', 'bg-green-500/40', 'bg-yellow-500/40',
    'bg-purple-500/40', 'bg-pink-500/40', 'bg-indigo-500/40', 'bg-orange-500/40'
];

export function WordSearchGame({
    onBack,
    mode = 'solo',
    grid: initialGrid,
    words: initialWords,
    players = [],
    currentUserId,
    onProgress,
    onComplete,
    isHost,
    roundInfo,
    onNextRound
}: WordSearchGameProps) {
    const [grid, setGrid] = useState<string[][]>(initialGrid || []);
    const [wordList, setWordList] = useState<string[]>(initialWords || []);
    const [foundWords, setFoundWords] = useState<string[]>([]);
    const [foundLines, setFoundLines] = useState<{ start: { r: number, c: number }, end: { r: number, c: number }, colorIndex: number }[]>([]);

    const [selection, setSelection] = useState<{ start: { r: number, c: number } | null, end: { r: number, c: number } | null }>({ start: null, end: null });
    const [isSelecting, setIsSelecting] = useState(false);

    const [gameState, setGameState] = useState<'loading' | 'playing' | 'finished'>('loading');
    const [startTime, setStartTime] = useState(Date.now());
    const [elapsedTime, setElapsedTime] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const pausedTimeRef = useRef(0);
    const lastPauseRef = useRef<number | null>(null);

    // Initialize Game
    useEffect(() => {
        if (!initialGrid || !initialWords) {
            // Generate dynamic words from our expanded list
            const randomWords = getWordSearchWords(12); // Get 12 random words

            const { grid: newGrid, placedWords } = generateWordSearch(randomWords, {
                width: 10, // Slightly smaller for mobile friendliness
                height: 12,
                directions: ['horizontal', 'vertical', 'diagonal-down', 'diagonal-up']
            });
            setGrid(newGrid);
            setWordList(placedWords); // Only use placed words
        } else {
            setGrid(initialGrid);
            setWordList(initialWords);
        }
        setGameState('playing');
        setStartTime(Date.now());
    }, [initialGrid, initialWords]);

    // Timer
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

    const getSelectedWord = (start: { r: number, c: number }, end: { r: number, c: number }) => {
        if (!start || !end) return '';
        const dr = end.r - start.r;
        const dc = end.c - start.c;

        // Check for valid directions: Horizontal, Vertical, Diagonal
        // Diagonal means |dr| == |dc|
        if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return '';

        const length = Math.max(Math.abs(dr), Math.abs(dc)); // Distance (steps)
        const steps = length; // Number of characters is steps + 1

        const stepR = dr === 0 ? 0 : dr / Math.abs(dr);
        const stepC = dc === 0 ? 0 : dc / Math.abs(dc);

        let word = '';
        for (let i = 0; i <= steps; i++) {
            const r = start.r + i * stepR;
            const c = start.c + i * stepC;
            if (grid[r] && grid[r][c]) {
                word += grid[r][c];
            }
        }
        return word;
    };

    const handleCellAction = (r: number, c: number, type: 'start' | 'move' | 'end') => {
        if (gameState !== 'playing') return;

        if (type === 'start') {
            setIsSelecting(true);
            setSelection({ start: { r, c }, end: { r, c } });
        } else if (type === 'move' && isSelecting && selection.start) {
            // Snapping logic for diagonals to improve UX
            const dr = r - selection.start.r;
            const dc = c - selection.start.c;

            let finalR = r;
            let finalC = c;

            // If dragging roughly diagonal, snap to perfect diagonal
            if (Math.abs(dr) > 0 && Math.abs(dc) > 0) {
                if (Math.abs(Math.abs(dr) - Math.abs(dc)) < 3) {
                    // Force diagonal
                    const maxDelta = Math.max(Math.abs(dr), Math.abs(dc));
                    const signR = Math.sign(dr);
                    const signC = Math.sign(dc);
                    finalR = selection.start.r + (maxDelta * signR);
                    finalC = selection.start.c + (maxDelta * signC);
                }
            }

            setSelection(prev => ({ ...prev, end: { r: finalR, c: finalC } }));
        } else if (type === 'end' && isSelecting && selection.start) {
            const finalEnd = { r, c };
            setIsSelecting(false);

            const word = getSelectedWord(selection.start, finalEnd);

            if (word) {
                // Check normal and reverse
                const reversedWord = word.split('').reverse().join('');

                let found = null;
                if (wordList.includes(word) && !foundWords.includes(word)) found = word;
                if (wordList.includes(reversedWord) && !foundWords.includes(reversedWord)) found = reversedWord;

                if (found) {
                    const newFound = [...foundWords, found];
                    setFoundWords(newFound);

                    // Add permanent highlight line
                    setFoundLines(prev => [...prev, {
                        start: selection.start!,
                        end: finalEnd,
                        colorIndex: prev.length % HIGHLIGHT_COLORS.length
                    }]);

                    // Progress callback
                    const pct = Math.round((newFound.length / wordList.length) * 100);
                    if (onProgress) onProgress(pct);

                    // Win condition
                    if (newFound.length === wordList.length) {
                        setGameState('finished');
                        const timeTaken = Math.floor((Date.now() - startTime) / 1000);
                        if (onComplete) onComplete(timeTaken);

                        // Save to game history
                        addGameHistory({
                            gameType: 'word_search',
                            score: Math.max(0, 500 - timeTaken * 3),
                            maxScore: 500,
                            timeSeconds: timeTaken,
                        });

                        confetti({
                            particleCount: 100,
                            spread: 70,
                            origin: { y: 0.6 }
                        });
                    } else {
                        // Small confetti for finding a word
                        confetti({
                            particleCount: 30,
                            spread: 50,
                            origin: { x: (c / grid[0].length), y: (r / grid.length) * 0.5 + 0.2 }, // Rough position
                            scalar: 0.7
                        });
                    }
                }
            }
            setSelection({ start: null, end: null });
        }
    };

    // Calculate selection line style for current drag
    const getSelectionStyle = () => {
        if (!selection.start || !selection.end) return {};

        // This is tricky in a grid div layout. 
        // Instead, we mark cells as selected in the render loop 'isCellSelected'
        return {};
    }

    const isCellSelected = (r: number, c: number) => {
        if (!selection.start || !selection.end) return false;
        const { start, end } = selection;

        const dr = end.r - start.r;
        const dc = end.c - start.c;

        if (dr === 0 && dc === 0) return r === start.r && c === start.c;

        // Check bounds like before, but stricter for diagonals
        const steps = Math.max(Math.abs(dr), Math.abs(dc));

        const stepR = dr === 0 ? 0 : dr / Math.abs(dr);
        const stepC = dc === 0 ? 0 : dc / Math.abs(dc);

        // Check if we are on the line
        for (let i = 0; i <= steps; i++) {
            if (start.r + Math.round(i * stepR) === r && start.c + Math.round(i * stepC) === c) return true;
        }

        return false;
    };

    // Helper to find if a cell is part of a found word
    const getFoundLineColor = (r: number, c: number) => {
        // Reverse iterate to show latest on top
        for (let i = foundLines.length - 1; i >= 0; i--) {
            const line = foundLines[i];
            const { start, end } = line;

            const dr = end.r - start.r;
            const dc = end.c - start.c;
            const steps = Math.max(Math.abs(dr), Math.abs(dc));
            const stepR = dr === 0 ? 0 : dr / Math.abs(dr);
            const stepC = dc === 0 ? 0 : dc / Math.abs(dc);

            for (let j = 0; j <= steps; j++) {
                if (start.r + Math.round(j * stepR) === r && start.c + Math.round(j * stepC) === c) {
                    return HIGHLIGHT_COLORS[line.colorIndex];
                }
            }
        }
        return null;
    }

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const restartGame = () => {
        const randomWords = getWordSearchWords(12);

        const { grid: newGrid, placedWords } = generateWordSearch(randomWords, {
            width: 10,
            height: 12,
            directions: ['horizontal', 'vertical', 'diagonal-down', 'diagonal-up']
        });
        setGrid(newGrid);
        setWordList(placedWords);
        setFoundWords([]);
        setFoundLines([]);
        setSelection({ start: null, end: null });
        setGameState('playing');
        setStartTime(Date.now());
        setElapsedTime(0);
    }

    if (gameState === 'loading') {
        return (
            <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#0B0E14] to-[#1a1f2e] text-white p-4 flex flex-col items-center select-none">
            {/* Header */}
            <div className="w-full max-w-lg flex items-center justify-between mb-4">
                <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-400 hover:text-white">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Retour
                </Button>

                <div className="flex gap-3">
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
                    <Badge variant="outline" className="bg-white/5 font-mono text-cyan-400 border-cyan-500/30">
                        <Clock className="w-3.5 h-3.5 mr-1.5" />
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
                            <div className="w-24 h-24 rounded-full bg-green-600/30 flex items-center justify-center mx-auto mb-6 border-2 border-green-500/50">
                                <Pause className="h-12 w-12 text-green-400" />
                            </div>
                            <h2 className="text-3xl font-black text-white mb-2">Pause</h2>
                            <p className="text-slate-400 mb-8">Le chronomètre est en pause</p>
                            <div className="flex flex-col gap-3">
                                <Button
                                    onClick={togglePause}
                                    className="bg-green-600 hover:bg-green-500 h-14 px-10 rounded-2xl text-lg font-bold gap-2"
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

            {/* Main Game Area */}
            <div className="flex flex-col gap-6 w-full max-w-lg items-center">
                {/* Grid Card */}
                <Card className="bg-[#13161c] border-white/10 shadow-2xl p-3 sm:p-5 rounded-2xl w-full aspect-square sm:aspect-auto max-w-[400px] sm:max-w-none relative overflow-hidden">
                    <div
                        className="grid gap-1 h-full w-full"
                        style={{
                            gridTemplateColumns: `repeat(${grid[0]?.length || 1}, minmax(0, 1fr))`,
                            gridTemplateRows: `repeat(${grid.length || 1}, minmax(0, 1fr))`
                        }}
                        onMouseLeave={() => { if (isSelecting) handleCellAction(0, 0, 'end'); }}
                    >
                        {grid.map((row, r) => row.map((char, c) => {
                            const isSelected = isCellSelected(r, c);
                            const foundColor = getFoundLineColor(r, c);

                            return (
                                <div
                                    key={`${r}-${c}`}
                                    onMouseDown={() => handleCellAction(r, c, 'start')}
                                    onMouseEnter={() => handleCellAction(r, c, 'move')}
                                    onMouseUp={() => handleCellAction(r, c, 'end')}
                                    onTouchStart={(e) => {
                                        // e.preventDefault(); // Prevent scrolling while playing
                                        handleCellAction(r, c, 'start');
                                    }}
                                    onTouchMove={(e) => {
                                        // e.preventDefault();
                                        const touch = e.touches[0];
                                        const element = document.elementFromPoint(touch.clientX, touch.clientY);
                                        const rAttr = element?.getAttribute('data-r');
                                        const cAttr = element?.getAttribute('data-c');
                                        if (rAttr && cAttr) handleCellAction(parseInt(rAttr), parseInt(cAttr), 'move');
                                    }}
                                    onTouchEnd={(e) => {
                                        // e.preventDefault(); 
                                        const touch = e.changedTouches[0];
                                        const element = document.elementFromPoint(touch.clientX, touch.clientY);
                                        const rAttr = element?.getAttribute('data-r');
                                        const cAttr = element?.getAttribute('data-c');
                                        if (rAttr && cAttr) handleCellAction(parseInt(rAttr), parseInt(cAttr), 'end');
                                        else setIsSelecting(false);
                                    }}
                                    data-r={r}
                                    data-c={c}
                                    className={cn(
                                        "flex items-center justify-center font-bold text-lg sm:text-2xl rounded select-none cursor-pointer transition-colors duration-150 touch-none",
                                        isSelected ? "bg-indigo-500 text-white scale-105 z-10 shadow-lg ring-2 ring-indigo-300" :
                                            foundColor ? `${foundColor} text-white` :
                                                "text-slate-400 hover:bg-white/5 hover:text-white"
                                    )}
                                >
                                    {char}
                                </div>
                            );
                        }))}
                    </div>
                </Card>

                {/* Word List */}
                <Card className="bg-white/5 border-white/10 w-full p-4 rounded-xl">
                    <div className="flex items-center justify-between mb-3 px-1">
                        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                            Mots à trouver <span className="text-indigo-400">({foundWords.length}/{wordList.length})</span>
                        </h3>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center">
                        {wordList.map(word => (
                            <div
                                key={word}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 border",
                                    foundWords.includes(word)
                                        ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400 line-through decoration-emerald-500/50"
                                        : "bg-black/20 border-white/5 text-slate-400"
                                )}
                            >
                                {word}
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Multiplayer Stats (if applicable) */}
                {mode === 'multiplayer' && players.length > 0 && (
                    <Card className="bg-white/5 border-white/10 p-4 w-full">
                        <div className="flex items-center gap-2 mb-2">
                            <Star className="w-4 h-4 text-amber-400" />
                            <span className="text-xs font-bold text-slate-400 uppercase">Classement</span>
                        </div>
                        <div className="space-y-2">
                            {[...players].sort((a, b) => b.progress - a.progress).slice(0, 3).map(p => (
                                <div key={p.id} className="flex items-center justify-between text-xs">
                                    <span className={cn(p.id === currentUserId && "text-indigo-400 font-bold")}>{p.display_name}</span>
                                    <span>{p.progress}%</span>
                                </div>
                            ))}
                        </div>
                        <p className="text-[10px] text-slate-500 text-center mt-2 border-t border-white/5 pt-1">Multijoueur actif</p>
                    </Card>
                )}
            </div>

            {/* End Game Overlay */}
            <AnimatePresence>
                {gameState === 'finished' && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            className="bg-[#1a1f2e] border border-white/10 p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl relative overflow-hidden"
                        >
                            {/* Background glow */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-indigo-500/20 blur-3xl rounded-full pointer-events-none" />

                            <div className="relative z-10">
                                <div className="w-20 h-20 bg-gradient-to-br from-amber-300 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-500/30 animate-bounce-slow">
                                    <Trophy className="w-10 h-10 text-white" />
                                </div>

                                <h2 className="text-3xl font-black text-white mb-2">Excellent !</h2>
                                <p className="text-slate-400 mb-8">
                                    Tu as trouvé tous les mots en <br />
                                    <span className="text-xl font-bold text-indigo-400">{formatTime(elapsedTime)}</span>
                                </p>

                                <div className="space-y-3">
                                    {mode === 'multiplayer' ? (
                                        <>
                                            {isHost && roundInfo && onNextRound && roundInfo.current < roundInfo.total ? (
                                                <Button onClick={onNextRound} className="w-full bg-green-600 hover:bg-green-500 h-12 rounded-xl font-bold shadow-lg shadow-green-900/20 animate-pulse">
                                                    Manche Suivante ({roundInfo.current}/{roundInfo.total})
                                                </Button>
                                            ) : (
                                                <Button onClick={onBack} className="w-full bg-indigo-600 hover:bg-indigo-500 h-12 rounded-xl font-bold shadow-lg shadow-indigo-900/20">
                                                    Retour au Salon (Revanche)
                                                </Button>
                                            )}
                                            <Button onClick={onBack} variant="ghost" className="w-full text-slate-500 hover:text-red-400 hover:bg-red-500/10">
                                                Quitter la partie
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <Button onClick={onBack} variant="outline" className="w-full text-slate-300 border-white/10 hover:bg-white/5 h-12 rounded-xl">
                                                Quitter
                                            </Button>
                                            <Button onClick={restartGame} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white h-12 rounded-xl font-bold shadow-lg shadow-indigo-600/25">
                                                <RefreshCw className="mr-2 h-4 w-4" /> Rejouer
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
