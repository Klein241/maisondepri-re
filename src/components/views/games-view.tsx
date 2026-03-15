'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Gamepad2, Swords, Search, BookOpen, Users, Trophy, Zap, Crown, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import dynamic from 'next/dynamic';
import { getGameHistory, getGameStats, formatGameTypeName, getGameTypeEmoji, type GameHistoryEntry } from '@/lib/game-history';

// Lazy load game components
const BibleQuiz = dynamic(() => import('@/components/games/bible-quiz').then(m => ({ default: m.BibleQuiz })), { ssr: false });
const BibleMemoryGame = dynamic(() => import('@/components/games/bible-memory-game').then(m => ({ default: m.BibleMemoryGame })), { ssr: false });
const MultiplayerManager = dynamic(() => import('@/components/games/multiplayer-manager').then(m => ({ default: m.MultiplayerManager })), { ssr: false });
const WordSearchGame = dynamic(() => import('@/components/games/word-search-game').then(m => ({ default: m.WordSearchGame })), { ssr: false });
const ChronoGame = dynamic(() => import('@/components/games/chrono-game').then(m => ({ default: m.ChronoGame })), { ssr: false });
const WhoAmIGame = dynamic(() => import('@/components/games/who-am-i-game').then(m => ({ default: m.WhoAmIGame })), { ssr: false });


interface GamesViewProps {
    onBack?: () => void;
}

type GameId = 'quiz' | 'memory' | 'word_search' | 'chrono' | 'who_am_i' | 'multiplayer' | 'multiplayer_groups' | null;

const GAME_CARDS = [

    {
        id: 'quiz' as GameId,
        title: '📖 Quiz Biblique',
        subtitle: 'Solo • 4 difficultés',
        description: 'Testez vos connaissances bibliques avec des quiz interactifs',
        gradient: 'from-indigo-600 to-purple-600',
        glow: 'shadow-indigo-500/30',
    },
    {
        id: 'multiplayer' as GameId,
        title: '⚔️ Duel Biblique',
        subtitle: 'Multijoueur • En ligne',
        description: 'Affrontez vos amis en duel de connaissances bibliques !',
        gradient: 'from-rose-600 to-pink-600',
        glow: 'shadow-rose-500/30',
    },
    {
        id: 'memory' as GameId,
        title: '🧠 Mémoire Biblique',
        subtitle: 'Solo • 3 niveaux',
        description: 'Retrouvez les paires de versets bibliques',
        gradient: 'from-cyan-600 to-blue-600',
        glow: 'shadow-cyan-500/30',
    },
    {
        id: 'word_search' as GameId,
        title: '🔍 Mots Cachés',
        subtitle: 'Solo • Thèmes bibliques',
        description: 'Trouvez les mots cachés dans la grille',
        gradient: 'from-emerald-600 to-teal-600',
        glow: 'shadow-emerald-500/30',
    },
    {
        id: 'chrono' as GameId,
        title: '⏱️ Chronologie',
        subtitle: 'Solo • Histoire biblique',
        description: 'Remettez les événements bibliques dans le bon ordre',
        gradient: 'from-violet-600 to-fuchsia-600',
        glow: 'shadow-violet-500/30',
    },
    {
        id: 'who_am_i' as GameId,
        title: '🎭 Qui suis-je ?',
        subtitle: 'Solo • Personnages bibliques',
        description: 'Devinez le personnage biblique à partir des indices',
        gradient: 'from-yellow-600 to-orange-500',
        glow: 'shadow-yellow-500/30',
    },
    {
        id: 'multiplayer_groups' as GameId,
        title: '👥 Groupes de Joueurs',
        subtitle: 'Multijoueur • Communauté',
        description: 'Rejoignez un groupe et jouez ensemble',
        gradient: 'from-sky-600 to-blue-600',
        glow: 'shadow-sky-500/30',
    },
];

export function GamesView({ onBack }: GamesViewProps) {
    const [activeGame, setActiveGame] = useState<GameId>(null);

    // ── Active game rendering ──
    if (activeGame) {
        switch (activeGame) {

            case 'quiz':
                return <BibleQuiz onBack={() => setActiveGame(null)} />;
            case 'memory':
                return <BibleMemoryGame onBack={() => setActiveGame(null)} />;
            case 'multiplayer':
                return <MultiplayerManager onBack={() => setActiveGame(null)} />;
            case 'word_search':
                return <WordSearchGame onBack={() => setActiveGame(null)} />;
            case 'chrono':
                return <ChronoGame onBack={() => setActiveGame(null)} />;
            case 'who_am_i':
                return <WhoAmIGame onBack={() => setActiveGame(null)} />;
            case 'multiplayer_groups':
                return <MultiplayerManager onBack={() => setActiveGame(null)} initialView="groups" />;
        }
    }

    // ── Stats ──
    const stats = getGameStats();
    const history = getGameHistory().slice(0, 5);

    return (
        <div className="flex flex-col min-h-screen bg-linear-to-b from-slate-900 via-slate-950 to-black text-white">
            {/* Header */}
            <header className="px-4 pt-10 pb-4 shrink-0">
                <div className="flex items-center gap-3 mb-4">
                    {onBack && (
                        <Button variant="ghost" size="icon" onClick={onBack}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    )}
                    <div className="flex-1">
                        <h1 className="text-2xl font-black flex items-center gap-2">
                            <Gamepad2 className="h-6 w-6 text-emerald-400" />
                            Jeux Bibliques
                        </h1>
                        <p className="text-sm text-slate-500">Apprenez en vous amusant</p>
                    </div>
                    {stats.totalGamesPlayed > 0 && (
                        <Badge className="bg-amber-500/20 text-amber-400 text-xs">
                            <Trophy className="h-3 w-3 mr-1" />
                            {stats.bestScore} pts
                        </Badge>
                    )}
                </div>

                {/* Stats bar */}
                {stats.totalGamesPlayed > 0 && (
                    <div className="bg-white/5 rounded-2xl p-3 flex items-center justify-around border border-white/5">
                        <div className="text-center">
                            <p className="text-lg font-black text-white">{stats.totalGamesPlayed}</p>
                            <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Parties</p>
                        </div>
                        <div className="w-px h-6 bg-white/10" />
                        <div className="text-center">
                            <p className="text-lg font-black text-amber-400">{stats.bestScore}</p>
                            <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Record</p>
                        </div>
                        <div className="w-px h-6 bg-white/10" />
                        <div className="text-center">
                            <p className="text-lg font-black text-indigo-400">{Math.floor(stats.totalTimeSeconds / 60)}m</p>
                            <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Temps</p>
                        </div>
                        <div className="w-px h-6 bg-white/10" />
                        <div className="text-center">
                            <p className="text-lg font-black text-emerald-400">{stats.totalStars}⭐</p>
                            <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Étoiles</p>
                        </div>
                    </div>
                )}
            </header>

            {/* Games Grid */}
            <div className="flex-1 px-4 pb-24 space-y-3 overflow-y-auto">
                {GAME_CARDS.map((game, idx) => (
                    <motion.button
                        key={game.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.06 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setActiveGame(game.id)}
                        className={`w-full text-left rounded-2xl overflow-hidden relative shadow-xl ${game.glow}`}
                    >
                        <div className={`bg-linear-to-r ${game.gradient} p-4`}>

                            <div className="flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-black text-white text-sm">
                                        {game.title}
                                    </h3>
                                    <p className="text-[10px] text-white/60 font-medium">{game.subtitle}</p>
                                    <p className="text-[11px] text-white/80 mt-1 line-clamp-1">{game.description}</p>
                                </div>
                                <div className="shrink-0 w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
                                    <Zap className="h-5 w-5 text-white" />
                                </div>
                            </div>
                        </div>
                    </motion.button>
                ))}

                {/* Recent History */}
                {history.length > 0 && (
                    <div className="mt-6 space-y-3">
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Parties récentes</h3>
                        {history.map((entry, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                                <span className="text-lg">{getGameTypeEmoji(entry.gameType)}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold truncate">{formatGameTypeName(entry.gameType)}</p>
                                    <p className="text-[10px] text-slate-500">
                                        {entry.score} pts • {entry.stars}⭐ • {new Date(entry.completedAt).toLocaleDateString('fr-FR')}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
