
export const BIBLE_WORDS = [
    "JESUS", "BIBLE", "AMOUR", "FOI", "CROIX",
    "DIEU", "ESPRIT", "PAIX", "JOIE", "PRIERE",
    "EGLISE", "SALUT", "GRACE", "CHRIST", "PERE",
    "SAINT", "ANGES", "CIEL", "MONDE", "VIE",
    "COEUR", "AME", "VERITE", "PAROLE", "LOI",
    "ROIS", "JUGE", "PROPHETE", "TEMPLE", "AUTEL",
    "AGNEAU", "LION", "PAIN", "VIN", "EAU",
    "BAPTEME", "REPAS", "JEUNE", "DON", "VUE",
    "EDEN", "ARCHE", "MONTS", "MER", "JOUR",
    "NUIT", "ETOILE", "MAGE", "BERGER", "MARIE",
    "JOSEPH", "PIERRE", "PAUL", "JEAN", "MARC",
    "LUC", "ADAM", "EVE", "ABEL", "CAIN",
    "NOE", "ABRAHAM", "ISAAC", "JACOB", "ESAIE",
    "DAVID", "GOLIATH", "SAUL", "JUDAS", "THOMAS",
    "SIMON", "MARTHE", "LAZARE", "ROME", "SION"
];

export interface WordSearchGrid {
    grid: string[][];
    placedWords: string[];
}

export function generateWordSearch(size: number = 10, wordCount: number = 6): WordSearchGrid {
    // 1. Select random words
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const selectedWords = [...BIBLE_WORDS]
        .sort(() => 0.5 - Math.random())
        .slice(0, wordCount)
        .map(w => w.toUpperCase()); // Ensure uppercase

    // 2. Init grid
    const grid: string[][] = Array(size).fill(null).map(() => Array(size).fill(''));
    const placedWords: string[] = [];

    // 3. Place words
    for (const word of selectedWords) {
        if (word.length > size) continue; // Skip if too long

        let placed = false;
        // Try 50 times to place this word
        for (let attempt = 0; attempt < 50; attempt++) {
            const direction = Math.random() > 0.5 ? 'H' : 'V'; // Horizontal or Vertical
            const row = Math.floor(Math.random() * size);
            const col = Math.floor(Math.random() * size);

            if (canPlace(grid, word, row, col, direction, size)) {
                place(grid, word, row, col, direction);
                placedWords.push(word);
                placed = true;
                break;
            }
        }
    }

    // 4. Fill empty cells
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (grid[r][c] === '') {
                grid[r][c] = alphabet[Math.floor(Math.random() * alphabet.length)];
            }
        }
    }

    return { grid, placedWords };
}

function canPlace(grid: string[][], word: string, row: number, col: number, dir: 'H' | 'V', size: number): boolean {
    if (dir === 'H') {
        if (col + word.length > size) return false;
        for (let i = 0; i < word.length; i++) {
            const cell = grid[row][col + i];
            if (cell !== '' && cell !== word[i]) return false;
        }
    } else {
        if (row + word.length > size) return false;
        for (let i = 0; i < word.length; i++) {
            const cell = grid[row + i][col];
            if (cell !== '' && cell !== word[i]) return false;
        }
    }
    return true;
}

function place(grid: string[][], word: string, row: number, col: number, dir: 'H' | 'V') {
    if (dir === 'H') {
        for (let i = 0; i < word.length; i++) {
            grid[row][col + i] = word[i];
        }
    } else {
        for (let i = 0; i < word.length; i++) {
            grid[row + i][col] = word[i];
        }
    }
}
