'use client';

/**
 * LABYRINTHE DE LA FOI — Composant React Principal
 * ═════════════════════════════════════════════════
 * Menu → Sélection personnage → Jeu 3D → Quiz
 * 100% offline, léger, sauvegarde localStorage
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    GAME_CONFIGS, CHARACTERS, BIBLE_QUESTIONS,
    generateMaze, castRays, renderFrame, saveProgress, loadProgress,
    type GameConfig, type PlayerState, type MazeCell
} from './labyrinth-engine';

interface LabyrinthGameProps {
    onBack?: () => void;
}

type GamePhase = 'menu' | 'character' | 'playing' | 'question' | 'levelComplete' | 'gameOver' | 'victory';

export default function LabyrinthGame({ onBack }: LabyrinthGameProps) {
    // ── State ──
    const [phase, setPhase] = useState<GamePhase>('menu');
    const [selectedGame, setSelectedGame] = useState<GameConfig | null>(null);
    const [selectedChar, setSelectedChar] = useState(CHARACTERS[0]);
    const [player, setPlayer] = useState<PlayerState | null>(null);
    const [maze, setMaze] = useState<MazeCell[][] | null>(null);
    const [currentQuestion, setCurrentQuestion] = useState<typeof BIBLE_QUESTIONS[0] | null>(null);
    const [showMinimap, setShowMinimap] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [totalScore, setTotalScore] = useState(0);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const keysRef = useRef<Set<string>>(new Set());
    const animFrameRef = useRef<number>(0);
    const playerRef = useRef<PlayerState | null>(null);
    const mazeRef = useRef<MazeCell[][] | null>(null);
    const touchStartRef = useRef<{ x: number; y: number } | null>(null);

    // Keep refs in sync
    useEffect(() => { playerRef.current = player; }, [player]);
    useEffect(() => { mazeRef.current = maze; }, [maze]);

    // ── Start Level ──
    const startLevel = useCallback((game: GameConfig, level: number, lives?: number) => {
        const size = 11 + level * 2; // Maze grows with level
        const newMaze = generateMaze(size, size, level);
        const newPlayer: PlayerState = {
            x: 1.5, y: 1.5, angle: 0,
            lives: lives ?? game.maxLives,
            score: 0, level,
            gadgets: Object.fromEntries(game.gadgets.map(g => [g.name, g.usesPerLevel])),
            badges: [],
            speed: 0.04 * selectedChar.speed,
            boosted: false, boostEnd: 0,
        };
        setMaze(newMaze);
        setPlayer(newPlayer);
        setTimeLeft(60 + level * 15);
        setPhase('playing');
    }, [selectedChar]);

    // ── Game Loop ──
    useEffect(() => {
        if (phase !== 'playing' || !canvasRef.current || !playerRef.current || !mazeRef.current || !selectedGame) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let lastTime = 0;
        const loop = (time: number) => {
            const dt = Math.min(time - lastTime, 50);
            lastTime = time;
            const p = playerRef.current!;
            const m = mazeRef.current!;
            const keys = keysRef.current;

            // Movement
            const spd = p.boosted ? p.speed * 1.5 : p.speed;
            const rotSpd = 0.04;
            let nx = p.x, ny = p.y, na = p.angle;

            if (keys.has('ArrowLeft') || keys.has('a') || keys.has('q')) na -= rotSpd;
            if (keys.has('ArrowRight') || keys.has('d')) na += rotSpd;
            if (keys.has('ArrowUp') || keys.has('w') || keys.has('z')) {
                nx += Math.cos(na) * spd;
                ny += Math.sin(na) * spd;
            }
            if (keys.has('ArrowDown') || keys.has('s')) {
                nx -= Math.cos(na) * spd * 0.6;
                ny -= Math.sin(na) * spd * 0.6;
            }

            // Collision
            const margin = 0.2;
            if (m[Math.floor(ny)]?.[Math.floor(nx + margin)]?.wall || m[Math.floor(ny)]?.[Math.floor(nx - margin)]?.wall) nx = p.x;
            if (m[Math.floor(ny + margin)]?.[Math.floor(nx)]?.wall || m[Math.floor(ny - margin)]?.[Math.floor(nx)]?.wall) ny = p.y;

            // Check cell type
            const cellX = Math.floor(nx), cellY = Math.floor(ny);
            const cell = m[cellY]?.[cellX];
            if (cell && !cell.collected) {
                if (cell.type === 'exit') {
                    // Level complete!
                    const newScore = totalScore + p.score + (100 * p.level);
                    setTotalScore(newScore);
                    if (p.level >= selectedGame.levels) {
                        saveProgress(selectedGame.id, { level: p.level, score: newScore, completed: true });
                        setPhase('victory');
                    } else {
                        setPhase('levelComplete');
                    }
                    return;
                }
                if (cell.type === 'question') {
                    const q = BIBLE_QUESTIONS[cell.questionId ?? 0];
                    setCurrentQuestion(q);
                    cell.collected = true;
                    setPhase('question');
                    return;
                }
                if (cell.type === 'gadget') {
                    cell.collected = true;
                    const gadgetName = selectedGame.gadgets[Math.floor(Math.random() * selectedGame.gadgets.length)].name;
                    p.gadgets[gadgetName] = (p.gadgets[gadgetName] || 0) + 1;
                    // Small visual feedback would happen here
                }
                if (cell.type === 'trap' && !p.boosted) {
                    cell.collected = true;
                    p.lives -= 1;
                    if (p.lives <= 0) {
                        setPhase('gameOver');
                        return;
                    }
                }
            }

            // Boost timeout
            if (p.boosted && Date.now() > p.boostEnd) {
                p.boosted = false;
            }

            p.x = nx; p.y = ny; p.angle = na;

            // Render
            const W = canvas.width;
            const H = canvas.height;
            const rays = castRays(p, m, W, H);
            renderFrame(ctx, rays, selectedGame, W, H);

            // HUD overlay
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(0, 0, W, 36);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px sans-serif';
            ctx.fillText(`${selectedGame.emoji} Niv.${p.level}`, 8, 24);
            // Lives
            let lx = 90;
            for (let i = 0; i < selectedGame.maxLives; i++) {
                ctx.globalAlpha = i < p.lives ? 1 : 0.2;
                ctx.fillText(selectedGame.liveIcon, lx, 24);
                lx += 20;
            }
            ctx.globalAlpha = 1;
            ctx.fillText(`⭐ ${p.score}`, W - 70, 24);

            // Minimap
            if (showMinimap) {
                const ms = 3;
                const mw = m[0].length * ms;
                const mh = m.length * ms;
                ctx.fillStyle = 'rgba(0,0,0,0.7)';
                ctx.fillRect(W - mw - 8, 40, mw + 4, mh + 4);
                for (let y = 0; y < m.length; y++) {
                    for (let x = 0; x < m[0].length; x++) {
                        if (m[y][x].wall) {
                            ctx.fillStyle = '#555';
                        } else if (m[y][x].type === 'exit') {
                            ctx.fillStyle = '#0f0';
                        } else if (m[y][x].type === 'question' && !m[y][x].collected) {
                            ctx.fillStyle = '#ff0';
                        } else {
                            continue;
                        }
                        ctx.fillRect(W - mw - 6 + x * ms, 42 + y * ms, ms, ms);
                    }
                }
                // Player dot
                ctx.fillStyle = '#f00';
                ctx.fillRect(W - mw - 6 + p.x * ms - 1, 42 + p.y * ms - 1, 3, 3);
            }

            // Mobile controls hint (bottom of screen)
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.font = '11px sans-serif';
            ctx.fillText('← Tourner | ↑ Avancer | ↓ Reculer →', W / 2 - 90, H - 10);

            animFrameRef.current = requestAnimationFrame(loop);
        };

        animFrameRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animFrameRef.current);
    }, [phase, selectedGame, showMinimap, totalScore]);

    // ── Timer ──
    useEffect(() => {
        if (phase !== 'playing') return;
        const interval = setInterval(() => {
            setTimeLeft(t => {
                if (t <= 1) {
                    setPhase('gameOver');
                    return 0;
                }
                return t - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [phase]);

    // ── Keyboard ──
    useEffect(() => {
        const onDown = (e: KeyboardEvent) => {
            keysRef.current.add(e.key);
            if (e.key === 'm') setShowMinimap(v => !v);
        };
        const onUp = (e: KeyboardEvent) => keysRef.current.delete(e.key);
        window.addEventListener('keydown', onDown);
        window.addEventListener('keyup', onUp);
        return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
    }, []);

    // ── Touch controls ──
    const handleTouchStart = (e: React.TouchEvent) => {
        const t = e.touches[0];
        touchStartRef.current = { x: t.clientX, y: t.clientY };
    };
    const handleTouchMove = (e: React.TouchEvent) => {
        if (!touchStartRef.current) return;
        const t = e.touches[0];
        const dx = t.clientX - touchStartRef.current.x;
        const dy = t.clientY - touchStartRef.current.y;
        keysRef.current.clear();
        if (Math.abs(dx) > Math.abs(dy)) {
            keysRef.current.add(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
        } else {
            keysRef.current.add(dy < 0 ? 'ArrowUp' : 'ArrowDown');
        }
    };
    const handleTouchEnd = () => { keysRef.current.clear(); touchStartRef.current = null; };

    // ── Answer Question ──
    const answerQuestion = (idx: number) => {
        if (!currentQuestion || !player || !selectedGame) return;
        if (idx === currentQuestion.correct) {
            setPlayer(p => p ? { ...p, score: p.score + 50, boosted: true, boostEnd: Date.now() + 3000 } : p);
        } else {
            setPlayer(p => {
                if (!p) return p;
                const lives = p.lives - 1;
                if (lives <= 0) { setPhase('gameOver'); return { ...p, lives: 0 }; }
                return { ...p, lives };
            });
        }
        setCurrentQuestion(null);
        setPhase('playing');
    };

    // ── Canvas sizing ──
    useEffect(() => {
        const resize = () => {
            if (!canvasRef.current) return;
            const parent = canvasRef.current.parentElement;
            if (!parent) return;
            canvasRef.current.width = Math.min(parent.clientWidth, 640);
            canvasRef.current.height = Math.min(parent.clientHeight, 400);
        };
        resize();
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, [phase]);

    // ═══════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════

    // ── MENU ──
    if (phase === 'menu') {
        return (
            <div className="flex flex-col h-full bg-gradient-to-b from-slate-900 to-slate-950 text-white overflow-y-auto">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0">
                    {onBack && <button onClick={onBack} className="text-slate-400 hover:text-white text-xl">←</button>}
                    <h1 className="text-lg font-bold">🏰 Les Labyrinthes de la Foi</h1>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
                    {GAME_CONFIGS.map(game => {
                        const progress = loadProgress(game.id);
                        return (
                            <motion.button
                                key={game.id}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => { setSelectedGame(game); setPhase('character'); }}
                                className="relative text-left p-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all"
                            >
                                <div className="flex items-start gap-3">
                                    <span className="text-3xl">{game.emoji}</span>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-sm">{game.name}</h3>
                                        <p className="text-[10px] text-slate-400 line-clamp-2">{game.description}</p>
                                        <div className="flex gap-2 mt-2">
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10">{game.levels} niveaux</span>
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10">{game.maxLives} {game.liveIcon}</span>
                                        </div>
                                        {progress?.completed && (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 mt-1 inline-block">✅ Terminé</span>
                                        )}
                                    </div>
                                </div>
                            </motion.button>
                        );
                    })}
                </div>
            </div>
        );
    }

    // ── CHARACTER SELECT ──
    if (phase === 'character' && selectedGame) {
        return (
            <div className="flex flex-col h-full bg-gradient-to-b from-slate-900 to-slate-950 text-white overflow-y-auto">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0">
                    <button onClick={() => setPhase('menu')} className="text-slate-400 hover:text-white text-xl">←</button>
                    <h2 className="font-bold">{selectedGame.emoji} {selectedGame.name}</h2>
                </div>
                <div className="p-4 space-y-4">
                    <h3 className="text-center text-sm font-semibold text-slate-300">Choisissez votre personnage</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {CHARACTERS.map(char => (
                            <motion.button
                                key={char.id}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setSelectedChar(char)}
                                className={`p-4 rounded-2xl border-2 transition-all text-center ${selectedChar.id === char.id
                                        ? 'border-indigo-500 bg-indigo-500/20'
                                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                                    }`}
                            >
                                <span className="text-4xl block mb-2">{char.emoji}</span>
                                <p className="font-bold text-sm">{char.name}</p>
                                <p className="text-[10px] text-slate-400">{char.description}</p>
                            </motion.button>
                        ))}
                    </div>
                    <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-slate-400">Gadgets disponibles :</h4>
                        <div className="flex flex-wrap gap-2">
                            {selectedGame.gadgets.map(g => (
                                <span key={g.name} className="text-[10px] px-2 py-1 rounded-lg bg-white/5 border border-white/10">
                                    {g.emoji} {g.name}
                                </span>
                            ))}
                        </div>
                    </div>
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => startLevel(selectedGame, 1)}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 font-bold text-lg shadow-lg"
                    >
                        ⚔️ Commencer l'aventure
                    </motion.button>
                </div>
            </div>
        );
    }

    // ── PLAYING ──
    if (phase === 'playing') {
        return (
            <div className="flex flex-col h-full bg-black text-white">
                {/* Timer bar */}
                <div className="flex items-center justify-between px-3 py-1 bg-black/80 shrink-0 text-xs">
                    <button onClick={() => setPhase('menu')} className="text-slate-400 hover:text-white">✕ Quitter</button>
                    <span className={timeLeft < 15 ? 'text-red-400 animate-pulse font-bold' : 'text-slate-300'}>
                        ⏱ {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                    </span>
                    <button onClick={() => setShowMinimap(v => !v)} className="text-slate-400 hover:text-white">
                        🗺️ Carte
                    </button>
                </div>
                {/* Canvas */}
                <div className="flex-1 relative"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    <canvas ref={canvasRef} className="w-full h-full" style={{ imageRendering: 'pixelated' }} />
                    {/* Mobile D-pad */}
                    <div className="absolute bottom-4 left-4 grid grid-cols-3 gap-1 sm:hidden">
                        <div />
                        <button onTouchStart={() => keysRef.current.add('ArrowUp')} onTouchEnd={() => keysRef.current.delete('ArrowUp')}
                            className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center text-xl active:bg-white/30">↑</button>
                        <div />
                        <button onTouchStart={() => keysRef.current.add('ArrowLeft')} onTouchEnd={() => keysRef.current.delete('ArrowLeft')}
                            className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center text-xl active:bg-white/30">←</button>
                        <button onTouchStart={() => keysRef.current.add('ArrowDown')} onTouchEnd={() => keysRef.current.delete('ArrowDown')}
                            className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center text-xl active:bg-white/30">↓</button>
                        <button onTouchStart={() => keysRef.current.add('ArrowRight')} onTouchEnd={() => keysRef.current.delete('ArrowRight')}
                            className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center text-xl active:bg-white/30">→</button>
                    </div>
                    {/* Gadget buttons */}
                    {player && selectedGame && (
                        <div className="absolute bottom-4 right-4 flex flex-col gap-2">
                            {selectedGame.gadgets.map(g => {
                                const uses = player.gadgets[g.name] || 0;
                                return (
                                    <button key={g.name} disabled={uses <= 0}
                                        onClick={() => {
                                            if (uses <= 0) return;
                                            setPlayer(p => p ? { ...p, gadgets: { ...p.gadgets, [g.name]: uses - 1 } } : p);
                                            if (g.name.includes('Boussole') || g.name.includes('Echo') || g.name.includes('Livre')) setShowMinimap(true);
                                            if (g.name.includes('Bouclier') || g.name.includes('Nuée') || g.name.includes('Bottes') || g.name.includes('Harpe')) {
                                                setPlayer(p => p ? { ...p, boosted: true, boostEnd: Date.now() + 5000 } : p);
                                            }
                                        }}
                                        className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg relative ${uses > 0 ? 'bg-white/20 active:bg-white/40' : 'bg-white/5 opacity-40'
                                            }`}
                                        title={g.description}
                                    >
                                        {g.emoji}
                                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-indigo-600 text-[9px] flex items-center justify-center font-bold">{uses}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ── QUESTION ──
    if (phase === 'question' && currentQuestion) {
        return (
            <div className="flex flex-col h-full bg-gradient-to-b from-slate-900 to-slate-950 text-white items-center justify-center p-6">
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className="max-w-md w-full bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 space-y-6">
                    <div className="text-center">
                        <span className="text-4xl">❓</span>
                        <h3 className="font-bold text-lg mt-2">{currentQuestion.q}</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                        {currentQuestion.answers.map((ans, i) => (
                            <motion.button key={i} whileTap={{ scale: 0.95 }}
                                onClick={() => answerQuestion(i)}
                                className="w-full py-3 px-4 rounded-xl bg-white/10 hover:bg-indigo-500/30 border border-white/10 text-sm font-medium text-left transition-all">
                                <span className="text-indigo-400 font-bold mr-2">{String.fromCharCode(65 + i)}.</span>
                                {ans}
                            </motion.button>
                        ))}
                    </div>
                    {player && (
                        <p className="text-center text-xs text-slate-500">
                            {selectedGame?.liveIcon} {player.lives} vies restantes | ⭐ {player.score} pts
                        </p>
                    )}
                </motion.div>
            </div>
        );
    }

    // ── LEVEL COMPLETE ──
    if (phase === 'levelComplete' && player && selectedGame) {
        return (
            <div className="flex flex-col h-full bg-gradient-to-b from-slate-900 to-slate-950 text-white items-center justify-center p-6">
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className="max-w-md w-full text-center space-y-6">
                    <span className="text-6xl block">🎉</span>
                    <h2 className="text-2xl font-bold">Niveau {player.level} terminé !</h2>
                    <p className="text-slate-400">Score: ⭐ {totalScore} | Vies: {player.lives} {selectedGame.liveIcon}</p>
                    <motion.button whileTap={{ scale: 0.95 }}
                        onClick={() => startLevel(selectedGame, player.level + 1, player.lives)}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 font-bold text-lg">
                        ➡️ Niveau {player.level + 1}
                    </motion.button>
                </motion.div>
            </div>
        );
    }

    // ── GAME OVER ──
    if (phase === 'gameOver') {
        return (
            <div className="flex flex-col h-full bg-gradient-to-b from-red-950 to-slate-950 text-white items-center justify-center p-6">
                <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="text-center space-y-6">
                    <span className="text-6xl block">💀</span>
                    <h2 className="text-2xl font-bold">Fin de partie</h2>
                    <p className="text-slate-400">Score total: ⭐ {totalScore}</p>
                    <div className="flex gap-3">
                        <button onClick={() => { setTotalScore(0); startLevel(selectedGame!, 1); }}
                            className="flex-1 py-3 rounded-xl bg-indigo-600 font-bold">🔄 Recommencer</button>
                        <button onClick={() => setPhase('menu')}
                            className="flex-1 py-3 rounded-xl bg-white/10 font-bold">📋 Menu</button>
                    </div>
                </motion.div>
            </div>
        );
    }

    // ── VICTORY ──
    if (phase === 'victory' && selectedGame) {
        return (
            <div className="flex flex-col h-full bg-gradient-to-b from-yellow-900/30 to-slate-950 text-white items-center justify-center p-6">
                <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', bounce: 0.5 }}
                    className="text-center space-y-6">
                    <motion.span animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="text-7xl block">🏆</motion.span>
                    <h2 className="text-2xl font-bold">{selectedGame.name} terminé !</h2>
                    <p className="text-xl text-yellow-400 font-bold">⭐ {totalScore} points</p>
                    <p className="text-slate-400">{selectedGame.rewardName} débloqué !</p>
                    <button onClick={() => { setTotalScore(0); setPhase('menu'); }}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-yellow-600 to-amber-600 font-bold text-lg">
                        📋 Retour au menu
                    </button>
                </motion.div>
            </div>
        );
    }

    return null;
}
