'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, CheckCircle2, XCircle, Trophy, Clock, Zap, Shield, Star, Crown, Target, Flame, RotateCcw, Sparkles, Award, Gift, TrendingUp, Medal, Swords, Calendar, ChevronRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from '@/lib/utils';
import { Player } from './multiplayer-lobby';
import { getRandomQuestions } from '@/lib/game-data';

// ============== PREMIUM GAMING SYSTEM ==============
interface PlayerStats {
    xp: number;
    level: number;
    totalGames: number;
    totalCorrect: number;
    totalQuestions: number;
    bestScore: number;
    bestStreak: number;
    badges: string[];
    dailyStreak: number;
    lastPlayDate: string;
    weeklyXP: number;
    weeklyGames: number;
}

interface LeaderboardEntry {
    name: string;
    score: number;
    level: number;
    date: string;
}

const BADGE_DEFINITIONS: Record<string, { name: string; icon: string; description: string; requirement: string }> = {
    first_game: { name: 'Première Partie', icon: '🎮', description: 'Jouer votre première partie', requirement: 'totalGames >= 1' },
    streak_5: { name: 'En Feu', icon: '🔥', description: 'Série de 5 réponses correctes', requirement: 'bestStreak >= 5' },
    streak_10: { name: 'Inarrêtable', icon: '⚡', description: 'Série de 10 réponses correctes', requirement: 'bestStreak >= 10' },
    perfect: { name: 'Perfection', icon: '💎', description: '100% de réponses correctes', requirement: 'perfect' },
    veteran: { name: 'Vétéran', icon: '🏅', description: 'Jouer 10 parties', requirement: 'totalGames >= 10' },
    expert: { name: 'Expert Biblique', icon: '📖', description: 'Jouer 50 parties', requirement: 'totalGames >= 50' },
    score_1000: { name: 'Millier', icon: '🌟', description: 'Atteindre 1000 points en une partie', requirement: 'bestScore >= 1000' },
    score_2000: { name: 'Légende', icon: '👑', description: 'Atteindre 2000 points en une partie', requirement: 'bestScore >= 2000' },
    daily_7: { name: 'Fidèle', icon: '📆', description: 'Jouer 7 jours consécutifs', requirement: 'dailyStreak >= 7' },
    daily_30: { name: 'Dévoué', icon: '🗓️', description: 'Jouer 30 jours consécutifs', requirement: 'dailyStreak >= 30' },
    accuracy_80: { name: 'Précis', icon: '🎯', description: 'Taux de réussite global de 80%+', requirement: 'accuracy >= 80' },
    level_5: { name: 'Apprenti', icon: '📚', description: 'Atteindre le niveau 5', requirement: 'level >= 5' },
    level_10: { name: 'Maître', icon: '🏆', description: 'Atteindre le niveau 10', requirement: 'level >= 10' },
    level_20: { name: 'Grand Maître', icon: '💫', description: 'Atteindre le niveau 20', requirement: 'level >= 20' },
};

const XP_PER_LEVEL = 500;
function getLevel(xp: number): number { return Math.floor(xp / XP_PER_LEVEL) + 1; }
function getXPForNextLevel(xp: number): number { return XP_PER_LEVEL - (xp % XP_PER_LEVEL); }
function getXPProgress(xp: number): number { return ((xp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100; }

function loadPlayerStats(): PlayerStats {
    try {
        const data = localStorage.getItem('duel_player_stats');
        return data ? JSON.parse(data) : {
            xp: 0, level: 1, totalGames: 0, totalCorrect: 0, totalQuestions: 0,
            bestScore: 0, bestStreak: 0, badges: [], dailyStreak: 0,
            lastPlayDate: '', weeklyXP: 0, weeklyGames: 0
        };
    } catch { return { xp: 0, level: 1, totalGames: 0, totalCorrect: 0, totalQuestions: 0, bestScore: 0, bestStreak: 0, badges: [], dailyStreak: 0, lastPlayDate: '', weeklyXP: 0, weeklyGames: 0 }; }
}

function savePlayerStats(stats: PlayerStats) {
    localStorage.setItem('duel_player_stats', JSON.stringify(stats));
}

function loadLeaderboard(): LeaderboardEntry[] {
    try {
        const data = localStorage.getItem('duel_leaderboard');
        return data ? JSON.parse(data) : [];
    } catch { return []; }
}

function saveToLeaderboard(entry: LeaderboardEntry) {
    const lb = loadLeaderboard();
    lb.push(entry);
    lb.sort((a, b) => b.score - a.score);
    localStorage.setItem('duel_leaderboard', JSON.stringify(lb.slice(0, 50)));
}

function checkNewBadges(stats: PlayerStats, sessionScore: number, sessionCorrect: number, sessionTotal: number, sessionStreak: number): string[] {
    const newBadges: string[] = [];
    const accuracy = stats.totalQuestions > 0 ? (stats.totalCorrect / stats.totalQuestions) * 100 : 0;

    const checks: Record<string, boolean> = {
        first_game: stats.totalGames >= 1,
        streak_5: stats.bestStreak >= 5 || sessionStreak >= 5,
        streak_10: stats.bestStreak >= 10 || sessionStreak >= 10,
        perfect: sessionCorrect === sessionTotal && sessionTotal > 0,
        veteran: stats.totalGames >= 10,
        expert: stats.totalGames >= 50,
        score_1000: sessionScore >= 1000 || stats.bestScore >= 1000,
        score_2000: sessionScore >= 2000 || stats.bestScore >= 2000,
        daily_7: stats.dailyStreak >= 7,
        daily_30: stats.dailyStreak >= 30,
        accuracy_80: accuracy >= 80,
        level_5: stats.level >= 5,
        level_10: stats.level >= 10,
        level_20: stats.level >= 20,
    };

    for (const [id, earned] of Object.entries(checks)) {
        if (earned && !stats.badges.includes(id)) {
            newBadges.push(id);
        }
    }
    return newBadges;
}

interface Question {
    id: string;
    question: string;
    options: string[];
    correct: number;
}

interface QuizDuelGameProps {
    onBack: () => void;
    mode?: 'solo' | 'multiplayer';
    questions: Question[];
    players?: Player[];
    currentUserId?: string;
    onProgress?: (pct: number) => void;
    onComplete?: (score: number) => void;
    isHost?: boolean;
    roundInfo?: { current: number, total: number };
    onNextRound?: () => void;
}

export function QuizDuelGame({
    onBack,
    mode = 'solo',
    questions = [],
    players = [],
    currentUserId,
    onProgress,
    onComplete,
    isHost,
    roundInfo,
    onNextRound
}: QuizDuelGameProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [gameState, setGameState] = useState<'menu' | 'countdown' | 'playing' | 'feedback' | 'finished' | 'leaderboard' | 'badges'>('menu');
    const [score, setScore] = useState(0);
    const [correctCount, setCorrectCount] = useState(0);
    const [startTime] = useState(Date.now());
    const [elapsedTime, setElapsedTime] = useState(0);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
    const [countdown, setCountdown] = useState(3);
    const [streak, setStreak] = useState(0);
    const [maxStreak, setMaxStreak] = useState(0);
    const [questionTimer, setQuestionTimer] = useState(15);
    const [shakeWrong, setShakeWrong] = useState(false);
    const [gameQuestions, setGameQuestions] = useState<Question[]>(questions);
    const [selectedDifficulty, setSelectedDifficulty] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');

    // Premium gaming state
    const [playerStats, setPlayerStats] = useState<PlayerStats>(loadPlayerStats());
    const [earnedXP, setEarnedXP] = useState(0);
    const [newBadges, setNewBadges] = useState<string[]>([]);
    const [showLevelUp, setShowLevelUp] = useState(false);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(loadLeaderboard());

    // Auto-load questions if none provided
    useEffect(() => {
        if (questions.length === 0 && mode !== 'multiplayer') {
            // Don't auto-start, show menu first
        } else if (questions.length > 0) {
            setGameQuestions(questions);
            setGameState('countdown');
        }
    }, [questions]);

    const startSoloGame = (diff: 'all' | 'easy' | 'medium' | 'hard' = 'all') => {
        setSelectedDifficulty(diff);
        const d = diff === 'all' ? undefined : diff;
        const newQs = getRandomQuestions(15, d as any).map((q, i) => ({
            id: `q-${i}-${Date.now()}`,
            question: q.question,
            options: q.options,
            correct: q.answer,
            difficulty: q.difficulty
        }));
        setGameQuestions(newQs as any);
        setCurrentIndex(0);
        setGameState('countdown');
        setScore(0);
        setCorrectCount(0);
        setSelectedOption(null);
        setFeedback(null);
        setCountdown(3);
        setStreak(0);
        setMaxStreak(0);
        setQuestionTimer(15);
        setElapsedTime(0);
        setEarnedXP(0);
        setNewBadges([]);
        setShowLevelUp(false);
    };

    const handleReplay = () => {
        startSoloGame(selectedDifficulty);
    };

    const getDifficultyBadge = (diff?: string) => {
        switch (diff) {
            case 'easy': return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">Facile</Badge>;
            case 'medium': return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">Moyen</Badge>;
            case 'hard': return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">Difficile</Badge>;
            default: return null;
        }
    };

    // Countdown before start
    useEffect(() => {
        if (gameState !== 'countdown') return;
        if (countdown <= 0) {
            setGameState('playing');
            return;
        }
        const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [countdown, gameState]);

    // Game timer
    useEffect(() => {
        if (gameState !== 'playing') return;
        const interval = setInterval(() => {
            setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [gameState, startTime]);

    // Per-question timer
    useEffect(() => {
        if (gameState !== 'playing') return;
        setQuestionTimer(15);
        const interval = setInterval(() => {
            setQuestionTimer(prev => {
                if (prev <= 1) {
                    // Time's up - auto-select wrong
                    handleAnswer(-1);
                    return 15;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [currentIndex, gameState]);

    const handleAnswer = useCallback((optionIndex: number) => {
        if (selectedOption !== null || gameState !== 'playing') return;

        setSelectedOption(optionIndex);
        const isCorrect = optionIndex === gameQuestions[currentIndex]?.correct;

        // Score: bonus for speed + correctness
        const timeBonus = Math.max(0, questionTimer * 10);
        const streakBonus = streak * 5;

        if (isCorrect) {
            setScore(s => s + 100 + timeBonus + streakBonus);
            setCorrectCount(c => c + 1);
            setStreak(s => {
                const newStreak = s + 1;
                setMaxStreak(m => Math.max(m, newStreak));
                return newStreak;
            });
        } else {
            setStreak(0);
            setShakeWrong(true);
            setTimeout(() => setShakeWrong(false), 500);
        }

        setFeedback(isCorrect ? 'correct' : 'wrong');
        setGameState('feedback');

        // Progress calc
        const newProgress = Math.round(((currentIndex + 1) / gameQuestions.length) * 100);
        if (onProgress) onProgress(newProgress);

        setTimeout(() => {
            if (currentIndex < gameQuestions.length - 1) {
                setCurrentIndex(prev => prev + 1);
                setSelectedOption(null);
                setFeedback(null);
                setGameState('playing');
            } else {
                // === PREMIUM: Calculate XP and update stats ===
                const finalCorrect = correctCount + (isCorrect ? 1 : 0);
                const finalStreak = Math.max(maxStreak, isCorrect ? streak + 1 : maxStreak);
                const finalScore = score + (isCorrect ? 100 + Math.max(0, questionTimer * 10) + streak * 5 : 0);

                // XP calculation
                const baseXP = finalCorrect * 20;
                const streakXP = finalStreak * 10;
                const speedXP = Math.max(0, 50 - Math.floor((Date.now() - startTime) / 1000));
                const perfectBonus = finalCorrect === gameQuestions.length ? 200 : 0;
                const totalXP = baseXP + streakXP + speedXP + perfectBonus;
                setEarnedXP(totalXP);

                // Update stats
                const today = new Date().toISOString().split('T')[0];
                const stats = loadPlayerStats();
                const oldLevel = getLevel(stats.xp);

                stats.xp += totalXP;
                stats.level = getLevel(stats.xp);
                stats.totalGames += 1;
                stats.totalCorrect += finalCorrect;
                stats.totalQuestions += gameQuestions.length;
                stats.bestScore = Math.max(stats.bestScore, finalScore);
                stats.bestStreak = Math.max(stats.bestStreak, finalStreak);
                stats.weeklyXP += totalXP;
                stats.weeklyGames += 1;

                // Daily streak
                if (stats.lastPlayDate === today) {
                    // Already played today
                } else if (stats.lastPlayDate) {
                    const lastDate = new Date(stats.lastPlayDate);
                    const todayDate = new Date(today);
                    const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
                    stats.dailyStreak = diffDays === 1 ? stats.dailyStreak + 1 : 1;
                } else {
                    stats.dailyStreak = 1;
                }
                stats.lastPlayDate = today;

                // Check badges
                const earned = checkNewBadges(stats, finalScore, finalCorrect, gameQuestions.length, finalStreak);
                stats.badges = [...stats.badges, ...earned];
                setNewBadges(earned);

                // Level up check
                if (stats.level > oldLevel) {
                    setShowLevelUp(true);
                }

                savePlayerStats(stats);
                setPlayerStats(stats);

                // Save to leaderboard
                saveToLeaderboard({
                    name: 'Moi',
                    score: finalScore,
                    level: stats.level,
                    date: today
                });
                setLeaderboard(loadLeaderboard());

                setGameState('finished');
                if (finalCorrect >= gameQuestions.length * 0.7) {
                    confetti({
                        particleCount: 150,
                        spread: 160,
                        origin: { y: 0.6 }
                    });
                }
                const timeTaken = Math.floor((Date.now() - startTime) / 1000);
                if (onComplete) onComplete(timeTaken);
            }
        }, 1200);
    }, [selectedOption, gameState, currentIndex, gameQuestions, questionTimer, streak, onProgress, onComplete, startTime, correctCount, score, maxStreak]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getTimerColor = () => {
        if (questionTimer > 10) return 'text-green-400';
        if (questionTimer > 5) return 'text-amber-400';
        return 'text-red-400';
    };

    const progressPercent = gameQuestions.length > 0 ? ((currentIndex) / gameQuestions.length) * 100 : 0;

    // Option labels
    const optLabels = ['A', 'B', 'C', 'D'];
    const optColors = [
        'from-blue-600/30 to-blue-700/20 border-blue-500/40 hover:border-blue-400',
        'from-emerald-600/30 to-emerald-700/20 border-emerald-500/40 hover:border-emerald-400',
        'from-amber-600/30 to-amber-700/20 border-amber-500/40 hover:border-amber-400',
        'from-purple-600/30 to-purple-700/20 border-purple-500/40 hover:border-purple-400',
    ];

    return (
        <div className="min-h-screen bg-[#070B14] text-white flex flex-col overflow-hidden relative">
            {/* Animated Background */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-20%] left-[-20%] w-[70%] h-[70%] bg-indigo-600/8 blur-[150px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/8 blur-[120px] rounded-full" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px]" />
            </div>

            {/* ========== PREMIUM MENU ========== */}
            <AnimatePresence mode="wait">
                {gameState === 'menu' && (
                    <motion.div
                        key="duel-menu"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="relative z-10 min-h-screen flex flex-col"
                    >
                        <header className="px-6 pt-10 pb-4">
                            <Button variant="ghost" size="icon" onClick={onBack} className="mb-4"><ArrowLeft className="h-6 w-6" /></Button>
                            <div className="text-center">
                                <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-3xl flex items-center justify-center shadow-lg shadow-indigo-600/30 relative">
                                    <span className="text-4xl">⚔️</span>
                                    <div className="absolute -top-2 -right-2 bg-amber-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full">Nv.{playerStats.level}</div>
                                </div>
                                <h1 className="text-3xl font-black bg-gradient-to-r from-white via-indigo-200 to-purple-300 bg-clip-text text-transparent">Duel Biblique</h1>
                                <p className="text-slate-500 text-sm mt-1">Affrontez le quiz ultime</p>
                            </div>
                        </header>

                        {/* XP Progress */}
                        <div className="px-6 mb-6">
                            <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-slate-400">Niveau {playerStats.level}</span>
                                    <span className="text-xs font-bold text-indigo-400">{playerStats.xp % XP_PER_LEVEL}/{XP_PER_LEVEL} XP</span>
                                </div>
                                <Progress value={getXPProgress(playerStats.xp)} className="h-2" />
                                <div className="flex justify-between mt-3 text-center">
                                    <div><p className="text-lg font-black text-white">{playerStats.totalGames}</p><p className="text-[9px] text-slate-600 uppercase font-bold">Parties</p></div>
                                    <div><p className="text-lg font-black text-amber-400">{playerStats.bestScore}</p><p className="text-[9px] text-slate-600 uppercase font-bold">Record</p></div>
                                    <div><p className="text-lg font-black text-orange-400">{playerStats.bestStreak}</p><p className="text-[9px] text-slate-600 uppercase font-bold">Série max</p></div>
                                    <div><p className="text-lg font-black text-emerald-400">{playerStats.totalQuestions > 0 ? Math.round((playerStats.totalCorrect / playerStats.totalQuestions) * 100) : 0}%</p><p className="text-[9px] text-slate-600 uppercase font-bold">Précision</p></div>
                                </div>
                            </div>
                        </div>

                        {/* Daily Streak */}
                        {playerStats.dailyStreak > 0 && (
                            <div className="px-6 mb-4">
                                <div className="bg-gradient-to-r from-orange-600/20 to-amber-600/10 rounded-2xl p-4 border border-orange-500/20 flex items-center gap-4">
                                    <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center"><Flame className="w-6 h-6 text-orange-400" /></div>
                                    <div className="flex-1">
                                        <p className="font-bold text-white">{playerStats.dailyStreak} jours consécutifs</p>
                                        <p className="text-xs text-orange-400/80">Continuez à jouer chaque jour !</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Game Mode Selection */}
                        <div className="flex-1 px-6">
                            <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">Lancer un Duel</h2>
                            <div className="space-y-3">
                                {(['all', 'easy', 'medium', 'hard'] as const).map(d => {
                                    const config = { all: { label: 'Toutes Difficultés', icon: '🎲', color: 'indigo', desc: 'Mix de questions' }, easy: { label: 'Facile', icon: '🌱', color: 'emerald', desc: '20s • Questions fondamentales' }, medium: { label: 'Moyen', icon: '⚡', color: 'amber', desc: '15s • Connaissances avancées' }, hard: { label: 'Difficile', icon: '🔥', color: 'red', desc: '10s • Questions d\'expert' } }[d];
                                    return (
                                        <Button
                                            key={d}
                                            variant="ghost"
                                            className={`w-full h-20 rounded-2xl bg-gradient-to-r from-${config.color}-600/20 to-${config.color}-600/5 border border-${config.color}-500/20 hover:border-${config.color}-500/40 justify-start px-5 group transition-all hover:scale-[1.02]`}
                                            onClick={() => startSoloGame(d)}
                                        >
                                            <div className="flex items-center gap-3 w-full">
                                                <span className="text-2xl">{config.icon}</span>
                                                <div className="text-left flex-1">
                                                    <h3 className="font-bold text-white">{config.label}</h3>
                                                    <p className="text-xs text-slate-400">{config.desc}</p>
                                                </div>
                                                <ChevronRight className="h-5 w-5 text-slate-600 group-hover:translate-x-1 transition-transform" />
                                            </div>
                                        </Button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="px-6 pb-8 mt-4 flex gap-3">
                            <Button
                                variant="ghost"
                                className="flex-1 h-14 rounded-2xl bg-white/5 border border-white/10"
                                onClick={() => { setLeaderboard(loadLeaderboard()); setGameState('leaderboard'); }}
                            >
                                <Crown className="h-5 w-5 mr-2 text-amber-400" />
                                Classement
                            </Button>
                            <Button
                                variant="ghost"
                                className="flex-1 h-14 rounded-2xl bg-white/5 border border-white/10"
                                onClick={() => setGameState('badges')}
                            >
                                <Medal className="h-5 w-5 mr-2 text-purple-400" />
                                Badges ({playerStats.badges.length})
                            </Button>
                        </div>
                    </motion.div>
                )}

                {/* ========== LEADERBOARD ========== */}
                {gameState === 'leaderboard' && (
                    <motion.div
                        key="leaderboard"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="relative z-10 min-h-screen flex flex-col"
                    >
                        <header className="px-6 pt-10 pb-4 flex items-center gap-3">
                            <Button variant="ghost" size="icon" onClick={() => setGameState('menu')}><ArrowLeft className="h-6 w-6" /></Button>
                            <div>
                                <h1 className="text-2xl font-black">🏆 Classement</h1>
                                <p className="text-xs text-slate-500">Vos meilleurs scores</p>
                            </div>
                        </header>
                        <div className="flex-1 px-6 pb-20 space-y-2 overflow-y-auto">
                            {leaderboard.length === 0 ? (
                                <div className="text-center text-slate-500 py-20">
                                    <Trophy className="w-12 h-12 mx-auto mb-4 opacity-30" />
                                    <p>Aucun score enregistré. Jouez pour commencer !</p>
                                </div>
                            ) : leaderboard.map((entry, i) => (
                                <div key={i} className={cn("flex items-center gap-3 p-3 rounded-xl", i < 3 ? "bg-amber-500/10 border border-amber-500/20" : "bg-white/5")}>
                                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm", i === 0 ? "bg-gradient-to-br from-amber-400 to-amber-600 text-black" : i === 1 ? "bg-gradient-to-br from-slate-300 to-slate-500 text-black" : i === 2 ? "bg-gradient-to-br from-amber-700 to-amber-900 text-white" : "bg-white/10 text-slate-400")}>
                                        {i + 1}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-sm">{entry.name}</p>
                                        <p className="text-[10px] text-slate-500">{entry.date} • Nv.{entry.level}</p>
                                    </div>
                                    <span className="font-black text-amber-400">{entry.score}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* ========== BADGES ========== */}
                {gameState === 'badges' && (
                    <motion.div
                        key="badges"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="relative z-10 min-h-screen flex flex-col"
                    >
                        <header className="px-6 pt-10 pb-4 flex items-center gap-3">
                            <Button variant="ghost" size="icon" onClick={() => setGameState('menu')}><ArrowLeft className="h-6 w-6" /></Button>
                            <div>
                                <h1 className="text-2xl font-black">🏅 Badges</h1>
                                <p className="text-xs text-slate-500">{playerStats.badges.length}/{Object.keys(BADGE_DEFINITIONS).length} débloqués</p>
                            </div>
                        </header>
                        <div className="flex-1 px-6 pb-20 overflow-y-auto">
                            <div className="grid grid-cols-2 gap-3">
                                {Object.entries(BADGE_DEFINITIONS).map(([id, badge]) => {
                                    const unlocked = playerStats.badges.includes(id);
                                    return (
                                        <Card key={id} className={cn("rounded-2xl border", unlocked ? "bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20" : "bg-white/5 border-white/5 opacity-40")}>
                                            <CardContent className="p-4 text-center">
                                                <div className="text-3xl mb-2">{unlocked ? badge.icon : '🔒'}</div>
                                                <h3 className="font-bold text-xs text-white">{badge.name}</h3>
                                                <p className="text-[10px] text-slate-400 mt-1">{badge.description}</p>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Countdown Overlay */}
            <AnimatePresence>
                {gameState === 'countdown' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl"
                    >
                        <motion.div
                            key={countdown}
                            initial={{ scale: 3, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.5, opacity: 0 }}
                            transition={{ type: 'spring', damping: 15 }}
                            className="text-center"
                        >
                            {countdown > 0 ? (
                                <div className="text-9xl font-black bg-gradient-to-b from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent">
                                    {countdown}
                                </div>
                            ) : (
                                <div className="text-6xl font-black text-indigo-400 animate-pulse">
                                    GO !
                                </div>
                            )}
                            <p className="text-slate-400 mt-4 text-lg font-medium">
                                {gameQuestions.length} questions • {mode === 'multiplayer' ? `${players.length} joueurs` : 'Mode solo'}
                            </p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ========== GAME PLAYING UI ========== */}
            {(gameState === 'playing' || gameState === 'feedback' || gameState === 'finished') && (
                <>
                    {/* Top Bar */}
                    <header className="relative z-10 px-4 pt-6 pb-2">
                        <div className="flex items-center justify-between max-w-2xl mx-auto">
                            <Button variant="ghost" size="icon" onClick={onBack} className="text-slate-500 hover:text-white rounded-full w-10 h-10">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-1.5">
                                    <Star className="w-4 h-4 text-amber-400" />
                                    <span className="text-sm font-bold text-amber-300 font-mono">{score}</span>
                                </div>
                                <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5">
                                    <Clock className="w-4 h-4 text-slate-400" />
                                    <span className="text-sm font-mono text-slate-300">{formatTime(elapsedTime)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="max-w-2xl mx-auto mt-4">
                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progressPercent}%` }}
                                    transition={{ duration: 0.5, ease: 'easeOut' }}
                                />
                            </div>
                            <div className="flex justify-between mt-1.5 text-[10px] text-slate-600 font-medium">
                                <span>Question {currentIndex + 1}/{gameQuestions.length}</span>
                                {roundInfo && (
                                    <span>Manche {roundInfo.current}/{roundInfo.total}</span>
                                )}
                            </div>
                        </div>
                    </header>

                    {/* Multiplayer Progress */}
                    {mode === 'multiplayer' && players.length > 0 && gameState !== 'finished' && (
                        <div className="relative z-10 px-4 max-w-2xl mx-auto w-full mt-2">
                            <div className="bg-black/30 border border-white/5 rounded-xl p-3 space-y-2">
                                {players.filter(p => p.id !== currentUserId).map(p => (
                                    <div key={p.id} className="flex items-center gap-2 text-xs">
                                        <div className="w-16 truncate text-slate-400 font-medium">{p.display_name}</div>
                                        <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                            <motion.div className="h-full bg-indigo-500/60 rounded-full" animate={{ width: `${p.progress}%` }} transition={{ duration: 0.5 }} />
                                        </div>
                                        <span className="text-[10px] text-slate-600 w-8 text-right font-mono">{p.progress}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Main Game Area */}
                    <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-6 max-w-2xl mx-auto w-full">
                        <AnimatePresence mode="wait">
                            {(gameState === 'playing' || gameState === 'feedback') && gameQuestions[currentIndex] && (
                                <motion.div
                                    key={currentIndex}
                                    initial={{ opacity: 0, y: 30 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -30 }}
                                    transition={{ type: 'spring', damping: 20 }}
                                    className={cn("w-full space-y-6", shakeWrong && "animate-[shake_0.5s_ease-in-out]")}
                                >
                                    {/* Question Timer Ring */}
                                    <div className="flex justify-center mb-2">
                                        <div className="relative w-14 h-14">
                                            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                                                <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                                                <circle cx="28" cy="28" r="24" fill="none" stroke={questionTimer > 10 ? '#22c55e' : questionTimer > 5 ? '#f59e0b' : '#ef4444'} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(questionTimer / 15) * 150.8} 150.8`} className="transition-all duration-1000" />
                                            </svg>
                                            <div className={cn("absolute inset-0 flex items-center justify-center font-bold text-lg font-mono", getTimerColor())}>
                                                {questionTimer}
                                            </div>
                                        </div>
                                    </div>
                                    {streak > 1 && (
                                        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center justify-center gap-2">
                                            <Flame className="w-4 h-4 text-orange-400" />
                                            <span className="text-orange-400 text-sm font-bold">Série de {streak} !</span>
                                        </motion.div>
                                    )}
                                    <div className="bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/10 rounded-3xl p-8 backdrop-blur-sm shadow-2xl">
                                        <div className="flex justify-center mb-3">
                                            {getDifficultyBadge((gameQuestions[currentIndex] as any)?.difficulty)}
                                        </div>
                                        <h3 className="text-xl md:text-2xl font-bold text-center leading-relaxed text-white/95">
                                            {gameQuestions[currentIndex].question}
                                        </h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {gameQuestions[currentIndex].options.map((opt, i) => {
                                            const isSelected = selectedOption === i;
                                            const isCorrectOption = i === gameQuestions[currentIndex].correct;
                                            const showResult = selectedOption !== null;
                                            return (
                                                <motion.button key={i} whileHover={!showResult ? { scale: 1.02, y: -2 } : {}} whileTap={!showResult ? { scale: 0.98 } : {}} onClick={() => handleAnswer(i)} disabled={selectedOption !== null}
                                                    className={cn(
                                                        "relative flex items-center gap-4 p-4 rounded-2xl border text-left transition-all duration-300",
                                                        !showResult && `bg-gradient-to-br ${optColors[i]} cursor-pointer`,
                                                        showResult && isSelected && isCorrectOption && "bg-green-500/20 border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.2)]",
                                                        showResult && isSelected && !isCorrectOption && "bg-red-500/20 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]",
                                                        showResult && !isSelected && isCorrectOption && "bg-green-500/10 border-green-500/50",
                                                        showResult && !isSelected && !isCorrectOption && "bg-white/[0.02] border-white/5 opacity-40",
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shrink-0 transition-all",
                                                        !showResult && "bg-white/10 text-white/80",
                                                        showResult && isSelected && isCorrectOption && "bg-green-500 text-white",
                                                        showResult && isSelected && !isCorrectOption && "bg-red-500 text-white",
                                                        showResult && !isSelected && isCorrectOption && "bg-green-500/50 text-green-200",
                                                        showResult && !isSelected && !isCorrectOption && "bg-white/5 text-white/30",
                                                    )}>{optLabels[i]}</div>
                                                    <span className="flex-1 font-medium text-sm md:text-base">{opt}</span>
                                                    {showResult && isSelected && (
                                                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 10 }}>
                                                            {isCorrectOption ? <CheckCircle2 className="w-6 h-6 text-green-400" /> : <XCircle className="w-6 h-6 text-red-400" />}
                                                        </motion.div>
                                                    )}
                                                </motion.button>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            )}

                            {/* Finished Screen */}
                            {gameState === 'finished' && (
                                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full text-center space-y-8">
                                    <motion.div animate={{ y: [0, -10, 0], rotateZ: [0, -3, 3, 0] }} transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }} className="mx-auto">
                                        <div className="w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 border border-amber-500/30 flex items-center justify-center shadow-2xl shadow-amber-500/10">
                                            <Trophy className="w-12 h-12 text-amber-400" />
                                        </div>
                                    </motion.div>
                                    <div>
                                        <h2 className="text-4xl font-black bg-gradient-to-r from-white via-amber-200 to-amber-400 bg-clip-text text-transparent">Partie terminée !</h2>
                                        <p className="text-slate-500 mt-2">
                                            {correctCount >= gameQuestions.length * 0.8 ? '🏆 Excellent travail !' : correctCount >= gameQuestions.length * 0.6 ? '👏 Bien joué !' : correctCount >= gameQuestions.length * 0.4 ? '📖 Pas mal !' : '💪 Ne lâche rien !'}
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4">
                                            <Target className="w-5 h-5 text-green-400 mx-auto mb-2" />
                                            <div className="text-2xl font-black text-green-400">{correctCount}/{gameQuestions.length}</div>
                                            <div className="text-[10px] text-slate-500 uppercase font-bold mt-1">Correctes</div>
                                        </div>
                                        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4">
                                            <Clock className="w-5 h-5 text-cyan-400 mx-auto mb-2" />
                                            <div className="text-2xl font-black text-cyan-400">{formatTime(elapsedTime)}</div>
                                            <div className="text-[10px] text-slate-500 uppercase font-bold mt-1">Temps</div>
                                        </div>
                                        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4">
                                            <Flame className="w-5 h-5 text-orange-400 mx-auto mb-2" />
                                            <div className="text-2xl font-black text-orange-400">{maxStreak}</div>
                                            <div className="text-[10px] text-slate-500 uppercase font-bold mt-1">Série max</div>
                                        </div>
                                    </div>
                                    <div className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-indigo-500/30 rounded-2xl p-6">
                                        <div className="text-5xl font-black bg-gradient-to-r from-indigo-300 to-purple-300 bg-clip-text text-transparent">{score}</div>
                                        <div className="text-sm text-indigo-400 font-bold mt-1">SCORE TOTAL</div>
                                        {earnedXP > 0 && (
                                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mt-3 flex items-center justify-center gap-2">
                                                <TrendingUp className="w-4 h-4 text-emerald-400" />
                                                <span className="text-emerald-400 font-bold text-sm">+{earnedXP} XP gagnés</span>
                                            </motion.div>
                                        )}
                                        {showLevelUp && (
                                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.8 }} className="mt-2 bg-amber-500/20 border border-amber-500/30 rounded-xl p-2 text-center">
                                                <span className="text-amber-400 font-black text-sm">🎉 Niveau {playerStats.level} atteint !</span>
                                            </motion.div>
                                        )}
                                    </div>
                                    {newBadges.length > 0 && (
                                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }} className="space-y-2">
                                            <h3 className="text-xs font-black text-amber-400 uppercase tracking-wider text-center flex items-center justify-center gap-2"><Gift className="w-4 h-4" /> Nouveaux badges !</h3>
                                            <div className="flex gap-2 justify-center">
                                                {newBadges.map(id => (
                                                    <motion.div key={id} initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', damping: 10 }} className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 text-center">
                                                        <div className="text-2xl">{BADGE_DEFINITIONS[id]?.icon}</div>
                                                        <p className="text-[10px] text-amber-400 font-bold mt-1">{BADGE_DEFINITIONS[id]?.name}</p>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                    {mode === 'multiplayer' && (
                                        <div className="w-full bg-black/30 border border-white/5 rounded-2xl p-5">
                                            <h4 className="text-xs font-black text-slate-500 mb-4 uppercase tracking-wider flex items-center gap-2 justify-center">
                                                <Crown className="w-4 h-4 text-amber-400" /> Classement
                                            </h4>
                                            <div className="space-y-2">
                                                {[...players].sort((a, b) => { if (a.status === 'finished' && b.status !== 'finished') return -1; if (b.status === 'finished' && a.status !== 'finished') return 1; return (b.score || 0) - (a.score || 0); }).map((p, i) => (
                                                    <motion.div key={p.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                                                        className={cn("flex items-center justify-between p-3 rounded-xl", p.id === currentUserId ? "bg-indigo-500/15 border border-indigo-500/30" : "bg-white/[0.03]")}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black", i === 0 ? "bg-gradient-to-br from-amber-400 to-amber-600 text-black" : i === 1 ? "bg-gradient-to-br from-slate-300 to-slate-500 text-black" : i === 2 ? "bg-gradient-to-br from-amber-700 to-amber-900 text-white" : "bg-white/10 text-slate-400")}>{i + 1}</div>
                                                            <span className={cn("text-sm font-medium", p.id === currentUserId && "text-indigo-300 font-bold")}>{p.display_name} {p.id === currentUserId && "(Moi)"}</span>
                                                        </div>
                                                        <div>
                                                            {p.status === 'finished' ? (
                                                                <Badge className="bg-green-500/20 text-green-400 border-none font-mono text-xs">{p.score !== undefined ? `${p.score}pts` : 'Fini'}</Badge>
                                                            ) : (
                                                                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" /><span className="text-[10px] text-slate-500">{p.progress}%</span></div>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </div>
                                            <div className="mt-4 text-xs text-center font-medium">
                                                {players.every(p => p.status === 'finished') ? <span className="text-green-400">🏁 Tous les joueurs ont terminé</span> : <span className="text-slate-500 animate-pulse">⏳ En attente des autres joueurs...</span>}
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex flex-col gap-3 max-w-xs mx-auto w-full">
                                        <Button onClick={handleReplay} size="lg" className="w-full h-14 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 font-bold rounded-2xl shadow-lg shadow-emerald-600/20 text-base">
                                            <RotateCcw className="w-5 h-5 mr-2" /> Rejouer
                                        </Button>
                                        <div className="flex gap-2 justify-center">
                                            {(['all', 'easy', 'medium', 'hard'] as const).map(d => (
                                                <Button key={d} size="sm" variant={selectedDifficulty === d ? 'default' : 'ghost'} onClick={() => setSelectedDifficulty(d)}
                                                    className={cn("rounded-full text-xs px-3 h-8", selectedDifficulty === d && d === 'easy' && 'bg-green-600 hover:bg-green-500', selectedDifficulty === d && d === 'medium' && 'bg-amber-600 hover:bg-amber-500', selectedDifficulty === d && d === 'hard' && 'bg-red-600 hover:bg-red-500', selectedDifficulty === d && d === 'all' && 'bg-indigo-600 hover:bg-indigo-500')}
                                                >{d === 'all' ? 'Tout' : d === 'easy' ? 'Facile' : d === 'medium' ? 'Moyen' : 'Difficile'}</Button>
                                            ))}
                                        </div>
                                        {mode === 'multiplayer' ? (
                                            <>
                                                {isHost && roundInfo && onNextRound && roundInfo.current < roundInfo.total ? (
                                                    <Button onClick={onNextRound} size="lg" className="w-full h-14 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 font-bold rounded-2xl shadow-lg shadow-green-600/20 text-base">Manche suivante ({roundInfo.current}/{roundInfo.total})</Button>
                                                ) : (
                                                    <Button onClick={onBack} size="lg" className="w-full h-14 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 font-bold rounded-2xl shadow-lg shadow-indigo-600/20 text-base">Retour au Salon</Button>
                                                )}
                                                <Button onClick={onBack} variant="ghost" className="w-full text-slate-500 hover:text-red-400 rounded-xl">Quitter la partie</Button>
                                            </>
                                        ) : (
                                            <>
                                                <Button onClick={() => setGameState('menu')} variant="ghost" size="lg" className="w-full text-slate-500 hover:text-white rounded-xl">Retour au menu</Button>
                                                <Button variant="ghost" className="w-full text-slate-500 rounded-xl" onClick={() => { setLeaderboard(loadLeaderboard()); setGameState('leaderboard'); }}>
                                                    <Crown className="w-4 h-4 mr-2 text-amber-400" /> Voir le classement
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </main>
                </>
            )}

            {/* Shake animation */}
            <style jsx global>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
                    20%, 40%, 60%, 80% { transform: translateX(4px); }
                }
            `}</style>
        </div>
    );
}
