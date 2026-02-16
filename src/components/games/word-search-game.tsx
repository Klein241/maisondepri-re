'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckCircle2, Trophy, Clock, RefreshCw, Star, Pause, Play, Lightbulb, Lock, ChevronRight, Award, Gift, BookOpen } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from '@/lib/utils';
import { Player } from './multiplayer-lobby';
import { generateWordSearch } from '@/lib/word-search-generator';
import { addGameHistory } from '@/lib/game-history';
import {
    getLevelConfig, getGameProgress, completeBoard, useHint,
    resetSessionHints, getHintsRemaining, getBestRecord,
    getWordsForBoard, getGridSizeForLevel, formatTime, isBoardUnlocked,
    isLevelUnlocked, getPropheticPhrase, getLeaderboard,
    type GameProgressData, type LevelConfig, type BestRecord
} from '@/lib/game-progression';

interface WordSearchGameProps {
    onBack: () => void;
    mode?: 'solo' | 'multiplayer';
    grid?: string[][];
    words?: string[];
    players?: Player[];
    currentUserId?: string;
    currentUserName?: string;
    onProgress?: (pct: number) => void;
    onComplete?: (score: number) => void;
    isHost?: boolean;
    roundInfo?: { current: number, total: number };
    onNextRound?: () => void;
}

const HIGHLIGHT_COLORS = [
    'bg-red-500/40', 'bg-blue-500/40', 'bg-green-500/40', 'bg-yellow-500/40',
    'bg-purple-500/40', 'bg-pink-500/40', 'bg-indigo-500/40', 'bg-orange-500/40',
    'bg-teal-500/40', 'bg-cyan-500/40', 'bg-rose-500/40', 'bg-emerald-500/40'
];

type ViewMode = 'level_map' | 'playing' | 'finished';

export function WordSearchGame({
    onBack,
    mode = 'solo',
    grid: initialGrid,
    words: initialWords,
    players = [],
    currentUserId,
    currentUserName,
    onProgress,
    onComplete,
    isHost,
    roundInfo,
    onNextRound
}: WordSearchGameProps) {
    // ============= STATE =============
    const [viewMode, setViewMode] = useState<ViewMode>(initialGrid ? 'playing' : 'level_map');
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

    // Progression state
    const [progress, setProgress] = useState<GameProgressData>(getGameProgress('word_search'));
    const [currentBoardIndex, setCurrentBoardIndex] = useState(0);
    const [currentLevelConfig, setCurrentLevelConfig] = useState<LevelConfig>(getLevelConfig(1));
    const [bestRecord, setBestRecord] = useState<BestRecord | null>(null);
    const [hintsRemaining, setHintsRemaining] = useState(3);
    const [hintedWord, setHintedWord] = useState<string | null>(null);
    const [timeUp, setTimeUp] = useState(false);

    // Results state
    const [resultPropheticWord, setResultPropheticWord] = useState<string | null>(null);
    const [resultAction, setResultAction] = useState<string | null>(null);
    const [resultLevelCompleted, setResultLevelCompleted] = useState(false);
    const [leaderboardEntries, setLeaderboardEntries] = useState<any[]>([]);

    // ============= INITIALIZE BOARD =============
    const startBoard = useCallback((boardIndex: number) => {
        const level = getLevelConfig(Math.max(1, progress.currentLevel));
        const config = getLevelConfig(level.level);

        // Recalculate which level this board belongs to
        let boardLevel = 1;
        if (boardIndex < 10) boardLevel = 1;
        else if (boardIndex < 60) {
            const offset = boardIndex - 10;
            const boardsPerLevel = Math.ceil(50 / 9);
            boardLevel = 2 + Math.min(Math.floor(offset / boardsPerLevel), 8);
        }
        else if (boardIndex < 150) {
            const offset = boardIndex - 60;
            boardLevel = 11 + Math.floor(offset / 9);
        }
        else boardLevel = 21 + (boardIndex - 150);

        const actualConfig = getLevelConfig(boardLevel);
        setCurrentLevelConfig(actualConfig);
        setCurrentBoardIndex(boardIndex);

        const words = getWordsForBoard(boardIndex, actualConfig.wordCount);
        const gridSize = getGridSizeForLevel(boardLevel);

        const { grid: newGrid, placedWords } = generateWordSearch(words, {
            width: gridSize.width,
            height: gridSize.height,
            directions: boardLevel >= 11
                ? ['horizontal', 'vertical', 'diagonal-down', 'diagonal-up']
                : ['horizontal', 'vertical', 'diagonal-down']
        });

        setGrid(newGrid);
        setWordList(placedWords);
        setFoundWords([]);
        setFoundLines([]);
        setSelection({ start: null, end: null });
        setTimeUp(false);
        setHintedWord(null);
        setGameState('playing');
        setStartTime(Date.now());
        setElapsedTime(0);
        pausedTimeRef.current = 0;
        lastPauseRef.current = null;
        setIsPaused(false);
        setViewMode('playing');

        // Reset hints for new session
        resetSessionHints('word_search');
        setHintsRemaining(3);

        // Get best record for this board
        setBestRecord(getBestRecord('word_search', boardIndex));
    }, [progress]);

    // Timer with countdown
    useEffect(() => {
        if (gameState !== 'playing' || isPaused) return;
        const interval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime - pausedTimeRef.current) / 1000);
            setElapsedTime(elapsed);

            // Time limit reached - game continues but marks time up
            if (elapsed >= currentLevelConfig.timeLimitSeconds && !timeUp) {
                setTimeUp(true);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [gameState, startTime, isPaused, currentLevelConfig.timeLimitSeconds, timeUp]);

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

    // ============= HINT SYSTEM =============
    const handleHint = () => {
        if (hintsRemaining <= 0) return;
        const remaining = wordList.filter(w => !foundWords.includes(w));
        if (remaining.length === 0) return;

        const success = useHint('word_search');
        if (!success) return;

        const randomWord = remaining[Math.floor(Math.random() * remaining.length)];
        setHintedWord(randomWord);
        setHintsRemaining(prev => prev - 1);

        // Auto-clear hint after 4 seconds
        setTimeout(() => setHintedWord(null), 4000);
    };

    // ============= SELECTION LOGIC =============
    const getSelectedWord = (start: { r: number, c: number }, end: { r: number, c: number }) => {
        if (!start || !end) return '';
        const dr = end.r - start.r;
        const dc = end.c - start.c;
        if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return '';

        const length = Math.max(Math.abs(dr), Math.abs(dc));
        const stepR = dr === 0 ? 0 : dr / Math.abs(dr);
        const stepC = dc === 0 ? 0 : dc / Math.abs(dc);

        let word = '';
        for (let i = 0; i <= length; i++) {
            const r = start.r + i * stepR;
            const c = start.c + i * stepC;
            if (grid[r] && grid[r][c]) word += grid[r][c];
        }
        return word;
    };

    const handleCellAction = (r: number, c: number, type: 'start' | 'move' | 'end') => {
        if (gameState !== 'playing') return;

        if (type === 'start') {
            setIsSelecting(true);
            setSelection({ start: { r, c }, end: { r, c } });
        } else if (type === 'move' && isSelecting && selection.start) {
            const dr = r - selection.start.r;
            const dc = c - selection.start.c;
            let finalR = r, finalC = c;

            if (Math.abs(dr) > 0 && Math.abs(dc) > 0) {
                if (Math.abs(Math.abs(dr) - Math.abs(dc)) < 3) {
                    const maxDelta = Math.max(Math.abs(dr), Math.abs(dc));
                    finalR = selection.start.r + (maxDelta * Math.sign(dr));
                    finalC = selection.start.c + (maxDelta * Math.sign(dc));
                }
            }
            setSelection(prev => ({ ...prev, end: { r: finalR, c: finalC } }));
        } else if (type === 'end' && isSelecting && selection.start) {
            const finalEnd = { r, c };
            setIsSelecting(false);

            const word = getSelectedWord(selection.start, finalEnd);
            if (word) {
                const reversedWord = word.split('').reverse().join('');
                let found: string | null = null;
                if (wordList.includes(word) && !foundWords.includes(word)) found = word;
                if (wordList.includes(reversedWord) && !foundWords.includes(reversedWord)) found = reversedWord;

                if (found) {
                    const newFound = [...foundWords, found];
                    setFoundWords(newFound);
                    setFoundLines(prev => [...prev, {
                        start: selection.start!,
                        end: finalEnd,
                        colorIndex: prev.length % HIGHLIGHT_COLORS.length
                    }]);

                    const pct = Math.round((newFound.length / wordList.length) * 100);
                    if (onProgress) onProgress(pct);

                    // Clear hint if hinted word is found
                    if (found === hintedWord) setHintedWord(null);

                    // Win condition
                    if (newFound.length === wordList.length) {
                        handleGameComplete();
                    } else {
                        confetti({ particleCount: 30, spread: 50, origin: { x: c / (grid[0]?.length || 1), y: (r / (grid.length || 1)) * 0.5 + 0.2 }, scalar: 0.7 });
                    }
                }
            }
            setSelection({ start: null, end: null });
        }
    };

    const handleGameComplete = () => {
        setGameState('finished');
        const timeTaken = Math.floor((Date.now() - startTime - pausedTimeRef.current) / 1000);

        // Complete board in progression system
        const result = completeBoard(
            'word_search',
            currentBoardIndex,
            timeTaken,
            currentUserName || 'Joueur',
            currentUserId || 'local'
        );

        setProgress(result.progress);
        setResultPropheticWord(result.propheticWord);
        setResultAction(result.action);
        setResultLevelCompleted(result.levelCompleted);

        // Get leaderboard for this board
        setLeaderboardEntries(getLeaderboard('word_search', currentBoardIndex).slice(0, 5));

        addGameHistory({
            gameType: 'word_search',
            score: Math.max(0, 500 - timeTaken * 3),
            maxScore: 500,
            timeSeconds: timeTaken,
            metadata: { boardIndex: currentBoardIndex, level: currentLevelConfig.level }
        });

        if (onComplete) onComplete(timeTaken);

        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    };

    const isCellSelected = (r: number, c: number) => {
        if (!selection.start || !selection.end) return false;
        const { start, end } = selection;
        const dr = end.r - start.r;
        const dc = end.c - start.c;
        if (dr === 0 && dc === 0) return r === start.r && c === start.c;
        const steps = Math.max(Math.abs(dr), Math.abs(dc));
        const stepR = dr === 0 ? 0 : dr / Math.abs(dr);
        const stepC = dc === 0 ? 0 : dc / Math.abs(dc);
        for (let i = 0; i <= steps; i++) {
            if (start.r + Math.round(i * stepR) === r && start.c + Math.round(i * stepC) === c) return true;
        }
        return false;
    };

    const getFoundLineColor = (r: number, c: number) => {
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
    };

    // ============= LEVEL MAP VIEW =============
    if (viewMode === 'level_map') {
        const prog = getGameProgress('word_search');
        const allLevels = Array.from({ length: 30 }, (_, i) => i + 1);

        return (
            <div className="min-h-screen bg-gradient-to-b from-[#0B0E14] to-[#1a1f2e] text-white overflow-auto">
                {/* Header */}
                <div className="sticky top-0 z-10 bg-[#0B0E14]/90 backdrop-blur-xl border-b border-white/10 p-4">
                    <div className="flex items-center justify-between max-w-lg mx-auto">
                        <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-400 hover:text-white">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Retour
                        </Button>
                        <h1 className="font-black text-lg">🔤 Mots Cachés</h1>
                        <div className="text-xs text-slate-500">Niv. {prog.currentLevel}</div>
                    </div>
                </div>

                <div className="max-w-lg mx-auto p-4 space-y-6">
                    {/* Progress overview */}
                    <Card className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-500/20 p-4">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="font-bold text-sm text-indigo-300">Progression globale</h3>
                            <Badge className="bg-indigo-500/20 text-indigo-400 text-xs">
                                {Object.values(prog.boards).filter(b => b.completed).length} / 160 tableaux
                            </Badge>
                        </div>
                        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                                style={{ width: `${(Object.values(prog.boards).filter(b => b.completed).length / 160) * 100}%` }}
                            />
                        </div>
                    </Card>

                    {/* Level groups */}
                    {[
                        { title: 'ECODIM 🟢', levels: [1], color: 'green' },
                        { title: 'JEUNESSE 🟡', levels: [2, 3, 4, 5, 6, 7, 8, 9, 10], color: 'yellow' },
                        { title: 'DIFFICILE 🟠', levels: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20], color: 'orange' },
                        { title: 'MAÎTRE 🔴', levels: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30], color: 'red' },
                    ].map(group => (
                        <div key={group.title}>
                            <h2 className="text-sm font-black mb-3 px-1" style={{
                                color: group.color === 'green' ? '#22c55e' :
                                    group.color === 'yellow' ? '#eab308' :
                                        group.color === 'orange' ? '#f97316' : '#ef4444'
                            }}>
                                {group.title}
                            </h2>
                            <div className="space-y-2">
                                {group.levels.map(level => {
                                    const config = getLevelConfig(level);
                                    const unlocked = isLevelUnlocked('word_search', level);
                                    const lp = prog.levelProgress[level];
                                    const completedBoards = lp?.boardsCompleted || 0;
                                    const phrase = getPropheticPhrase(level);

                                    return (
                                        <motion.div
                                            key={level}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: level * 0.02 }}
                                        >
                                            <Card className={cn(
                                                "p-3 border transition-all",
                                                unlocked
                                                    ? "bg-white/5 border-white/10 hover:border-white/20 cursor-pointer"
                                                    : "bg-white/[0.02] border-white/5 opacity-50"
                                            )}
                                                onClick={() => {
                                                    if (!unlocked) return;
                                                    // Open board selection for this level
                                                    const boardStart = config.boardStartIndex;
                                                    // Find first incomplete board
                                                    let targetBoard = boardStart;
                                                    for (let i = boardStart; i < boardStart + config.boardsInLevel; i++) {
                                                        if (!prog.boards[i]?.completed) {
                                                            targetBoard = i;
                                                            break;
                                                        }
                                                    }
                                                    startBoard(targetBoard);
                                                }}
                                            >
                                                <div className="flex items-center gap-3">
                                                    {unlocked ? (
                                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black shrink-0"
                                                            style={{
                                                                backgroundColor: `${config.tierColor}20`,
                                                                color: config.tierColor,
                                                                border: `1px solid ${config.tierColor}40`
                                                            }}>
                                                            {level}
                                                        </div>
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                                                            <Lock className="h-4 w-4 text-slate-600" />
                                                        </div>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-sm text-white">Niveau {level}</span>
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{
                                                                backgroundColor: `${config.tierColor}20`,
                                                                color: config.tierColor
                                                            }}>
                                                                {config.wordCount} mots
                                                            </span>
                                                            {lp?.completed && <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />}
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                                <div className="h-full rounded-full transition-all" style={{
                                                                    width: `${(completedBoards / config.boardsInLevel) * 100}%`,
                                                                    backgroundColor: config.tierColor
                                                                }} />
                                                            </div>
                                                            <span className="text-[10px] text-slate-500">{completedBoards}/{config.boardsInLevel}</span>
                                                        </div>
                                                        {lp?.propheticWords && lp.propheticWords.length > 0 && (
                                                            <p className="text-[10px] text-amber-400/70 mt-1 truncate">
                                                                🔮 {lp.propheticWords.join(' ')}...
                                                            </p>
                                                        )}
                                                    </div>
                                                    {unlocked && <ChevronRight className="h-4 w-4 text-slate-600 shrink-0" />}
                                                </div>
                                            </Card>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // ============= FINISHED VIEW =============
    if (gameState === 'finished') {
        const phrase = getPropheticPhrase(currentLevelConfig.level);
        const levelProg = progress.levelProgress[currentLevelConfig.level];

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-auto">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    className="bg-[#1a1f2e] border border-white/10 p-6 sm:p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl relative overflow-hidden"
                >
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-indigo-500/20 blur-3xl rounded-full pointer-events-none" />

                    <div className="relative z-10 space-y-4">
                        {/* Trophy */}
                        <div className="w-20 h-20 bg-gradient-to-br from-amber-300 to-orange-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-amber-500/30">
                            <Trophy className="w-10 h-10 text-white" />
                        </div>

                        <h2 className="text-2xl font-black text-white">
                            {timeUp ? 'Terminé !' : 'Excellent !'}
                        </h2>

                        {/* Time */}
                        <div className="flex justify-center gap-4">
                            <div className="text-center">
                                <p className="text-xs text-slate-400">Ton temps</p>
                                <p className={cn("text-xl font-bold", timeUp ? "text-orange-400" : "text-indigo-400")}>
                                    {formatTime(elapsedTime)}
                                </p>
                            </div>
                            {bestRecord && (
                                <div className="text-center">
                                    <p className="text-xs text-slate-400">Record</p>
                                    <p className="text-xl font-bold text-amber-400">{formatTime(bestRecord.timeSeconds)}</p>
                                    <p className="text-[10px] text-slate-500">par {bestRecord.playerName}</p>
                                </div>
                            )}
                        </div>

                        {/* Prophetic Word Unlock */}
                        {resultPropheticWord && (
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.5 }}
                                className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3"
                            >
                                <p className="text-xs text-amber-400 font-bold mb-1">🔮 Mot déverrouillé !</p>
                                <p className="text-lg font-black text-amber-300">{resultPropheticWord}</p>
                                {levelProg?.propheticWords && (
                                    <p className="text-[10px] text-amber-400/60 mt-1">
                                        {levelProg.propheticWords.join(' ')}...
                                    </p>
                                )}
                            </motion.div>
                        )}

                        {/* Level Completed */}
                        {resultLevelCompleted && (
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.8 }}
                                className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 space-y-2"
                            >
                                <div className="flex items-center justify-center gap-2">
                                    <Award className="h-5 w-5 text-green-400" />
                                    <p className="text-sm font-bold text-green-400">Niveau {currentLevelConfig.level} terminé !</p>
                                </div>
                                {resultAction && (
                                    <div className="bg-green-500/10 rounded-lg p-2">
                                        <p className="text-[10px] text-green-300/70 mb-1">Action déverrouillée :</p>
                                        <p className="text-xs font-bold text-green-300">{resultAction}</p>
                                    </div>
                                )}
                                {levelProg?.propheticWords && (
                                    <div className="bg-amber-500/10 rounded-lg p-2">
                                        <p className="text-[10px] text-amber-300/70 mb-1">Parole prophétique :</p>
                                        <p className="text-xs font-bold text-amber-300">{levelProg.propheticWords.join(' ')}</p>
                                    </div>
                                )}
                                <div className="flex items-center justify-center gap-2 text-purple-400">
                                    <Gift className="h-4 w-4" />
                                    <p className="text-xs font-bold">🏆 Récompense déverrouillée !</p>
                                </div>
                            </motion.div>
                        )}

                        {/* Leaderboard */}
                        {leaderboardEntries.length > 0 && (
                            <div className="bg-white/5 rounded-xl p-3">
                                <p className="text-xs font-bold text-slate-300 mb-2 flex items-center justify-center gap-1">
                                    <Star className="h-3 w-3 text-amber-400" /> Classement
                                </p>
                                <div className="space-y-1">
                                    {leaderboardEntries.map((entry, i) => (
                                        <div key={i} className={cn(
                                            "flex items-center justify-between text-xs px-2 py-1 rounded",
                                            entry.playerId === (currentUserId || 'local') ? "bg-indigo-500/10 text-indigo-300" : "text-slate-400"
                                        )}>
                                            <span>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`} {entry.playerName}</span>
                                            <span className="font-mono">{formatTime(entry.timeSeconds)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="space-y-2 pt-2">
                            <Button onClick={() => setViewMode('level_map')} className="w-full bg-indigo-600 hover:bg-indigo-500 h-11 rounded-xl font-bold">
                                <BookOpen className="mr-2 h-4 w-4" /> Carte des niveaux
                            </Button>
                            <Button onClick={() => {
                                // Find next incomplete board
                                const nextBoard = currentBoardIndex + 1;
                                if (isBoardUnlocked('word_search', nextBoard)) {
                                    startBoard(nextBoard);
                                } else {
                                    setViewMode('level_map');
                                }
                            }} variant="outline" className="w-full text-slate-300 border-white/10 hover:bg-white/5 h-11 rounded-xl">
                                <ChevronRight className="mr-2 h-4 w-4" /> Tableau suivant
                            </Button>
                        </div>
                    </div>
                </motion.div>
            </div>
        );
    }

    // ============= PLAYING VIEW =============
    if (gameState === 'loading') {
        return (
            <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500" />
            </div>
        );
    }

    const timeRemaining = Math.max(0, currentLevelConfig.timeLimitSeconds - elapsedTime);
    const timePercent = (timeRemaining / currentLevelConfig.timeLimitSeconds) * 100;

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#0B0E14] to-[#1a1f2e] text-white p-3 sm:p-4 flex flex-col items-center select-none">
            {/* Header */}
            <div className="w-full max-w-lg flex items-center justify-between mb-3">
                <Button variant="ghost" size="sm" onClick={() => setViewMode('level_map')} className="text-slate-400 hover:text-white">
                    <ArrowLeft className="mr-1 h-4 w-4" /> Niveaux
                </Button>

                <div className="flex items-center gap-2">
                    {/* Level badge */}
                    <Badge className="text-[10px]" style={{
                        backgroundColor: `${currentLevelConfig.tierColor}20`,
                        color: currentLevelConfig.tierColor,
                        borderColor: `${currentLevelConfig.tierColor}40`
                    }}>
                        {currentLevelConfig.tierEmoji} Niv.{currentLevelConfig.level}
                    </Badge>

                    {/* Board number */}
                    <Badge variant="outline" className="bg-white/5 text-slate-300 text-[10px]">
                        #{currentBoardIndex + 1}
                    </Badge>
                </div>

                <div className="flex items-center gap-1">
                    {/* Hint button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleHint}
                        disabled={hintsRemaining <= 0}
                        className={cn(
                            "h-8 w-8 rounded-full relative",
                            hintsRemaining > 0
                                ? "text-amber-400 hover:bg-amber-500/10"
                                : "text-slate-600"
                        )}
                        title={`${hintsRemaining} aide(s) restante(s)`}
                    >
                        <Lightbulb className="h-4 w-4" />
                        <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-amber-500 rounded-full text-[8px] font-bold flex items-center justify-center text-black">
                            {hintsRemaining}
                        </span>
                    </Button>

                    {/* Pause */}
                    {gameState === 'playing' && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={togglePause}
                            className="h-8 w-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400"
                        >
                            <Pause className="h-3.5 w-3.5" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Timer Bar */}
            <div className="w-full max-w-lg mb-3">
                <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-1 text-slate-400">
                        <Clock className="h-3 w-3" />
                        {timeUp ? (
                            <span className="text-orange-400 font-bold">{formatTime(elapsedTime)}</span>
                        ) : (
                            <span>{formatTime(timeRemaining)}</span>
                        )}
                    </span>
                    {bestRecord && (
                        <span className="text-amber-400/60 text-[10px]">
                            🏆 Record: {formatTime(bestRecord.timeSeconds)} ({bestRecord.playerName})
                        </span>
                    )}
                    {!bestRecord && (
                        <span className="text-slate-500 text-[10px]">🏆 Record à battre</span>
                    )}
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                        className={cn(
                            "h-full rounded-full transition-colors",
                            timeUp ? "bg-orange-500" :
                                timePercent > 30 ? "bg-green-500" :
                                    timePercent > 10 ? "bg-yellow-500" : "bg-red-500"
                        )}
                        style={{ width: `${Math.min(100, timeUp ? 100 : timePercent)}%` }}
                    />
                </div>
            </div>

            {/* Hint Banner */}
            <AnimatePresence>
                {hintedWord && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="w-full max-w-lg mb-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-2 text-center"
                    >
                        <span className="text-amber-400 font-bold text-sm">💡 Cherche : {hintedWord}</span>
                    </motion.div>
                )}
            </AnimatePresence>

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
                                <Button onClick={togglePause} className="bg-green-600 hover:bg-green-500 h-14 px-10 rounded-2xl text-lg font-bold gap-2">
                                    <Play className="h-5 w-5" /> Reprendre
                                </Button>
                                <Button variant="ghost" onClick={() => { setIsPaused(false); setViewMode('level_map'); }} className="text-slate-400 hover:text-white">
                                    <ArrowLeft className="h-4 w-4 mr-2" /> Quitter le jeu
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Game Grid */}
            <div className="flex flex-col gap-4 w-full max-w-lg items-center">
                <Card className="bg-[#13161c] border-white/10 shadow-2xl p-2 sm:p-3 rounded-2xl w-full max-w-[400px] relative overflow-hidden">
                    {timeUp && (
                        <div className="absolute top-1 right-1 z-10">
                            <Badge className="bg-orange-500/20 text-orange-400 text-[9px] animate-pulse">⏱️ Temps écoulé</Badge>
                        </div>
                    )}
                    <div
                        className="grid gap-[2px]"
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
                                    onTouchStart={() => handleCellAction(r, c, 'start')}
                                    onTouchMove={(e) => {
                                        const touch = e.touches[0];
                                        const element = document.elementFromPoint(touch.clientX, touch.clientY);
                                        const rAttr = element?.getAttribute('data-r');
                                        const cAttr = element?.getAttribute('data-c');
                                        if (rAttr && cAttr) handleCellAction(parseInt(rAttr), parseInt(cAttr), 'move');
                                    }}
                                    onTouchEnd={(e) => {
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
                                        "flex items-center justify-center font-bold rounded select-none cursor-pointer transition-colors duration-150 touch-none aspect-square",
                                        grid[0]?.length > 14 ? "text-[10px] sm:text-sm" :
                                            grid[0]?.length > 12 ? "text-xs sm:text-base" : "text-sm sm:text-lg",
                                        isSelected ? "bg-indigo-500 text-white scale-105 z-10 shadow-lg ring-1 ring-indigo-300" :
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
                <Card className="bg-white/5 border-white/10 w-full p-3 rounded-xl">
                    <div className="flex items-center justify-between mb-2 px-1">
                        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                            Mots à trouver <span className="text-indigo-400">({foundWords.length}/{wordList.length})</span>
                        </h3>
                    </div>
                    <div className="flex flex-wrap gap-1.5 justify-center">
                        {wordList.map(word => (
                            <div
                                key={word}
                                className={cn(
                                    "px-2 py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all duration-300 border",
                                    foundWords.includes(word)
                                        ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400 line-through decoration-emerald-500/50"
                                        : word === hintedWord
                                            ? "bg-amber-500/20 border-amber-500/30 text-amber-400 animate-pulse"
                                            : "bg-black/20 border-white/5 text-slate-400"
                                )}
                            >
                                {word}
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Multiplayer Stats */}
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
                    </Card>
                )}
            </div>
        </div>
    );
}
