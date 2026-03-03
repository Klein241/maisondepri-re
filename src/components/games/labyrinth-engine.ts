'use client';

/**
 * LABYRINTHE DE LA FOI — Moteur 3D Raycasting
 * ═══════════════════════════════════════════════
 * Rendu pseudo-3D style Wolfenstein 3D via Canvas 2D
 * Ultra léger (~30KB), fonctionne 100% offline, 60fps
 */

// ── Types ────────────────────────────────────────────────────
export interface GameConfig {
    id: string;
    name: string;
    emoji: string;
    description: string;
    levels: number;
    maxLives: number;
    liveIcon: string;
    rewardName: string;
    gadgets: { name: string; emoji: string; description: string; usesPerLevel: number }[];
    wallColor: [number, number, number];
    floorColor: [number, number, number];
    skyColor: [number, number, number];
    fogColor?: [number, number, number];
    fogDistance?: number;
}

export interface PlayerState {
    x: number;
    y: number;
    angle: number;
    lives: number;
    score: number;
    level: number;
    gadgets: Record<string, number>;
    badges: string[];
    speed: number;
    boosted: boolean;
    boostEnd: number;
}

export interface MazeCell {
    wall: boolean;
    type?: 'start' | 'exit' | 'question' | 'gadget' | 'trap' | 'altar' | 'enemy';
    questionId?: number;
    collected?: boolean;
}

// ── Bible Questions for all games ────────────────────────────
export const BIBLE_QUESTIONS = [
    { q: "Qui a construit l'arche ?", answers: ["Noé", "Abraham", "Moïse", "David"], correct: 0 },
    { q: "Combien de jours Dieu a-t-il créé le monde ?", answers: ["5", "6", "7", "8"], correct: 1 },
    { q: "Qui a tué Goliath ?", answers: ["Saül", "David", "Samuel", "Jonathan"], correct: 1 },
    { q: "Quel est le premier livre de la Bible ?", answers: ["Exode", "Lévitique", "Genèse", "Nombres"], correct: 2 },
    { q: "Qui a été avalé par un grand poisson ?", answers: ["Jonas", "Élie", "Amos", "Osée"], correct: 0 },
    { q: "Combien d'apôtres Jésus a-t-il choisis ?", answers: ["7", "10", "12", "14"], correct: 2 },
    { q: "Qui a trahi Jésus ?", answers: ["Pierre", "Judas", "Thomas", "André"], correct: 1 },
    { q: "Dans quelle ville Jésus est-il né ?", answers: ["Nazareth", "Jérusalem", "Bethléem", "Capharnaüm"], correct: 2 },
    { q: "Qui a reçu les Dix Commandements ?", answers: ["Abraham", "Moïse", "Josué", "Aaron"], correct: 1 },
    { q: "Quel fleuve Josué a-t-il traversé ?", answers: ["Nil", "Euphrate", "Jourdain", "Tigre"], correct: 2 },
    { q: "Qui a été jeté dans la fosse aux lions ?", answers: ["Daniel", "Ézéchiel", "Jérémie", "Isaïe"], correct: 0 },
    { q: "Combien de pierres David a-t-il prises ?", answers: ["3", "5", "7", "10"], correct: 1 },
    { q: "Qui a marché sur l'eau ?", answers: ["Jean", "Pierre", "Jacques", "André"], correct: 1 },
    { q: "Quel est le plus court verset de la Bible ?", answers: ["Jean 3:16", "Jean 11:35", "Ps 117:1", "Gn 1:1"], correct: 1 },
    { q: "Qui a écrit la majorité des Psaumes ?", answers: ["Salomon", "David", "Moïse", "Asaph"], correct: 1 },
    { q: "Quel fruit était interdit dans le jardin d'Éden ?", answers: ["Pomme", "Figue", "Non précisé", "Raisin"], correct: 2 },
    { q: "Combien de livres dans la Bible ?", answers: ["55", "66", "72", "73"], correct: 1 },
    { q: "Qui a été le premier roi d'Israël ?", answers: ["David", "Saül", "Salomon", "Samuel"], correct: 1 },
    { q: "Quel prophète a été enlevé au ciel dans un char de feu ?", answers: ["Élie", "Élisée", "Énoch", "Moïse"], correct: 0 },
    { q: "Quelle est la dernière parole de Jésus sur la croix ?", answers: ["Pardonne-leur", "J'ai soif", "Tout est accompli", "Père, entre tes mains"], correct: 2 },
    { q: "Qui a nié Jésus trois fois ?", answers: ["Judas", "Thomas", "Pierre", "Jean"], correct: 2 },
    { q: "Combien de plaies d'Égypte y a-t-il eu ?", answers: ["7", "9", "10", "12"], correct: 2 },
    { q: "Qui est le père de la foi ?", answers: ["Noé", "Abraham", "Moïse", "Adam"], correct: 1 },
    { q: "Quel apôtre a écrit l'Apocalypse ?", answers: ["Paul", "Pierre", "Jean", "Matthieu"], correct: 2 },
    { q: "Qui a reconstruit les murs de Jérusalem ?", answers: ["Esdras", "Néhémie", "Zorobabel", "Aggée"], correct: 1 },
    { q: "Quel animal a parlé dans la Bible ?", answers: ["Serpent", "Colombe", "Ânesse", "Les deux: A et C"], correct: 3 },
    { q: "Combien de jours Jésus a-t-il jeûné ?", answers: ["7", "21", "30", "40"], correct: 3 },
    { q: "Qui a été transformée en statue de sel ?", answers: ["Sara", "La femme de Lot", "Rachel", "Rébecca"], correct: 1 },
    { q: "Quel est le plus long chapitre de la Bible ?", answers: ["Psaume 119", "Psaume 136", "Isaïe 53", "Genèse 1"], correct: 0 },
    { q: "Qui a été vendu par ses frères ?", answers: ["Benjamin", "Joseph", "Ruben", "Juda"], correct: 1 },
];

// ── 10 Game Configurations ───────────────────────────────────
export const GAME_CONFIGS: GameConfig[] = [
    {
        id: 'labyrinth-faith', name: 'Le Labyrinthe de la Foi', emoji: '🏜️',
        description: 'Traversez le désert spirituel et trouvez la Porte Étroite',
        levels: 10, maxLives: 3, liveIcon: '❤️', rewardName: 'Points de Foi',
        gadgets: [
            { name: 'Boussole Spirituelle', emoji: '🧭', description: 'Indique la bonne direction', usesPerLevel: 1 },
            { name: 'Parchemin de Révélation', emoji: '📜', description: 'Annule une mauvaise réponse', usesPerLevel: 1 },
        ],
        wallColor: [180, 140, 80], floorColor: [210, 180, 120], skyColor: [135, 180, 220],
    },
    {
        id: 'tower-vigilance', name: 'La Tour de Vigilance', emoji: '🗼',
        description: 'Gardez vos lampes allumées et montez la tour',
        levels: 10, maxLives: 4, liveIcon: '🔥', rewardName: 'Huile Sacrée',
        gadgets: [
            { name: "Réservoir d'huile", emoji: '🛢️', description: 'Ralentit la perte de lumière', usesPerLevel: 1 },
            { name: 'Allumette céleste', emoji: '🔥', description: 'Réactive une lampe éteinte', usesPerLevel: 1 },
        ],
        wallColor: [60, 60, 80], floorColor: [40, 40, 50], skyColor: [15, 15, 30],
        fogColor: [20, 20, 40], fogDistance: 6,
    },
    {
        id: 'david-challenge', name: 'Le Défi de David', emoji: '⚔️',
        description: 'Affrontez Goliath dans des arènes labyrinthiques',
        levels: 10, maxLives: 5, liveIcon: '💪', rewardName: 'Pierres Spirituelles',
        gadgets: [
            { name: 'Fronde améliorée', emoji: '🪨', description: 'Stun un obstacle', usesPerLevel: 2 },
            { name: 'Bouclier de Foi', emoji: '🛡️', description: 'Immunité 5 secondes', usesPerLevel: 1 },
        ],
        wallColor: [100, 80, 60], floorColor: [140, 120, 90], skyColor: [180, 160, 130],
    },
    {
        id: 'exodus', name: "L'Exode", emoji: '🌊',
        description: "De l'Égypte à la Terre Promise",
        levels: 10, maxLives: 3, liveIcon: '📋', rewardName: 'Manne',
        gadgets: [
            { name: 'Bâton de Moïse', emoji: '🪄', description: 'Ouvre un passage caché', usesPerLevel: 1 },
            { name: 'Nuée protectrice', emoji: '☁️', description: 'Ralentit les pièges', usesPerLevel: 1 },
        ],
        wallColor: [160, 130, 90], floorColor: [190, 170, 120], skyColor: [100, 140, 200],
    },
    {
        id: 'prayer-cave', name: 'La Caverne de la Prière', emoji: '🕯️',
        description: 'Trouvez les autels cachés dans le silence',
        levels: 10, maxLives: 3, liveIcon: '🤫', rewardName: "Perles d'Intercession",
        gadgets: [
            { name: "Clé d'Onction", emoji: '🔑', description: 'Ouvre une salle cachée', usesPerLevel: 1 },
            { name: 'Echo Spirituel', emoji: '🔔', description: 'Révèle un autel proche', usesPerLevel: 2 },
        ],
        wallColor: [50, 45, 55], floorColor: [30, 28, 35], skyColor: [10, 8, 15],
        fogColor: [15, 12, 20], fogDistance: 5,
    },
    {
        id: 'invisible-battle', name: 'Le Combat Invisible', emoji: '🗡️',
        description: "Revêtez l'armure complète de Dieu",
        levels: 10, maxLives: 6, liveIcon: '🛡️', rewardName: "Pièces d'Armure",
        gadgets: [
            { name: 'Épée améliorée', emoji: '⚔️', description: 'Repousse un obstacle', usesPerLevel: 2 },
            { name: 'Casque lumineux', emoji: '⛑️', description: 'Vision nocturne', usesPerLevel: 1 },
        ],
        wallColor: [80, 20, 20], floorColor: [50, 15, 15], skyColor: [30, 10, 10],
        fogColor: [40, 10, 10], fogDistance: 7,
    },
    {
        id: 'wisdom-quest', name: 'La Quête de la Sagesse', emoji: '📖',
        description: 'Explorez les bibliothèques labyrinthiques',
        levels: 10, maxLives: 3, liveIcon: '📕', rewardName: 'Clés de Sagesse',
        gadgets: [
            { name: "Livre d'indice", emoji: '📘', description: 'Révèle un indice', usesPerLevel: 1 },
            { name: 'Sablier', emoji: '⏳', description: 'Ralentit le temps', usesPerLevel: 1 },
        ],
        wallColor: [120, 80, 40], floorColor: [80, 60, 30], skyColor: [200, 180, 140],
    },
    {
        id: 'mount-zion', name: 'La Montée vers Sion', emoji: '⛰️',
        description: 'Escaladez les 10 étages vers le sommet',
        levels: 10, maxLives: 4, liveIcon: '💨', rewardName: "Points d'Élévation",
        gadgets: [
            { name: 'Bottes légères', emoji: '👟', description: 'Saut amélioré', usesPerLevel: 1 },
            { name: "Harpe d'adoration", emoji: '🎵', description: 'Boost de vitesse', usesPerLevel: 1 },
        ],
        wallColor: [150, 160, 170], floorColor: [120, 130, 140], skyColor: [180, 200, 240],
    },
    {
        id: 'shepherd', name: 'Le Berger et la Brebis', emoji: '🐑',
        description: 'Sauvez les brebis perdues des loups',
        levels: 10, maxLives: 3, liveIcon: '🐺', rewardName: 'Trophée Bon Berger',
        gadgets: [
            { name: 'Bâton protecteur', emoji: '🪵', description: 'Repousse un loup', usesPerLevel: 2 },
            { name: 'Sifflet de rappel', emoji: '📯', description: 'Attire la brebis', usesPerLevel: 1 },
        ],
        wallColor: [80, 120, 60], floorColor: [100, 150, 80], skyColor: [130, 190, 230],
    },
    {
        id: 'covenant-labyrinth', name: 'Le Labyrinthe des Alliances', emoji: '📜',
        description: 'Parcourez les 10 alliances bibliques',
        levels: 10, maxLives: 3, liveIcon: '💔', rewardName: "Sceaux d'Alliance",
        gadgets: [
            { name: 'Arche miniature', emoji: '⛵', description: "Protection contre l'eau", usesPerLevel: 1 },
            { name: 'Tablette sacrée', emoji: '📋', description: 'Révèle la vérité', usesPerLevel: 1 },
        ],
        wallColor: [140, 120, 160], floorColor: [100, 90, 120], skyColor: [160, 140, 200],
    },
];

// ── Characters ───────────────────────────────────────────────
export const CHARACTERS = [
    { id: 'david', name: 'David', emoji: '👦', color: '#6366f1', speed: 1.1, description: 'Rapide et agile' },
    { id: 'moses', name: 'Moïse', emoji: '🧔', color: '#f59e0b', speed: 1.0, description: 'Sage et résistant' },
    { id: 'esther', name: 'Esther', emoji: '👸', color: '#ec4899', speed: 1.05, description: 'Courageuse et intelligente' },
    { id: 'joshua', name: 'Josué', emoji: '⚔️', color: '#10b981', speed: 1.15, description: 'Guerrier puissant' },
    { id: 'ruth', name: 'Ruth', emoji: '🌾', color: '#8b5cf6', speed: 1.0, description: 'Fidèle et persévérante' },
    { id: 'daniel', name: 'Daniel', emoji: '🦁', color: '#f97316', speed: 0.95, description: 'Vision + résistance' },
];

// ── Maze Generator (Recursive Backtracker) ───────────────────
export function generateMaze(width: number, height: number, level: number): MazeCell[][] {
    const maze: MazeCell[][] = Array.from({ length: height }, () =>
        Array.from({ length: width }, () => ({ wall: true }))
    );

    const carve = (x: number, y: number) => {
        maze[y][x].wall = false;
        const dirs = [[0, -2], [0, 2], [-2, 0], [2, 0]].sort(() => Math.random() - 0.5);
        for (const [dx, dy] of dirs) {
            const nx = x + dx, ny = y + dy;
            if (nx > 0 && nx < width - 1 && ny > 0 && ny < height - 1 && maze[ny][nx].wall) {
                maze[y + dy / 2][x + dx / 2].wall = false;
                carve(nx, ny);
            }
        }
    };

    carve(1, 1);
    maze[1][1].type = 'start';
    maze[height - 2][width - 2].type = 'exit';
    maze[height - 2][width - 2].wall = false;

    // Place questions based on level
    const qCount = Math.min(2 + level, 8);
    const openCells: [number, number][] = [];
    for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++)
            if (!maze[y][x].wall && !maze[y][x].type) openCells.push([x, y]);

    openCells.sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(qCount, openCells.length); i++) {
        const [x, y] = openCells[i];
        maze[y][x].type = 'question';
        maze[y][x].questionId = Math.floor(Math.random() * BIBLE_QUESTIONS.length);
    }

    // Place gadget pickups
    for (let i = qCount; i < Math.min(qCount + 2, openCells.length); i++) {
        const [x, y] = openCells[i];
        maze[y][x].type = 'gadget';
    }

    // Place traps (increases with level)
    const trapCount = Math.min(level, 5);
    for (let i = qCount + 2; i < Math.min(qCount + 2 + trapCount, openCells.length); i++) {
        const [x, y] = openCells[i];
        maze[y][x].type = 'trap';
    }

    return maze;
}

// ── Raycaster Engine ─────────────────────────────────────────
export function castRays(
    player: PlayerState,
    maze: MazeCell[][],
    canvasWidth: number,
    canvasHeight: number,
    fov: number = Math.PI / 3
): { distance: number; wallX: number; side: number; cellType?: string }[] {
    const rays: { distance: number; wallX: number; side: number; cellType?: string }[] = [];
    const numRays = canvasWidth;

    for (let i = 0; i < numRays; i++) {
        const rayAngle = player.angle - fov / 2 + (i / numRays) * fov;
        const sin = Math.sin(rayAngle);
        const cos = Math.cos(rayAngle);

        let dist = 0;
        const step = 0.02;
        let hitX = 0, hitY = 0;
        let side = 0;
        let cellType: string | undefined;

        while (dist < 20) {
            dist += step;
            hitX = player.x + cos * dist;
            hitY = player.y + sin * dist;

            const mapX = Math.floor(hitX);
            const mapY = Math.floor(hitY);

            if (mapY >= 0 && mapY < maze.length && mapX >= 0 && mapX < maze[0].length) {
                if (maze[mapY][mapX].wall) {
                    // Determine side (N/S vs E/W)
                    const prevX = player.x + cos * (dist - step);
                    const prevY = player.y + sin * (dist - step);
                    side = Math.floor(prevX) !== mapX ? 0 : 1;
                    cellType = maze[mapY][mapX].type;
                    break;
                }
            } else {
                break;
            }
        }

        // Fix fisheye
        const corrected = dist * Math.cos(rayAngle - player.angle);
        const wallX = side === 0 ? hitY % 1 : hitX % 1;

        rays.push({ distance: corrected, wallX, side, cellType });
    }

    return rays;
}

// ── Render frame ─────────────────────────────────────────────
export function renderFrame(
    ctx: CanvasRenderingContext2D,
    rays: { distance: number; wallX: number; side: number; cellType?: string }[],
    config: GameConfig,
    canvasWidth: number,
    canvasHeight: number
) {
    const [sr, sg, sb] = config.skyColor;
    const [fr, fg, fb] = config.floorColor;
    const [wr, wg, wb] = config.wallColor;
    const [fogR, fogG, fogB] = config.fogColor || config.skyColor;
    const fogDist = config.fogDistance || 12;

    // Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, canvasHeight / 2);
    skyGrad.addColorStop(0, `rgb(${Math.max(0, sr - 30)},${Math.max(0, sg - 30)},${Math.max(0, sb - 30)})`);
    skyGrad.addColorStop(1, `rgb(${sr},${sg},${sb})`);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight / 2);

    // Floor
    const floorGrad = ctx.createLinearGradient(0, canvasHeight / 2, 0, canvasHeight);
    floorGrad.addColorStop(0, `rgb(${fr},${fg},${fb})`);
    floorGrad.addColorStop(1, `rgb(${Math.max(0, fr - 40)},${Math.max(0, fg - 40)},${Math.max(0, fb - 40)})`);
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, canvasHeight / 2, canvasWidth, canvasHeight / 2);

    // Walls
    for (let i = 0; i < rays.length; i++) {
        const ray = rays[i];
        const lineHeight = Math.min(canvasHeight * 2, canvasHeight / ray.distance);
        const drawStart = (canvasHeight - lineHeight) / 2;

        // Fog factor
        const fogFactor = Math.min(1, ray.distance / fogDist);

        // Wall shade based on distance and side
        const shade = Math.max(0.15, 1 - ray.distance / fogDist);
        const sideShade = ray.side === 0 ? 1 : 0.75;
        const r = Math.round(wr * shade * sideShade + fogR * fogFactor);
        const g = Math.round(wg * shade * sideShade + fogG * fogFactor);
        const b = Math.round(wb * shade * sideShade + fogB * fogFactor);

        // Special colors for exit
        if (ray.cellType === 'exit') {
            ctx.fillStyle = `rgb(${Math.min(255, r + 80)},${Math.min(255, g + 120)},${Math.min(255, b)})`;
        } else {
            ctx.fillStyle = `rgb(${Math.min(255, r)},${Math.min(255, g)},${Math.min(255, b)})`;
        }

        ctx.fillRect(i, drawStart, 1, lineHeight);
    }
}

// ── Save/Load from localStorage ──────────────────────────────
export function saveProgress(gameId: string, data: any) {
    try {
        const all = JSON.parse(localStorage.getItem('labyrinth_progress') || '{}');
        all[gameId] = { ...data, savedAt: Date.now() };
        localStorage.setItem('labyrinth_progress', JSON.stringify(all));
    } catch { }
}

export function loadProgress(gameId: string): any {
    try {
        const all = JSON.parse(localStorage.getItem('labyrinth_progress') || '{}');
        return all[gameId] || null;
    } catch { return null; }
}
