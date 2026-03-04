'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    GAMES, CHARS, QUESTIONS, generateMaze, saveGame, loadGame,
    type GameConfig, type PlayerState, type MazeCell,
} from './labyrinth-engine';

interface Props { onBack?: () => void; }
type Phase = 'menu' | 'character' | 'playing' | 'question' | 'levelUp' | 'gameOver' | 'victory';

export default function LabyrinthGame({ onBack }: Props) {
    const [phase, setPhase] = useState<Phase>('menu');
    const [game, setGame] = useState<GameConfig | null>(null);
    const [char, setChar] = useState(CHARS[0]);
    const [player, setPlayer] = useState<PlayerState | null>(null);
    const [maze, setMaze] = useState<MazeCell[][] | null>(null);
    const [question, setQuestion] = useState<typeof QUESTIONS[0] | null>(null);
    const [showExit, setShowExit] = useState(false);
    const [totalScore, setTotalScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);
    const [showMap, setShowMap] = useState(false);
    const [collected, setCollected] = useState('');

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const keysRef = useRef<Set<string>>(new Set());
    const rafRef = useRef(0);
    const pRef = useRef<PlayerState | null>(null);
    const mRef = useRef<MazeCell[][] | null>(null);
    const scoreRef = useRef(0);
    const gameRef = useRef<GameConfig | null>(null);

    useEffect(() => { pRef.current = player; }, [player]);
    useEffect(() => { mRef.current = maze; }, [maze]);
    useEffect(() => { scoreRef.current = totalScore; }, [totalScore]);
    useEffect(() => { gameRef.current = game; }, [game]);

    // ── Start Level ──
    const startLevel = useCallback((g: GameConfig, lvl: number, lives?: number) => {
        const size = 9 + lvl * 2;
        const m = generateMaze(size, size, lvl);
        setMaze(m);
        setPlayer({
            x: 1, y: 1, targetX: 1, targetY: 1,
            dir: 'down', lives: lives ?? g.maxLives,
            score: 0, level: lvl,
            gadgets: Object.fromEntries(g.gadgets.map(gd => [gd.name, gd.uses])),
            speed: 0.08 * char.speed,
            shieldEnd: 0, isMoving: false, animFrame: 0,
        });
        setTimeLeft(45 + lvl * 10);
        setShowExit(false);
        setPhase('playing');
    }, [char]);

    // ── Canvas Resize ──
    useEffect(() => {
        const resize = () => {
            if (!canvasRef.current || !containerRef.current) return;
            const c = containerRef.current;
            const dpr = window.devicePixelRatio || 1;
            canvasRef.current.width = c.clientWidth * dpr;
            canvasRef.current.height = c.clientHeight * dpr;
            canvasRef.current.style.width = c.clientWidth + 'px';
            canvasRef.current.style.height = c.clientHeight + 'px';
        };
        resize();
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, [phase]);

    // ── Game Loop ──
    useEffect(() => {
        if (phase !== 'playing' || !canvasRef.current || !game) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let lastT = 0;
        const loop = (t: number) => {
            const dt = Math.min(t - lastT, 50);
            lastT = t;
            const p = pRef.current;
            const m = mRef.current;
            if (!p || !m) { rafRef.current = requestAnimationFrame(loop); return; }

            // ── Movement ──
            const keys = keysRef.current;
            let dx = 0, dy = 0;
            if (keys.has('ArrowUp') || keys.has('w') || keys.has('z')) { dy = -1; p.dir = 'up'; }
            if (keys.has('ArrowDown') || keys.has('s')) { dy = 1; p.dir = 'down'; }
            if (keys.has('ArrowLeft') || keys.has('a') || keys.has('q')) { dx = -1; p.dir = 'left'; }
            if (keys.has('ArrowRight') || keys.has('d')) { dx = 1; p.dir = 'right'; }

            if (dx !== 0 || dy !== 0) {
                const spd = p.speed * (dt / 16);
                const nx = p.x + dx * spd;
                const ny = p.y + dy * spd;
                // Collision check
                const margin = 0.15;
                const canMoveX = !m[Math.floor(p.y)]?.[Math.floor(nx + (dx > 0 ? margin : -margin))]?.wall
                    && !m[Math.floor(p.y + margin)]?.[Math.floor(nx + (dx > 0 ? margin : -margin))]?.wall
                    && !m[Math.floor(p.y - margin)]?.[Math.floor(nx + (dx > 0 ? margin : -margin))]?.wall;
                const canMoveY = !m[Math.floor(ny + (dy > 0 ? margin : -margin))]?.[Math.floor(p.x)]?.wall
                    && !m[Math.floor(ny + (dy > 0 ? margin : -margin))]?.[Math.floor(p.x + margin)]?.wall
                    && !m[Math.floor(ny + (dy > 0 ? margin : -margin))]?.[Math.floor(p.x - margin)]?.wall;
                if (canMoveX) p.x = nx;
                if (canMoveY) p.y = ny;
                p.isMoving = true;
                p.animFrame = (p.animFrame + 0.15) % 4;
            } else {
                p.isMoving = false;
            }

            // ── Cell Check ──
            const cx = Math.floor(p.x), cy = Math.floor(p.y);
            const cell = m[cy]?.[cx];
            if (cell && !cell.collected) {
                if (cell.type === 'exit') {
                    const g = gameRef.current;
                    const ns = scoreRef.current + p.score + 100 * p.level;
                    setTotalScore(ns);
                    if (g && p.level >= g.levels) {
                        saveGame(g.id, { level: p.level, score: ns, done: true });
                        setPhase('victory');
                    } else {
                        setPhase('levelUp');
                    }
                    rafRef.current = 0; return;
                }
                if (cell.type === 'question') {
                    cell.collected = true;
                    setQuestion(QUESTIONS[cell.questionId ?? 0]);
                    setPhase('question');
                    rafRef.current = 0; return;
                }
                if (cell.type === 'coin') {
                    cell.collected = true;
                    p.score += 10;
                    setCollected('⭐+10'); setTimeout(() => setCollected(''), 800);
                }
                if (cell.type === 'gadget') {
                    cell.collected = true;
                    const gn = game.gadgets[Math.floor(Math.random() * game.gadgets.length)].name;
                    p.gadgets[gn] = (p.gadgets[gn] || 0) + 1;
                    setCollected(`🎁 ${gn}`); setTimeout(() => setCollected(''), 1000);
                }
                if (cell.type === 'trap' && Date.now() > p.shieldEnd) {
                    cell.collected = true;
                    p.lives--;
                    setCollected('💥 Piège!'); setTimeout(() => setCollected(''), 800);
                    if (p.lives <= 0) { setPhase('gameOver'); rafRef.current = 0; return; }
                }
            }

            // ── RENDER ──
            const W = canvas.width, H = canvas.height;
            const dpr = window.devicePixelRatio || 1;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const cw = W / dpr, ch = H / dpr;

            // Camera follows player
            const cellSize = Math.min(cw, ch) / 9; // Show ~9 cells
            const camX = p.x * cellSize - cw / 2;
            const camY = p.y * cellSize - ch / 2;

            // Background
            ctx.fillStyle = game.colors.bg;
            ctx.fillRect(0, 0, cw, ch);

            ctx.save();
            ctx.translate(-camX, -camY);

            // Draw maze
            for (let y = 0; y < m.length; y++) {
                for (let x = 0; x < m[0].length; x++) {
                    const sx = x * cellSize, sy = y * cellSize;
                    // Skip if off screen
                    if (sx - camX < -cellSize || sx - camX > cw + cellSize || sy - camY < -cellSize || sy - camY > ch + cellSize) continue;

                    if (m[y][x].wall) {
                        // Wall with shadow effect
                        ctx.fillStyle = game.colors.wallShadow;
                        ctx.fillRect(sx + 2, sy + 2, cellSize, cellSize);
                        ctx.fillStyle = game.colors.wall;
                        ctx.fillRect(sx, sy, cellSize, cellSize);
                        // Brick pattern
                        ctx.strokeStyle = game.colors.wallShadow;
                        ctx.lineWidth = 0.5;
                        ctx.strokeRect(sx + 1, sy + 1, cellSize - 2, cellSize / 2 - 1);
                        ctx.strokeRect(sx + cellSize / 4, sy + cellSize / 2, cellSize / 2, cellSize / 2 - 1);
                    } else {
                        // Floor tile
                        ctx.fillStyle = game.colors.floor;
                        ctx.fillRect(sx, sy, cellSize, cellSize);
                        // Subtle tile grid
                        ctx.strokeStyle = game.colors.bg;
                        ctx.lineWidth = 0.3;
                        ctx.strokeRect(sx + 0.5, sy + 0.5, cellSize - 1, cellSize - 1);

                        // Items
                        const cell = m[y][x];
                        if (cell.type === 'exit') {
                            // Glowing exit
                            ctx.fillStyle = game.colors.accent;
                            ctx.globalAlpha = 0.3 + 0.2 * Math.sin(t / 300);
                            ctx.fillRect(sx, sy, cellSize, cellSize);
                            ctx.globalAlpha = 1;
                            ctx.font = `${cellSize * 0.6}px sans-serif`;
                            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                            ctx.fillText('🚪', sx + cellSize / 2, sy + cellSize / 2);
                        }
                        if (cell.type === 'question' && !cell.collected) {
                            ctx.font = `${cellSize * 0.5}px sans-serif`;
                            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                            ctx.fillText('❓', sx + cellSize / 2, sy + cellSize / 2);
                        }
                        if (cell.type === 'coin' && !cell.collected) {
                            ctx.font = `${cellSize * 0.4}px sans-serif`;
                            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                            const bounce = Math.sin(t / 200 + x + y) * 2;
                            ctx.fillText('⭐', sx + cellSize / 2, sy + cellSize / 2 + bounce);
                        }
                        if (cell.type === 'gadget' && !cell.collected) {
                            ctx.font = `${cellSize * 0.45}px sans-serif`;
                            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                            ctx.fillText('🎁', sx + cellSize / 2, sy + cellSize / 2);
                        }
                        if (cell.type === 'trap' && !cell.collected) {
                            ctx.font = `${cellSize * 0.35}px sans-serif`;
                            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                            ctx.fillText('💀', sx + cellSize / 2, sy + cellSize / 2);
                        }
                    }
                }
            }

            // ── Draw Player (visible character) ──
            const px = p.x * cellSize, py = p.y * cellSize;
            const ps = cellSize * 0.75;

            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.beginPath();
            ctx.ellipse(px, py + ps * 0.4, ps * 0.35, ps * 0.12, 0, 0, Math.PI * 2);
            ctx.fill();

            // Body circle
            ctx.fillStyle = char.color;
            ctx.beginPath();
            ctx.arc(px, py - ps * 0.1, ps * 0.35, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Character emoji
            ctx.font = `${ps * 0.6}px sans-serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(char.emoji, px, py - ps * 0.1);

            // Direction indicator (small triangle)
            ctx.fillStyle = char.color;
            ctx.beginPath();
            const arrowDist = ps * 0.45;
            let ax = px, ay = py;
            if (p.dir === 'up') ay = py - arrowDist;
            if (p.dir === 'down') ay = py + arrowDist * 0.6;
            if (p.dir === 'left') ax = px - arrowDist;
            if (p.dir === 'right') ax = px + arrowDist;
            ctx.arc(ax, ay, 3, 0, Math.PI * 2);
            ctx.fill();

            // Shield effect
            if (Date.now() < p.shieldEnd) {
                ctx.strokeStyle = 'rgba(100,200,255,0.6)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(px, py, ps * 0.5, 0, Math.PI * 2);
                ctx.stroke();
            }

            ctx.restore();

            // ── HUD (overlays) ──
            // Top bar
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(0, 0, cw, 32);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px system-ui';
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText(`${game.emoji} Niv.${p.level}`, 8, 16);
            // Lives
            let lx = 75;
            for (let i = 0; i < game.maxLives; i++) {
                ctx.globalAlpha = i < p.lives ? 1 : 0.2;
                ctx.fillText(game.liveIcon, lx, 16);
                lx += 18;
            }
            ctx.globalAlpha = 1;
            ctx.textAlign = 'right';
            ctx.fillText(`⭐${p.score}`, cw - 8, 16);

            // Collected feedback
            if (collected) {
                ctx.textAlign = 'center';
                ctx.font = 'bold 16px system-ui';
                ctx.fillStyle = '#FFD700';
                ctx.fillText(collected, cw / 2, 52);
            }

            rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(rafRef.current);
    }, [phase, game, char, totalScore, collected]);

    // ── Timer ──
    useEffect(() => {
        if (phase !== 'playing') return;
        const iv = setInterval(() => {
            setTimeLeft(t => { if (t <= 1) { setPhase('gameOver'); return 0; } return t - 1; });
        }, 1000);
        return () => clearInterval(iv);
    }, [phase]);

    // ── Keyboard ──
    useEffect(() => {
        const d = (e: KeyboardEvent) => keysRef.current.add(e.key);
        const u = (e: KeyboardEvent) => keysRef.current.delete(e.key);
        window.addEventListener('keydown', d);
        window.addEventListener('keyup', u);
        return () => { window.removeEventListener('keydown', d); window.removeEventListener('keyup', u); };
    }, []);

    // ── Answer Question ──
    const answer = (i: number) => {
        if (!question || !player || !game) return;
        if (i === question.c) {
            setPlayer(p => p ? { ...p, score: p.score + 50 } : p);
            setCollected('✅ +50'); setTimeout(() => setCollected(''), 800);
        } else {
            setPlayer(p => {
                if (!p) return p;
                const l = p.lives - 1;
                if (l <= 0) { setPhase('gameOver'); return { ...p, lives: 0 }; }
                return { ...p, lives: l };
            });
            setCollected('❌ -1 vie'); setTimeout(() => setCollected(''), 800);
        }
        setQuestion(null);
        setPhase('playing');
    };

    // ── Use Gadget ──
    const useGadget = (name: string) => {
        if (!player) return;
        const uses = player.gadgets[name] || 0;
        if (uses <= 0) return;
        setPlayer(p => p ? { ...p, gadgets: { ...p.gadgets, [name]: uses - 1 }, shieldEnd: Date.now() + 5000 } : p);
        if (name.includes('Boussole') || name.includes('Echo') || name.includes('Livre') || name.includes('Tablette')) {
            setShowMap(true); setTimeout(() => setShowMap(false), 3000);
        }
    };

    // ── Touch Controls ──
    const dpadBtn = (dir: string, label: string, cls: string) => (
        <button
            onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); keysRef.current.add(dir); }}
            onTouchEnd={(e) => { e.preventDefault(); keysRef.current.delete(dir); }}
            onTouchCancel={() => keysRef.current.delete(dir)}
            onMouseDown={(e) => { e.preventDefault(); keysRef.current.add(dir); }}
            onMouseUp={() => keysRef.current.delete(dir)}
            onMouseLeave={() => keysRef.current.delete(dir)}
            onContextMenu={(e) => e.preventDefault()}
            className={`w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl font-bold text-white active:bg-white/40 active:scale-90 transition-all select-none touch-none ${cls}`}
            style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
        >{label}</button>
    );

    // ═════════════════════════════════════════════
    // VIEWS
    // ═════════════════════════════════════════════

    if (phase === 'menu') {
        return (
            <div className="flex flex-col h-[100dvh] bg-linear-to-b from-slate-900 to-slate-950 text-white overflow-y-auto">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0">
                    {onBack && <button onClick={onBack} className="text-slate-400 hover:text-white text-xl">←</button>}
                    <h1 className="text-lg font-black">🏰 Labyrinthes de la Foi</h1>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 pb-24">
                    {GAMES.map(g => {
                        const sv = loadGame(g.id);
                        return (
                            <motion.button key={g.id} whileTap={{ scale: 0.97 }}
                                onClick={() => { setGame(g); setPhase('character') }}
                                className="text-left p-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all"
                            >
                                <div className="flex items-start gap-3">
                                    <span className="text-2xl">{g.emoji}</span>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-sm">{g.name}</h3>
                                        <p className="text-[10px] text-slate-400 line-clamp-1">{g.description}</p>
                                        <div className="flex gap-1.5 mt-1.5 flex-wrap">
                                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10">{g.levels} niv.</span>
                                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10">{g.maxLives}{g.liveIcon}</span>
                                            {sv?.done && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400">✅</span>}
                                        </div>
                                    </div>
                                </div>
                            </motion.button>
                        );
                    })}
                </div>
            </div>
        );
    }

    if (phase === 'character' && game) {
        return (
            <div className="flex flex-col h-[100dvh] bg-linear-to-b from-slate-900 to-slate-950 text-white overflow-y-auto">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0">
                    <button onClick={() => setPhase('menu')} className="text-slate-400 hover:text-white text-xl">←</button>
                    <h2 className="font-bold text-sm">{game.emoji} {game.name}</h2>
                </div>
                <div className="p-4 space-y-4 pb-24">
                    <h3 className="text-center text-sm font-semibold text-slate-300">Choisissez votre héros</h3>
                    <div className="grid grid-cols-3 gap-2">
                        {CHARS.map(c => (
                            <motion.button key={c.id} whileTap={{ scale: 0.95 }}
                                onClick={() => setChar(c)}
                                className={`p-3 rounded-2xl border-2 text-center transition-all ${char.id === c.id ? 'border-indigo-500 bg-indigo-500/20' : 'border-white/10 bg-white/5'
                                    }`}
                            >
                                <span className="text-3xl block mb-1">{c.emoji}</span>
                                <p className="font-bold text-xs">{c.name}</p>
                                <p className="text-[9px] text-slate-400">{c.desc}</p>
                            </motion.button>
                        ))}
                    </div>
                    <div className="space-y-1.5">
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Gadgets</h4>
                        <div className="flex flex-wrap gap-1.5">
                            {game.gadgets.map(g => (
                                <span key={g.name} className="text-[10px] px-2 py-1 rounded-lg bg-white/5 border border-white/10">
                                    {g.emoji} {g.name}
                                </span>
                            ))}
                        </div>
                    </div>
                    <motion.button whileTap={{ scale: 0.95 }}
                        onClick={() => startLevel(game, 1)}
                        className="w-full py-3.5 rounded-2xl bg-linear-to-r from-indigo-600 to-purple-600 font-bold text-base shadow-lg"
                    >⚔️ Commencer</motion.button>
                </div>
            </div>
        );
    }

    if (phase === 'playing') {
        return (
            <div className="fixed inset-0 flex flex-col bg-black text-white z-50">
                {/* Top bar */}
                <div className="flex items-center justify-between px-3 py-1.5 bg-black/80 shrink-0 text-xs z-10">
                    <button onClick={() => setPhase('menu')} className="text-slate-400 text-xs">✕</button>
                    <span className={timeLeft < 15 ? 'text-red-400 animate-pulse font-bold' : 'text-slate-300'}>
                        ⏱{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                    </span>
                    <button onClick={() => setShowMap(v => !v)} className="text-slate-400 text-xs">🗺️</button>
                </div>
                {/* Canvas */}
                <div ref={containerRef} className="flex-1 relative overflow-hidden touch-none">
                    <canvas ref={canvasRef} className="absolute inset-0" />
                    {/* Mini-map overlay */}
                    {showMap && maze && player && (
                        <div className="absolute top-2 right-2 bg-black/80 rounded-lg p-1 border border-white/20 z-20">
                            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${maze[0].length},4px)`, gap: 0 }}>
                                {maze.map((row, y) => row.map((c, x) => (
                                    <div key={`${x}-${y}`} style={{
                                        width: 4, height: 4,
                                        background: Math.floor(player.x) === x && Math.floor(player.y) === y
                                            ? '#ff0' : c.wall ? '#555' : c.type === 'exit' ? '#0f0' : 'transparent'
                                    }} />
                                )))}
                            </div>
                        </div>
                    )}
                    {/* D-Pad */}
                    <div className="absolute bottom-4 left-4 z-20">
                        <div className="grid grid-cols-3 gap-1">
                            <div />
                            {dpadBtn('ArrowUp', '↑', '')}
                            <div />
                            {dpadBtn('ArrowLeft', '←', '')}
                            {dpadBtn('ArrowDown', '↓', '')}
                            {dpadBtn('ArrowRight', '→', '')}
                        </div>
                    </div>
                    {/* Gadgets */}
                    {player && game && (
                        <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-20">
                            {game.gadgets.map(g => {
                                const u = player.gadgets[g.name] || 0;
                                return (
                                    <button key={g.name} disabled={u <= 0} onClick={() => useGadget(g.name)}
                                        className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg relative ${u > 0 ? 'bg-white/20 active:bg-white/40' : 'bg-white/5 opacity-30'}`}
                                    >
                                        {g.emoji}
                                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-indigo-600 text-[8px] flex items-center justify-center font-bold">{u}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (phase === 'question' && question) {
        return (
            <div
                className="fixed inset-0 flex flex-col items-center justify-center p-6 text-white z-50"
                style={{ background: `linear-gradient(to bottom, ${game?.colors.bg || '#1a1a2e'}, #0a0a15)` }}>
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className="max-w-sm w-full bg-white/10 backdrop-blur-xl rounded-3xl border border-white/15 p-5 space-y-5">
                    <div className="text-center">
                        <span className="text-3xl">❓</span>
                        <h3 className="font-bold text-base mt-2 leading-tight">{question.q}</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                        {question.a.map((a, i) => (
                            <motion.button key={i} whileTap={{ scale: 0.95 }}
                                onClick={() => answer(i)}
                                className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-indigo-500/30 border border-white/10 text-sm font-medium text-left transition-all">
                                <span className="text-indigo-400 font-bold mr-2">{String.fromCharCode(65 + i)}.</span>{a}
                            </motion.button>
                        ))}
                    </div>
                </motion.div>
            </div>
        );
    }

    if (phase === 'levelUp' && player && game) {
        return (
            <div className="fixed inset-0 flex flex-col items-center justify-center p-6 text-white bg-linear-to-b from-slate-900 to-slate-950 z-50">
                <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="text-center space-y-5 max-w-sm">
                    <span className="text-5xl block">🎉</span>
                    <h2 className="text-xl font-black">Niveau {player.level} terminé !</h2>
                    <p className="text-slate-400">⭐ {totalScore} pts • {player.lives} {game.liveIcon}</p>
                    {game.unlocks.find(u => u.level === player.level) && (
                        <div className="bg-amber-500/20 text-amber-300 rounded-xl p-3 text-sm font-bold">
                            🏆 {game.unlocks.find(u => u.level === player.level)!.desc}
                        </div>
                    )}
                    <motion.button whileTap={{ scale: 0.95 }}
                        onClick={() => startLevel(game, player.level + 1, player.lives)}
                        className="w-full py-3.5 rounded-2xl bg-linear-to-r from-green-600 to-emerald-600 font-bold text-base">
                        ➡️ Niveau {player.level + 1}
                    </motion.button>
                </motion.div>
            </div>
        );
    }

    if (phase === 'gameOver') {
        return (
            <div className="fixed inset-0 flex flex-col items-center justify-center p-6 text-white bg-linear-to-b from-red-950 to-slate-950 z-50">
                <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="text-center space-y-5 max-w-sm">
                    <span className="text-5xl block">💀</span>
                    <h2 className="text-xl font-black">Fin de partie</h2>
                    <p className="text-slate-400">Score: ⭐ {totalScore}</p>
                    <div className="flex gap-3">
                        <button onClick={() => { setTotalScore(0); if (game) startLevel(game, 1); }}
                            className="flex-1 py-3 rounded-xl bg-indigo-600 font-bold text-sm">🔄 Rejouer</button>
                        <button onClick={() => setPhase('menu')}
                            className="flex-1 py-3 rounded-xl bg-white/10 font-bold text-sm">📋 Menu</button>
                    </div>
                </motion.div>
            </div>
        );
    }

    if (phase === 'victory' && game) {
        return (
            <div className="fixed inset-0 flex flex-col items-center justify-center p-6 text-white bg-linear-to-b from-yellow-900/30 to-slate-950 z-50">
                <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', bounce: 0.5 }} className="text-center space-y-5 max-w-sm">
                    <motion.span animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }} className="text-6xl block">🏆</motion.span>
                    <h2 className="text-xl font-black">{game.name} terminé !</h2>
                    <p className="text-lg text-yellow-400 font-bold">⭐ {totalScore}</p>
                    <p className="text-slate-400 text-sm">{game.rewardName} débloqué !</p>
                    <button onClick={() => { setTotalScore(0); setPhase('menu') }}
                        className="w-full py-3.5 rounded-2xl bg-linear-to-r from-yellow-600 to-amber-600 font-bold text-base">
                        📋 Retour
                    </button>
                </motion.div>
            </div>
        );
    }
    return null;
}
