// Game History & Offline Persistence via localStorage
// ====================================================
// Provides game history tracking, save/resume functionality,
// and offline storage for all Bible games.

export interface GameHistoryEntry {
    id: string;
    gameType: 'quiz' | 'memory' | 'word_search' | 'chrono' | 'who_am_i' | 'duel';
    difficulty?: string;
    score: number;
    maxScore: number;
    timeSeconds: number;
    completedAt: string;
    blockNumber?: number;
    stars?: number;
    metadata?: Record<string, any>;
}

export interface GameSave {
    id: string;
    gameType: string;
    difficulty?: string;
    blockNumber?: number;
    currentQuestionIndex: number;
    score: number;
    lives: number;
    answers: { correct: boolean; time: number }[];
    streak: number;
    bestStreak: number;
    totalTime: number;
    savedAt: string;
    metadata?: Record<string, any>;
}

const HISTORY_KEY = 'bible_game_history';
const SAVE_KEY = 'bible_game_saves';
const STATS_KEY = 'bible_game_stats';
const MAX_HISTORY = 100;

// ===== GAME HISTORY =====

export function getGameHistory(): GameHistoryEntry[] {
    try {
        const data = localStorage.getItem(HISTORY_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

export function addGameHistory(entry: Omit<GameHistoryEntry, 'id' | 'completedAt'>): GameHistoryEntry {
    const history = getGameHistory();
    const newEntry: GameHistoryEntry = {
        ...entry,
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        completedAt: new Date().toISOString(),
    };

    // Add to the front, cap at MAX_HISTORY
    history.unshift(newEntry);
    if (history.length > MAX_HISTORY) history.pop();

    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));

    // Update aggregate stats
    updateStats(newEntry);

    return newEntry;
}

export function clearGameHistory(): void {
    localStorage.removeItem(HISTORY_KEY);
}

// ===== GAME SAVES (Resume) =====

export function getGameSaves(): GameSave[] {
    try {
        const data = localStorage.getItem(SAVE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

export function saveGame(save: Omit<GameSave, 'id' | 'savedAt'>): GameSave {
    const saves = getGameSaves();
    const newSave: GameSave = {
        ...save,
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        savedAt: new Date().toISOString(),
    };

    // Replace existing save for same game type + difficulty + block
    const existingIndex = saves.findIndex(
        s => s.gameType === save.gameType &&
            s.difficulty === save.difficulty &&
            s.blockNumber === save.blockNumber
    );
    if (existingIndex >= 0) {
        saves[existingIndex] = newSave;
    } else {
        saves.unshift(newSave);
    }

    // Cap at 10 saves
    if (saves.length > 10) saves.pop();

    localStorage.setItem(SAVE_KEY, JSON.stringify(saves));
    return newSave;
}

export function getGameSave(gameType: string, difficulty?: string, blockNumber?: number): GameSave | null {
    const saves = getGameSaves();
    return saves.find(
        s => s.gameType === gameType &&
            s.difficulty === difficulty &&
            s.blockNumber === blockNumber
    ) || null;
}

export function deleteGameSave(id: string): void {
    const saves = getGameSaves().filter(s => s.id !== id);
    localStorage.setItem(SAVE_KEY, JSON.stringify(saves));
}

export function deleteGameSaveByType(gameType: string, difficulty?: string, blockNumber?: number): void {
    const saves = getGameSaves().filter(
        s => !(s.gameType === gameType && s.difficulty === difficulty && s.blockNumber === blockNumber)
    );
    localStorage.setItem(SAVE_KEY, JSON.stringify(saves));
}

// ===== AGGREGATE STATS =====

export interface GameStats {
    totalGamesPlayed: number;
    totalScore: number;
    bestScore: number;
    totalTimeSeconds: number;
    averageScore: number;
    averageTime: number;
    gamesPerType: Record<string, number>;
    bestScorePerType: Record<string, number>;
    totalStars: number;
    lastPlayedAt: string | null;
}

export function getGameStats(): GameStats {
    try {
        const data = localStorage.getItem(STATS_KEY);
        if (data) return JSON.parse(data);
    } catch { }

    return {
        totalGamesPlayed: 0,
        totalScore: 0,
        bestScore: 0,
        totalTimeSeconds: 0,
        averageScore: 0,
        averageTime: 0,
        gamesPerType: {},
        bestScorePerType: {},
        totalStars: 0,
        lastPlayedAt: null,
    };
}

function updateStats(entry: GameHistoryEntry): void {
    const stats = getGameStats();

    stats.totalGamesPlayed += 1;
    stats.totalScore += entry.score;
    stats.totalTimeSeconds += entry.timeSeconds;
    stats.bestScore = Math.max(stats.bestScore, entry.score);
    stats.averageScore = stats.totalGamesPlayed > 0 ? Math.round(stats.totalScore / stats.totalGamesPlayed) : 0;
    stats.averageTime = stats.totalGamesPlayed > 0 ? Math.round(stats.totalTimeSeconds / stats.totalGamesPlayed) : 0;
    stats.lastPlayedAt = entry.completedAt;

    // Per-type stats
    stats.gamesPerType[entry.gameType] = (stats.gamesPerType[entry.gameType] || 0) + 1;
    stats.bestScorePerType[entry.gameType] = Math.max(stats.bestScorePerType[entry.gameType] || 0, entry.score);

    if (entry.stars) {
        stats.totalStars += entry.stars;
    }

    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

export function resetGameStats(): void {
    localStorage.removeItem(STATS_KEY);
}

// ===== UTILITY =====

export function formatGameTypeName(gameType: string): string {
    switch (gameType) {
        case 'quiz': return 'Quiz Biblique';
        case 'memory': return 'Memory Versets';
        case 'word_search': return 'Mots Cachés';
        case 'chrono': return 'Chronologie';
        case 'who_am_i': return 'Qui suis-je ?';
        case 'duel': return 'Duel Versets';
        default: return gameType;
    }
}

export function getGameTypeEmoji(gameType: string): string {
    switch (gameType) {
        case 'quiz': return '🧠';
        case 'memory': return '🎴';
        case 'word_search': return '🔤';
        case 'chrono': return '⏳';
        case 'who_am_i': return '❓';
        case 'duel': return '⚔️';
        default: return '🎮';
    }
}
