/**
 * GAME PROGRESSION SYSTEM
 * =======================
 * Manages progressive difficulty, board unlocking, prophetic words,
 * leaderboard, hints, rewards, and level progression for all Bible games.
 *
 * LEVELS:
 * - Level 1 (ECODIM 🟢): 8 words, 10 boards
 * - Levels 2-10 (JEUNESSE 🟡): 12 words, boards 11-60 (50 boards total, ~5-6 per level)
 * - Levels 11-20 (DIFFICILE 🟠): 18 words, boards 61-150 (90 boards)
 * - Levels 21-30 (MAÎTRE 🔴): 24 words, boards 151-160 (10 boards)
 */

import { BIBLE_WORDS } from './game-data';

// =================== TYPES ===================

export type GameType = 'word_search' | 'memory' | 'who_am_i' | 'chrono';

export type DifficultyTier = 'ecodim' | 'jeunesse' | 'difficile' | 'maitre';

export interface LevelConfig {
    level: number;
    tier: DifficultyTier;
    tierLabel: string;
    tierEmoji: string;
    tierColor: string;
    wordCount: number;
    boardsInLevel: number;
    boardStartIndex: number; // global board index start
    timeLimitSeconds: number; // 3 min = 180s
}

export interface BoardState {
    boardIndex: number; // global board index (0-based)
    level: number;
    completed: boolean;
    bestTimeSeconds: number | null;
    completedAt: string | null;
    unlockedWord: string | null; // prophetic word piece
}

export interface LevelProgress {
    level: number;
    boardsCompleted: number;
    boardsTotal: number;
    propheticWords: string[];
    propheticAction: string;
    completed: boolean;
    rewardUnlocked: boolean;
    rewardTitle?: string;
    rewardPdfUrl?: string;
    rewardCoverUrl?: string;
}

export interface GameProgressData {
    gameType: GameType;
    currentLevel: number;
    currentBoardInLevel: number;
    boards: Record<number, BoardState>; // key = global board index
    levelProgress: Record<number, LevelProgress>;
    hintsUsedThisSession: number;
    totalHintsUsed: number;
    lastPlayedAt: string | null;
}

export interface LeaderboardEntry {
    playerId: string;
    playerName: string;
    playerAvatar?: string | null;
    boardIndex: number;
    level: number;
    timeSeconds: number;
    completedAt: string;
    gameType: GameType;
}

export interface BestRecord {
    playerName: string;
    timeSeconds: number;
}

// =================== CONSTANTS ===================

const PROGRESSION_KEY_PREFIX = 'game_progression_';
const LEADERBOARD_KEY = 'game_leaderboard';
const MAX_HINTS_PER_SESSION = 3;

// Time limit per board in seconds
const DEFAULT_TIME_LIMIT = 180; // 3 minutes

// =================== LEVEL CONFIGURATION ===================

export function getLevelConfig(level: number): LevelConfig {
    if (level === 1) {
        return {
            level: 1,
            tier: 'ecodim',
            tierLabel: 'École du Dimanche (ECODIM)',
            tierEmoji: '🟢',
            tierColor: '#22c55e',
            wordCount: 8,
            boardsInLevel: 10,
            boardStartIndex: 0,
            timeLimitSeconds: DEFAULT_TIME_LIMIT,
        };
    }

    if (level >= 2 && level <= 10) {
        const boardsPerLevel = Math.ceil(50 / 9); // ~6 boards per level
        const levelOffset = level - 2;
        return {
            level,
            tier: 'jeunesse',
            tierLabel: 'JEUNESSE',
            tierEmoji: '🟡',
            tierColor: '#eab308',
            wordCount: 12,
            boardsInLevel: levelOffset < 8 ? boardsPerLevel : 50 - (8 * boardsPerLevel), // last level gets remainder
            boardStartIndex: 10 + (levelOffset * boardsPerLevel),
            timeLimitSeconds: DEFAULT_TIME_LIMIT,
        };
    }

    if (level >= 11 && level <= 20) {
        const boardsPerLevel = 9; // 90 / 10 = 9
        const levelOffset = level - 11;
        return {
            level,
            tier: 'difficile',
            tierLabel: 'DIFFICILE',
            tierEmoji: '🟠',
            tierColor: '#f97316',
            wordCount: 18,
            boardsInLevel: boardsPerLevel,
            boardStartIndex: 60 + (levelOffset * boardsPerLevel),
            timeLimitSeconds: DEFAULT_TIME_LIMIT,
        };
    }

    // Levels 21-30 (MAÎTRE)
    const levelOffset = level - 21;
    return {
        level,
        tier: 'maitre',
        tierLabel: 'MAÎTRE',
        tierEmoji: '🔴',
        tierColor: '#ef4444',
        wordCount: 24,
        boardsInLevel: 1, // 10 boards / 10 levels = 1 per level
        boardStartIndex: 150 + levelOffset,
        timeLimitSeconds: DEFAULT_TIME_LIMIT,
    };
}

export function getTotalBoards(): number {
    return 10 + 50 + 90 + 10; // 160 total boards
}

export function getLevelForBoard(boardIndex: number): number {
    if (boardIndex < 10) return 1;
    if (boardIndex < 60) {
        const offset = boardIndex - 10;
        const boardsPerLevel = Math.ceil(50 / 9);
        return 2 + Math.min(Math.floor(offset / boardsPerLevel), 8);
    }
    if (boardIndex < 150) {
        const offset = boardIndex - 60;
        return 11 + Math.floor(offset / 9);
    }
    return 21 + (boardIndex - 150);
}

// =================== PROPHETIC WORDS ===================

// Bible-inspired prophetic phrases for each level
// These form sentences when all words from a level are combined
const PROPHETIC_PHRASES: Record<number, { words: string[], action: string }> = {
    1: {
        words: ['L\'ÉTERNEL', 'EST', 'TON', 'BERGER', 'IL', 'TE', 'CONDUIT', 'DANS', 'LA', 'PAIX'],
        action: 'ENVOIE UN MESSAGE DE PARDON À CELUI QUI T\'A OFFENSÉ'
    },
    2: {
        words: ['DIEU', 'A', 'UN', 'PLAN', 'MERVEILLEUX', 'POUR'],
        action: 'PRIE POUR UNE PERSONNE QUE TU N\'AIMES PAS'
    },
    3: {
        words: ['TA', 'VIE', 'NE', 'TE', 'LIMITE', 'PAS'],
        action: 'FAIS UN ACTE DE BONTÉ ENVERS UN INCONNU'
    },
    4: {
        words: ['LA', 'FOI', 'DÉPLACE', 'LES', 'MONTAGNES', 'DEVANT'],
        action: 'PARTAGE UN VERSET BIBLIQUE AVEC UN AMI'
    },
    5: {
        words: ['TON', 'AVENIR', 'EST', 'ENTRE', 'LES', 'MAINS'],
        action: 'APPELLE QUELQU\'UN QUE TU N\'AS PAS VU DEPUIS LONGTEMPS'
    },
    6: {
        words: ['DE', 'CELUI', 'QUI', 'T\'A', 'CRÉÉ', 'AVEC'],
        action: 'ÉCRIS UNE LETTRE DE GRATITUDE À TES PARENTS'
    },
    7: {
        words: ['AMOUR', 'ET', 'DESSEIN', 'JÉSUS', 'EST', 'SEIGNEUR'],
        action: 'INVITE QUELQU\'UN À L\'ÉGLISE'
    },
    8: {
        words: ['RÉJOUIS', 'TOI', 'CAR', 'TON', 'NOM', 'EST'],
        action: 'DONNE UN REPAS À QUELQU\'UN DANS LE BESOIN'
    },
    9: {
        words: ['INSCRIT', 'DANS', 'LE', 'LIVRE', 'DE', 'VIE'],
        action: 'ENSEIGNE UN VERSET À UN ENFANT'
    },
    10: {
        words: ['NE', 'CRAINS', 'PAS', 'JE', 'SUIS', 'AVEC'],
        action: 'RÉCONCILIE-TOI AVEC QUELQU\'UN'
    },
    11: {
        words: ['TOI', 'JE', 'TE', 'FORTIFIE', 'JE', 'VIENS', 'À', 'TON', 'SECOURS'],
        action: 'ENCOURAGE TROIS PERSONNES AUJOURD\'HUI'
    },
    12: {
        words: ['CAR', 'MOI', 'L\'ÉTERNEL', 'TON', 'DIEU', 'JE', 'TE', 'SAISIS', 'PAR'],
        action: 'VISITE UN MALADE OU UNE PERSONNE ÂGÉE'
    },
    13: {
        words: ['LA', 'MAIN', 'DROITE', 'MOI', 'QUI', 'TE', 'DIS', 'NE', 'CRAINS'],
        action: 'JEÛNE UN REPAS ET PRIE'
    },
    14: {
        words: ['RIEN', 'CAR', 'JE', 'VIENS', 'À', 'TON', 'SECOURS', 'DIT', 'L\'ÉTERNEL'],
        action: 'DONNE UNE OFFRANDE SPÉCIALE'
    },
    15: {
        words: ['CONFIE', 'TOI', 'EN', 'L\'ÉTERNEL', 'DE', 'TOUT', 'TON', 'COEUR', 'NE'],
        action: 'LOUE DIEU PENDANT 30 MINUTES'
    },
    16: {
        words: ['T\'APPUIE', 'PAS', 'SUR', 'TA', 'PROPRE', 'SAGESSE', 'RECONNAIS', 'LE', 'DANS'],
        action: 'PARTAGE TON TÉMOIGNAGE AVEC QUELQU\'UN'
    },
    17: {
        words: ['TOUTES', 'TES', 'VOIES', 'ET', 'IL', 'APLANIRA', 'TES', 'SENTIERS', 'AMEN'],
        action: 'LIS UN CHAPITRE DE LA BIBLE À HAUTE VOIX'
    },
    18: {
        words: ['LE', 'SEIGNEUR', 'EST', 'PROCHE', 'DE', 'CEUX', 'QUI', 'ONT', 'LE'],
        action: 'CONSOLE QUELQU\'UN QUI TRAVERSE UNE ÉPREUVE'
    },
    19: {
        words: ['COEUR', 'BRISÉ', 'ET', 'IL', 'SAUVE', 'CEUX', 'QUI', 'SONT', 'ABATTUS'],
        action: 'COMMENCE UN JOURNAL DE PRIÈRE'
    },
    20: {
        words: ['JE', 'CONNAIS', 'LES', 'PROJETS', 'QUE', 'J\'AI', 'FORMÉS', 'SUR', 'VOUS'],
        action: 'PRIE POUR TA NATION PENDANT 15 MINUTES'
    },
    21: { words: ['CE'], action: 'ORGANISE UNE SOIRÉE DE LOUANGE' },
    22: { words: ['SONT'], action: 'OFFRE UN LIVRE CHRÉTIEN' },
    23: { words: ['DES'], action: 'MEMORISE UN PSAUME ENTIER' },
    24: { words: ['PROJETS'], action: 'DEVIENS MENTOR D\'UN JEUNE CROYANT' },
    25: { words: ['DE'], action: 'PARTICIPE À UNE OEUVRE CARITATIVE' },
    26: { words: ['PAIX'], action: 'PRIE POUR 7 PERSONNES PAR NOM' },
    27: { words: ['ET'], action: 'ORGANISE UN GROUPE D\'ÉTUDE BIBLIQUE' },
    28: { words: ['NON'], action: 'PARTAGE LA BONNE NOUVELLE' },
    29: { words: ['DE'], action: 'BÉNIS QUELQU\'UN FINANCIÈREMENT' },
    30: { words: ['MALHEUR'], action: 'RENDS GLOIRE À DIEU EN TOUTES CHOSES' },
};

export function getPropheticPhrase(level: number): { words: string[], action: string } {
    return PROPHETIC_PHRASES[level] || { words: ['AMEN'], action: 'PRIE ET RENDS GRÂCE' };
}

// =================== PERSISTENCE ===================

function getStorageKey(gameType: GameType): string {
    return `${PROGRESSION_KEY_PREFIX}${gameType}`;
}

export function getGameProgress(gameType: GameType): GameProgressData {
    try {
        const data = localStorage.getItem(getStorageKey(gameType));
        if (data) return JSON.parse(data);
    } catch { }

    return {
        gameType,
        currentLevel: 1,
        currentBoardInLevel: 0,
        boards: {},
        levelProgress: {},
        hintsUsedThisSession: 0,
        totalHintsUsed: 0,
        lastPlayedAt: null,
    };
}

export function saveGameProgress(progress: GameProgressData): void {
    progress.lastPlayedAt = new Date().toISOString();
    localStorage.setItem(getStorageKey(progress.gameType), JSON.stringify(progress));
}

// =================== BOARD COMPLETION ===================

export function completeBoard(
    gameType: GameType,
    boardIndex: number,
    timeSeconds: number,
    playerName: string,
    playerId: string
): { progress: GameProgressData; levelCompleted: boolean; propheticWord: string | null; action: string | null } {
    const progress = getGameProgress(gameType);
    const level = getLevelForBoard(boardIndex);
    const config = getLevelConfig(level);
    const phrase = getPropheticPhrase(level);

    // Update board state
    const existingBoard = progress.boards[boardIndex];
    const isNewCompletion = !existingBoard?.completed;

    progress.boards[boardIndex] = {
        boardIndex,
        level,
        completed: true,
        bestTimeSeconds: existingBoard?.bestTimeSeconds
            ? Math.min(existingBoard.bestTimeSeconds, timeSeconds)
            : timeSeconds,
        completedAt: new Date().toISOString(),
        unlockedWord: null,
    };

    // Initialize level progress if needed
    if (!progress.levelProgress[level]) {
        progress.levelProgress[level] = {
            level,
            boardsCompleted: 0,
            boardsTotal: config.boardsInLevel,
            propheticWords: [],
            propheticAction: phrase.action,
            completed: false,
            rewardUnlocked: false,
        };
    }

    const lp = progress.levelProgress[level];

    // Count total completed boards for this level
    let completedInLevel = 0;
    for (let i = config.boardStartIndex; i < config.boardStartIndex + config.boardsInLevel; i++) {
        if (progress.boards[i]?.completed) completedInLevel++;
    }
    lp.boardsCompleted = completedInLevel;

    // Unlock a prophetic word (if applicable & new completion)
    let unlockedPropheticWord: string | null = null;
    if (isNewCompletion && gameType === 'word_search') {
        const wordIndex = completedInLevel - 1;
        if (wordIndex < phrase.words.length) {
            unlockedPropheticWord = phrase.words[wordIndex];
            lp.propheticWords = phrase.words.slice(0, completedInLevel);
            progress.boards[boardIndex].unlockedWord = unlockedPropheticWord;
        }
    }

    // Check if level is completed
    const levelCompleted = completedInLevel >= config.boardsInLevel;
    if (levelCompleted) {
        lp.completed = true;
        lp.rewardUnlocked = true;
        // Advance to next level
        if (level < 30) {
            progress.currentLevel = level + 1;
            progress.currentBoardInLevel = 0;
        }
    }

    // Update current board
    progress.currentBoardInLevel = completedInLevel;

    // Save
    saveGameProgress(progress);

    // Add to leaderboard
    addLeaderboardEntry({
        playerId,
        playerName,
        boardIndex,
        level,
        timeSeconds,
        completedAt: new Date().toISOString(),
        gameType,
    });

    return {
        progress,
        levelCompleted,
        propheticWord: unlockedPropheticWord,
        action: levelCompleted ? phrase.action : null,
    };
}

// =================== HINTS ===================

export function useHint(gameType: GameType): boolean {
    const progress = getGameProgress(gameType);
    if (progress.hintsUsedThisSession >= MAX_HINTS_PER_SESSION) return false;

    progress.hintsUsedThisSession += 1;
    progress.totalHintsUsed += 1;
    saveGameProgress(progress);
    return true;
}

export function resetSessionHints(gameType: GameType): void {
    const progress = getGameProgress(gameType);
    progress.hintsUsedThisSession = 0;
    saveGameProgress(progress);
}

export function getHintsRemaining(gameType: GameType): number {
    const progress = getGameProgress(gameType);
    return MAX_HINTS_PER_SESSION - progress.hintsUsedThisSession;
}

// =================== LEADERBOARD ===================

export function getLeaderboard(gameType?: GameType, boardIndex?: number): LeaderboardEntry[] {
    try {
        const data = localStorage.getItem(LEADERBOARD_KEY);
        let entries: LeaderboardEntry[] = data ? JSON.parse(data) : [];

        if (gameType) entries = entries.filter(e => e.gameType === gameType);
        if (boardIndex !== undefined) entries = entries.filter(e => e.boardIndex === boardIndex);

        // Sort by time (ascending = fastest first)
        entries.sort((a, b) => a.timeSeconds - b.timeSeconds);
        return entries;
    } catch {
        return [];
    }
}

export function addLeaderboardEntry(entry: LeaderboardEntry): void {
    try {
        const data = localStorage.getItem(LEADERBOARD_KEY);
        const entries: LeaderboardEntry[] = data ? JSON.parse(data) : [];

        // Check if this player already has an entry for this board
        const existing = entries.findIndex(
            e => e.playerId === entry.playerId && e.boardIndex === entry.boardIndex && e.gameType === entry.gameType
        );

        if (existing >= 0) {
            // Only update if faster
            if (entry.timeSeconds < entries[existing].timeSeconds) {
                entries[existing] = entry;
            }
        } else {
            entries.push(entry);
        }

        // Cap at 500 entries
        if (entries.length > 500) entries.splice(500);

        localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries));
    } catch { }
}

export function getBestRecord(gameType: GameType, boardIndex?: number): BestRecord | null {
    const entries = getLeaderboard(gameType, boardIndex);
    if (entries.length === 0) return null;
    return {
        playerName: entries[0].playerName,
        timeSeconds: entries[0].timeSeconds,
    };
}

// =================== BOARD LOCKING ===================

export function isBoardUnlocked(gameType: GameType, boardIndex: number): boolean {
    const progress = getGameProgress(gameType);
    const level = getLevelForBoard(boardIndex);
    const config = getLevelConfig(level);

    // Level 1 boards are always unlocked
    if (level === 1) return true;

    // For other levels, previous level must be completed
    const prevLevel = level - 1;
    const prevConfig = getLevelConfig(prevLevel);

    // Check if all boards of previous level are completed
    let prevCompleted = 0;
    for (let i = prevConfig.boardStartIndex; i < prevConfig.boardStartIndex + prevConfig.boardsInLevel; i++) {
        if (progress.boards[i]?.completed) prevCompleted++;
    }

    return prevCompleted >= prevConfig.boardsInLevel;
}

export function isLevelUnlocked(gameType: GameType, level: number): boolean {
    if (level === 1) return true;
    const progress = getGameProgress(gameType);
    const prevLevel = level - 1;
    return progress.levelProgress[prevLevel]?.completed === true;
}

// =================== WORDS PER BOARD ===================

// Deterministic word selection per board (so same board always has same words)

function seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
    };
}

export function getWordsForBoard(boardIndex: number, wordCount: number): string[] {
    const allWords: string[] = [];
    Object.values(BIBLE_WORDS).forEach(arr => allWords.push(...arr));

    // Remove duplicates
    const uniqueWords = [...new Set(allWords)];

    // Use board index as seed for deterministic randomness
    const rng = seededRandom(boardIndex * 7919 + 31337);

    // Shuffle with seeded RNG
    const shuffled = [...uniqueWords];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Filter by appropriate length based on word count (difficulty)
    let filtered: string[];
    if (wordCount <= 8) {
        // Easy: prefer short words (3-7 chars)
        filtered = shuffled.filter(w => w.length >= 3 && w.length <= 7);
    } else if (wordCount <= 12) {
        // Medium: mix of short and medium (3-9 chars)
        filtered = shuffled.filter(w => w.length >= 3 && w.length <= 9);
    } else if (wordCount <= 18) {
        // Hard: medium to long (4-12 chars)
        filtered = shuffled.filter(w => w.length >= 4 && w.length <= 12);
    } else {
        // Master: all lengths
        filtered = shuffled.filter(w => w.length >= 3);
    }

    if (filtered.length < wordCount) {
        filtered = shuffled; // fallback to all words
    }

    return filtered.slice(0, wordCount);
}

// Grid size based on difficulty
export function getGridSizeForLevel(level: number): { width: number; height: number } {
    const config = getLevelConfig(level);
    if (config.wordCount <= 8) return { width: 10, height: 10 };
    if (config.wordCount <= 12) return { width: 12, height: 12 };
    if (config.wordCount <= 18) return { width: 14, height: 14 };
    return { width: 16, height: 16 };
}

// =================== FORMATTING ===================

export function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function getTierInfo(tier: DifficultyTier): { label: string; emoji: string; color: string } {
    switch (tier) {
        case 'ecodim': return { label: 'ECODIM', emoji: '🟢', color: '#22c55e' };
        case 'jeunesse': return { label: 'JEUNESSE', emoji: '🟡', color: '#eab308' };
        case 'difficile': return { label: 'DIFFICILE', emoji: '🟠', color: '#f97316' };
        case 'maitre': return { label: 'MAÎTRE', emoji: '🔴', color: '#ef4444' };
    }
}
