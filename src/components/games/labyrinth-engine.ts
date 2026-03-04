'use client';

/**
 * LABYRINTHE DE LA FOI — Moteur 2D Top-Down
 * ═══════════════════════════════════════════
 * Vue du dessus, personnage visible, responsive
 * Ultra-léger, 100% offline, Canvas 2D
 */

// ── Types ────────────────────────────────────────
export interface GameConfig {
    id: string;
    name: string;
    emoji: string;
    description: string;
    levels: number;
    maxLives: number;
    liveIcon: string;
    rewardName: string;
    gadgets: { name: string; emoji: string; desc: string; uses: number }[];
    colors: {
        wall: string;
        floor: string;
        bg: string;
        accent: string;
        wallShadow: string;
    };
    unlocks: { level: number; desc: string }[];
}

export interface PlayerState {
    x: number; y: number;
    targetX: number; targetY: number;
    dir: 'up' | 'down' | 'left' | 'right';
    lives: number; score: number; level: number;
    gadgets: Record<string, number>;
    speed: number;
    shieldEnd: number;
    isMoving: boolean;
    animFrame: number;
}

export interface MazeCell {
    wall: boolean;
    type?: 'start' | 'exit' | 'question' | 'gadget' | 'trap' | 'altar' | 'coin';
    questionId?: number;
    collected?: boolean;
}

// ── Bible Questions (30) ─────────────────────────
export const QUESTIONS = [
    { q: "Qui a construit l'arche ?", a: ["Noé", "Abraham", "Moïse", "David"], c: 0 },
    { q: "Combien de jours pour la création ?", a: ["5", "6", "7", "8"], c: 1 },
    { q: "Qui a tué Goliath ?", a: ["Saül", "David", "Samuel", "Jonathan"], c: 1 },
    { q: "Premier livre de la Bible ?", a: ["Exode", "Lévitique", "Genèse", "Nombres"], c: 2 },
    { q: "Avalé par un grand poisson ?", a: ["Jonas", "Élie", "Amos", "Osée"], c: 0 },
    { q: "Combien d'apôtres ?", a: ["7", "10", "12", "14"], c: 2 },
    { q: "Qui a trahi Jésus ?", a: ["Pierre", "Judas", "Thomas", "André"], c: 1 },
    { q: "Ville de naissance de Jésus ?", a: ["Nazareth", "Jérusalem", "Bethléem", "Capharnaüm"], c: 2 },
    { q: "Qui reçut les 10 Commandements ?", a: ["Abraham", "Moïse", "Josué", "Aaron"], c: 1 },
    { q: "Fleuve traversé par Josué ?", a: ["Nil", "Euphrate", "Jourdain", "Tigre"], c: 2 },
    { q: "Jeté dans la fosse aux lions ?", a: ["Daniel", "Ézéchiel", "Jérémie", "Isaïe"], c: 0 },
    { q: "Pierres prises par David ?", a: ["3", "5", "7", "10"], c: 1 },
    { q: "Qui a marché sur l'eau ?", a: ["Jean", "Pierre", "Jacques", "André"], c: 1 },
    { q: "Plus court verset ?", a: ["Jean 3:16", "Jean 11:35", "Ps 117:1", "Gn 1:1"], c: 1 },
    { q: "Auteur principal des Psaumes ?", a: ["Salomon", "David", "Moïse", "Asaph"], c: 1 },
    { q: "Livres dans la Bible ?", a: ["55", "66", "72", "73"], c: 1 },
    { q: "Premier roi d'Israël ?", a: ["David", "Saül", "Salomon", "Samuel"], c: 1 },
    { q: "Enlevé au ciel dans un char de feu ?", a: ["Élie", "Élisée", "Énoch", "Moïse"], c: 0 },
    { q: "Dernière parole de Jésus ?", a: ["Pardonne-leur", "J'ai soif", "Tout est accompli", "Père..."], c: 2 },
    { q: "Qui a nié Jésus 3 fois ?", a: ["Judas", "Thomas", "Pierre", "Jean"], c: 2 },
    { q: "Combien de plaies d'Égypte ?", a: ["7", "9", "10", "12"], c: 2 },
    { q: "Père de la foi ?", a: ["Noé", "Abraham", "Moïse", "Adam"], c: 1 },
    { q: "Auteur de l'Apocalypse ?", a: ["Paul", "Pierre", "Jean", "Matthieu"], c: 2 },
    { q: "Reconstruit les murs de Jérusalem ?", a: ["Esdras", "Néhémie", "Zorobabel", "Aggée"], c: 1 },
    { q: "Jours de jeûne de Jésus ?", a: ["7", "21", "30", "40"], c: 3 },
    { q: "Transformée en statue de sel ?", a: ["Sara", "Femme de Lot", "Rachel", "Rébecca"], c: 1 },
    { q: "Plus long chapitre ?", a: ["Ps 119", "Ps 136", "Is 53", "Gn 1"], c: 0 },
    { q: "Vendu par ses frères ?", a: ["Benjamin", "Joseph", "Ruben", "Juda"], c: 1 },
    { q: "Fruit interdit au jardin ?", a: ["Pomme", "Figue", "Non précisé", "Raisin"], c: 2 },
    { q: "Qui a écrit aux Romains ?", a: ["Pierre", "Paul", "Jean", "Jacques"], c: 1 },
];

// ── 10 Game Configs ──────────────────────────────
export const GAMES: GameConfig[] = [
    {
        id: 'faith', name: 'Le Labyrinthe de la Foi', emoji: '🏜️',
        description: 'Traversez le désert et trouvez la Porte Étroite',
        levels: 10, maxLives: 3, liveIcon: '❤️', rewardName: 'Points de Foi',
        gadgets: [
            { name: 'Boussole', emoji: '🧭', desc: 'Montre la sortie 3s', uses: 1 },
            { name: 'Parchemin', emoji: '📜', desc: 'Annule 1 erreur', uses: 1 },
        ],
        colors: { wall: '#8B7355', floor: '#D4C5A9', bg: '#F5E6C8', accent: '#DAA520', wallShadow: '#6B5B3D' },
        unlocks: [{ level: 5, desc: 'Vision du plan' }, { level: 10, desc: 'Porte Étroite dorée' }],
    },
    {
        id: 'tower', name: 'La Tour de Vigilance', emoji: '🗼',
        description: 'Gardez vos lampes allumées',
        levels: 10, maxLives: 4, liveIcon: '🔥', rewardName: 'Huile Sacrée',
        gadgets: [
            { name: 'Réservoir', emoji: '🛢️', desc: 'Ralentit la perte', uses: 1 },
            { name: 'Allumette', emoji: '🔥', desc: 'Réactive une lampe', uses: 1 },
        ],
        colors: { wall: '#2D2B55', floor: '#1A1833', bg: '#0D0B1A', accent: '#FFD700', wallShadow: '#1A1840' },
        unlocks: [{ level: 7, desc: 'Mode nuit totale' }, { level: 10, desc: 'Couronne des Vierges' }],
    },
    {
        id: 'david', name: 'Le Défi de David', emoji: '⚔️',
        description: 'Affrontez Goliath dans des arènes',
        levels: 10, maxLives: 5, liveIcon: '💪', rewardName: 'Pierres Spirituelles',
        gadgets: [
            { name: 'Fronde', emoji: '🪨', desc: 'Stun obstacle', uses: 2 },
            { name: 'Bouclier', emoji: '🛡️', desc: 'Immunité 5s', uses: 1 },
        ],
        colors: { wall: '#5C4033', floor: '#C4A882', bg: '#E8D5B5', accent: '#CD853F', wallShadow: '#3E2A1F' },
        unlocks: [{ level: 6, desc: 'Goliath mobile' }, { level: 10, desc: 'Vainqueur par la Foi' }],
    },
    {
        id: 'exodus', name: "L'Exode", emoji: '🌊',
        description: "De l'Égypte à la Terre Promise",
        levels: 10, maxLives: 3, liveIcon: '📋', rewardName: 'Manne',
        gadgets: [
            { name: 'Bâton', emoji: '🪄', desc: 'Ouvre passage', uses: 1 },
            { name: 'Nuée', emoji: '☁️', desc: 'Ralentit pièges', uses: 1 },
        ],
        colors: { wall: '#8B6914', floor: '#DEB887', bg: '#F5DEB3', accent: '#4169E1', wallShadow: '#6B4F10' },
        unlocks: [{ level: 8, desc: 'Traversée Mer Rouge' }, { level: 10, desc: 'Terre Promise' }],
    },
    {
        id: 'prayer', name: 'Caverne de la Prière', emoji: '🕯️',
        description: 'Trouvez les autels dans le silence',
        levels: 10, maxLives: 3, liveIcon: '🤫', rewardName: 'Perles',
        gadgets: [
            { name: 'Clé', emoji: '🔑', desc: 'Ouvre salle cachée', uses: 1 },
            { name: 'Echo', emoji: '🔔', desc: 'Révèle autel', uses: 2 },
        ],
        colors: { wall: '#36304A', floor: '#1E1A2E', bg: '#100E1A', accent: '#9370DB', wallShadow: '#252040' },
        unlocks: [{ level: 9, desc: 'Chambre obscure' }, { level: 10, desc: 'Salle de Gloire' }],
    },
    {
        id: 'battle', name: 'Le Combat Invisible', emoji: '🗡️',
        description: "Revêtez l'armure de Dieu",
        levels: 10, maxLives: 6, liveIcon: '🛡️', rewardName: "Pièces d'Armure",
        gadgets: [
            { name: 'Épée', emoji: '⚔️', desc: 'Repousse obstacle', uses: 2 },
            { name: 'Casque', emoji: '⛑️', desc: 'Vision nocturne', uses: 1 },
        ],
        colors: { wall: '#5C1010', floor: '#2B0A0A', bg: '#1A0505', accent: '#FF4444', wallShadow: '#3A0808' },
        unlocks: [{ level: 10, desc: 'Armure complète = aura' }],
    },
    {
        id: 'wisdom', name: 'Quête de la Sagesse', emoji: '📖',
        description: 'Explorez les bibliothèques',
        levels: 10, maxLives: 3, liveIcon: '📕', rewardName: 'Clés de Sagesse',
        gadgets: [
            { name: 'Livre', emoji: '📘', desc: 'Révèle indice', uses: 1 },
            { name: 'Sablier', emoji: '⏳', desc: 'Ralentit temps', uses: 1 },
        ],
        colors: { wall: '#6B4226', floor: '#9C7A52', bg: '#C4A375', accent: '#DAA520', wallShadow: '#4A2E1A' },
        unlocks: [{ level: 10, desc: 'Salle du Trône' }],
    },
    {
        id: 'zion', name: 'Montée vers Sion', emoji: '⛰️',
        description: 'Escaladez les 10 étages',
        levels: 10, maxLives: 4, liveIcon: '💨', rewardName: "Points d'Élévation",
        gadgets: [
            { name: 'Bottes', emoji: '👟', desc: 'Boost vitesse', uses: 1 },
            { name: 'Harpe', emoji: '🎵', desc: 'Boost vitesse', uses: 1 },
        ],
        colors: { wall: '#708090', floor: '#A9B6C4', bg: '#C8D6E0', accent: '#4682B4', wallShadow: '#506070' },
        unlocks: [{ level: 10, desc: 'Panorama céleste' }],
    },
    {
        id: 'shepherd', name: 'Berger et la Brebis', emoji: '🐑',
        description: 'Sauvez les brebis des loups',
        levels: 10, maxLives: 3, liveIcon: '🐺', rewardName: 'Trophée Berger',
        gadgets: [
            { name: 'Bâton', emoji: '🪵', desc: 'Repousse loup', uses: 2 },
            { name: 'Sifflet', emoji: '📯', desc: 'Attire brebis', uses: 1 },
        ],
        colors: { wall: '#4A7B3A', floor: '#8FBC6A', bg: '#B8E08C', accent: '#2E8B57', wallShadow: '#346029' },
        unlocks: [{ level: 8, desc: 'Loups rapides' }, { level: 10, desc: 'Fête de retrouvailles' }],
    },
    {
        id: 'covenant', name: 'Labyrinthe des Alliances', emoji: '📜',
        description: 'Les 10 alliances bibliques',
        levels: 10, maxLives: 3, liveIcon: '💔', rewardName: "Sceaux d'Alliance",
        gadgets: [
            { name: 'Arche', emoji: '⛵', desc: 'Protection eau', uses: 1 },
            { name: 'Tablette', emoji: '📋', desc: 'Révèle vérité', uses: 1 },
        ],
        colors: { wall: '#6A5ACD', floor: '#483D8B', bg: '#2F2670', accent: '#9370DB', wallShadow: '#3C3190' },
        unlocks: [{ level: 10, desc: 'Nouvelle Alliance' }],
    },
];

// ── Characters ───────────────────────────────────
export const CHARS = [
    { id: 'david', name: 'David', emoji: '👦', color: '#6366f1', speed: 1.1, desc: 'Rapide et agile' },
    { id: 'moses', name: 'Moïse', emoji: '🧔', color: '#f59e0b', speed: 1.0, desc: 'Sage et résistant' },
    { id: 'esther', name: 'Esther', emoji: '👸', color: '#ec4899', speed: 1.05, desc: 'Courageuse' },
    { id: 'joshua', name: 'Josué', emoji: '⚔️', color: '#10b981', speed: 1.15, desc: 'Guerrier puissant' },
    { id: 'ruth', name: 'Ruth', emoji: '🌾', color: '#8b5cf6', speed: 1.0, desc: 'Fidèle' },
    { id: 'daniel', name: 'Daniel', emoji: '🦁', color: '#f97316', speed: 0.95, desc: 'Vision + résistance' },
];

// ── Maze Generator (Recursive Backtracker) ───────
export function generateMaze(w: number, h: number, level: number): MazeCell[][] {
    const maze: MazeCell[][] = Array.from({ length: h }, () =>
        Array.from({ length: w }, () => ({ wall: true }))
    );
    const carve = (x: number, y: number) => {
        maze[y][x].wall = false;
        const dirs = [[0, -2], [0, 2], [-2, 0], [2, 0]].sort(() => Math.random() - 0.5);
        for (const [dx, dy] of dirs) {
            const nx = x + dx, ny = y + dy;
            if (nx > 0 && nx < w - 1 && ny > 0 && ny < h - 1 && maze[ny][nx].wall) {
                maze[y + dy / 2][x + dx / 2].wall = false;
                carve(nx, ny);
            }
        }
    };
    carve(1, 1);
    maze[1][1] = { wall: false, type: 'start' };
    maze[h - 2][w - 2] = { wall: false, type: 'exit' };

    // Collect open cells for placement
    const open: [number, number][] = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
        if (!maze[y][x].wall && !maze[y][x].type) open.push([x, y]);
    open.sort(() => Math.random() - 0.5);

    let idx = 0;
    // Questions
    const qCount = Math.min(2 + level, 6);
    for (let i = 0; i < Math.min(qCount, open.length); i++, idx++) {
        const [x, y] = open[idx];
        maze[y][x] = { wall: false, type: 'question', questionId: Math.floor(Math.random() * QUESTIONS.length) };
    }
    // Coins
    const coinCount = Math.min(3 + level, 10);
    for (let i = 0; i < Math.min(coinCount, open.length - idx); i++, idx++) {
        const [x, y] = open[idx];
        maze[y][x] = { wall: false, type: 'coin' };
    }
    // Gadgets
    for (let i = 0; i < Math.min(2, open.length - idx); i++, idx++) {
        const [x, y] = open[idx];
        maze[y][x] = { wall: false, type: 'gadget' };
    }
    // Traps
    const trapCount = Math.min(level, 4);
    for (let i = 0; i < Math.min(trapCount, open.length - idx); i++, idx++) {
        const [x, y] = open[idx];
        maze[y][x] = { wall: false, type: 'trap' };
    }
    return maze;
}

// ── Save/Load ────────────────────────────────────
const SAVE_KEY = 'labyrinth_saves';
export function saveGame(gameId: string, data: any) {
    try {
        const all = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
        all[gameId] = { ...data, ts: Date.now() };
        localStorage.setItem(SAVE_KEY, JSON.stringify(all));
    } catch { }
}
export function loadGame(gameId: string): any {
    try {
        return JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')[gameId] || null;
    } catch { return null; }
}
