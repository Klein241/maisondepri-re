export type Direction = 'horizontal' | 'vertical' | 'diagonal-down' | 'diagonal-up';

export interface GridConfig {
    width: number;
    height: number;
    directions: Direction[];
}

export function generateWordSearch(words: string[], config: GridConfig = { width: 12, height: 12, directions: ['horizontal', 'vertical', 'diagonal-down'] }) {
    const grid: string[][] = Array(config.height).fill(null).map(() => Array(config.width).fill(''));
    const placedWords: { word: string, start: { r: number, c: number }, end: { r: number, c: number } }[] = [];
    const usedWords: string[] = [];

    // Sort words by length descending to place longer words first
    const sortedWords = [...words].map(w => w.toUpperCase()).sort((a, b) => b.length - a.length);

    for (const word of sortedWords) {
        let placed = false;
        let attempts = 0;
        const maxAttempts = 100;

        while (!placed && attempts < maxAttempts) {
            const direction = config.directions[Math.floor(Math.random() * config.directions.length)];
            const r = Math.floor(Math.random() * config.height);
            const c = Math.floor(Math.random() * config.width);

            if (canPlaceWord(grid, word, r, c, direction, config)) {
                placeWord(grid, word, r, c, direction);

                // Calculate end position
                let endR = r;
                let endC = c;
                if (direction === 'horizontal') endC = c + word.length - 1;
                else if (direction === 'vertical') endR = r + word.length - 1;
                else if (direction === 'diagonal-down') { endR = r + word.length - 1; endC = c + word.length - 1; }
                else if (direction === 'diagonal-up') { endR = r - word.length + 1; endC = c + word.length - 1; }

                placedWords.push({ word, start: { r, c }, end: { r: endR, c: endC } });
                usedWords.push(word);
                placed = true;
            }
            attempts++;
        }
    }

    // Fill empty cells with random letters
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let r = 0; r < config.height; r++) {
        for (let c = 0; c < config.width; c++) {
            if (grid[r][c] === '') {
                grid[r][c] = alphabet[Math.floor(Math.random() * alphabet.length)];
            }
        }
    }

    return { grid, placedWords: usedWords }; // Return only words that fit
}

function canPlaceWord(grid: string[][], word: string, r: number, c: number, direction: Direction, config: GridConfig): boolean {
    if (direction === 'horizontal') {
        if (c + word.length > config.width) return false;
        for (let i = 0; i < word.length; i++) {
            if (grid[r][c + i] !== '' && grid[r][c + i] !== word[i]) return false;
        }
    } else if (direction === 'vertical') {
        if (r + word.length > config.height) return false;
        for (let i = 0; i < word.length; i++) {
            if (grid[r + i][c] !== '' && grid[r + i][c] !== word[i]) return false;
        }
    } else if (direction === 'diagonal-down') {
        if (r + word.length > config.height || c + word.length > config.width) return false;
        for (let i = 0; i < word.length; i++) {
            if (grid[r + i][c + i] !== '' && grid[r + i][c + i] !== word[i]) return false;
        }
    } else if (direction === 'diagonal-up') {
        if (r - word.length + 1 < 0 || c + word.length > config.width) return false;
        for (let i = 0; i < word.length; i++) {
            if (grid[r - i][c + i] !== '' && grid[r - i][c + i] !== word[i]) return false;
        }
    }
    return true;
}

function placeWord(grid: string[][], word: string, r: number, c: number, direction: Direction) {
    for (let i = 0; i < word.length; i++) {
        if (direction === 'horizontal') grid[r][c + i] = word[i];
        else if (direction === 'vertical') grid[r + i][c] = word[i];
        else if (direction === 'diagonal-down') grid[r + i][c + i] = word[i];
        else if (direction === 'diagonal-up') grid[r - i][c + i] = word[i];
    }
}
