/**
 * LOCAL BIBLE SERVICE
 * ===================
 * Load and manage Bible data from local .txt files
 * Complete offline support - no API calls needed
 */

import {
    BibleBook,
    BibleVerse,
    BibleChapter,
    BIBLE_BOOKS,
    parseVerseLine,
    getBookById,
    formatReference
} from './local-bible-data';

import { supabase } from './supabase';

// Cache for loaded chapters
const chapterCache: Map<string, BibleChapter> = new Map();

// Load a chapter from local files or Supabase override
export async function loadChapter(bookId: string, chapter: number): Promise<BibleChapter | null> {
    const cacheKey = `${bookId}_${chapter}`;

    // Check cache first
    if (chapterCache.has(cacheKey)) {
        return chapterCache.get(cacheKey)!;
    }

    const book = getBookById(bookId);
    if (!book) {
        console.error(`Book not found: ${bookId}`);
        return null;
    }

    // Validate chapter number
    if (chapter < 1 || chapter > book.chapters) {
        console.error(`Invalid chapter ${chapter} for ${bookId} (max: ${book.chapters})`);
        return null;
    }

    try {
        // 1. Try to fetch from Supabase "bible_chapters" (Override)
        // Use a strict 2s timeout via Promise.race to never block local file loading
        const fetchOverride = async (): Promise<BibleChapter | null> => {
            try {
                const { data, error } = await supabase
                    .from('bible_chapters')
                    .select('content')
                    .match({ book_id: bookId, chapter_number: chapter })
                    .single();

                if (data && !error) {
                    const verses = JSON.parse(data.content);
                    return {
                        book: bookId,
                        bookName: book.name,
                        chapter,
                        verses: verses.map((v: any) => ({
                            book: bookId,
                            bookName: book.name,
                            chapter,
                            verse: v.verse,
                            text: v.text
                        }))
                    } as BibleChapter;
                }
            } catch (err) {
                // Silently ignore errors (offline, table doesn't exist, etc.)
            }
            return null;
        };

        // Timeout promise: resolves to null after 2s
        const timeoutPromise = new Promise<BibleChapter | null>((resolve) => {
            setTimeout(() => resolve(null), 2000);
        });

        // Race: override check vs 2s timeout — whichever finishes first wins
        const overrideData = await Promise.race([fetchOverride(), timeoutPromise]);
        if (overrideData) {
            chapterCache.set(cacheKey, overrideData);
            return overrideData;
        }

        // 2. Fallback to local file
        // Direct access to flat file structure in public/bible/
        // Filenames are normalized (lowercase, no accents)
        // e.g. /bible/genese_1.txt
        const url = `/bible/${bookId}_${chapter}.txt`;
        console.log(`[Bible] Loading local file: ${url}`);
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`Failed to load chapter: ${bookId} ${chapter} from ${url} (status: ${response.status})`);
            return null;
        }

        const text = await response.text();
        const lines = text.split('\n').filter(line => line.trim());

        const verses: BibleVerse[] = [];
        for (const line of lines) {
            // Try standard parsing first
            let parsed = parseVerseLine(line);
            // Fallback: try more lenient parsing for various formats
            if (!parsed) {
                // Match formats like: "1. text", "1: text", "1\ttext", etc.
                const lenientMatch = line.match(/^(\d+)[.:\-\t]\s*(.+)$/);
                if (lenientMatch) {
                    parsed = {
                        verse: parseInt(lenientMatch[1], 10),
                        text: lenientMatch[2].trim()
                    };
                }
            }
            if (parsed) {
                verses.push({
                    book: bookId,
                    bookName: book.name,
                    chapter,
                    verse: parsed.verse,
                    text: parsed.text
                });
            }
        }

        const chapterData: BibleChapter = {
            book: bookId,
            bookName: book.name,
            chapter,
            verses
        };

        // Cache the result
        chapterCache.set(cacheKey, chapterData);

        return chapterData;
    } catch (error) {
        console.error(`Error loading chapter ${bookId} ${chapter}:`, error);
        return null;
    }
}

// Load a specific verse
export async function loadVerse(bookId: string, chapter: number, verse: number): Promise<BibleVerse | null> {
    const chapterData = await loadChapter(bookId, chapter);
    if (!chapterData) return null;

    return chapterData.verses.find(v => v.verse === verse) || null;
}

// Load multiple verses (range)
export async function loadVerseRange(
    bookId: string,
    chapter: number,
    startVerse: number,
    endVerse: number
): Promise<BibleVerse[]> {
    const chapterData = await loadChapter(bookId, chapter);
    if (!chapterData) return [];

    return chapterData.verses.filter(v => v.verse >= startVerse && v.verse <= endVerse);
}

// Search verses by text
export async function searchBible(query: string, maxResults: number = 50): Promise<BibleVerse[]> {
    const results: BibleVerse[] = [];
    const lowerQuery = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    for (const book of BIBLE_BOOKS) {
        if (results.length >= maxResults) break;

        for (let chapter = 1; chapter <= book.chapters; chapter++) {
            if (results.length >= maxResults) break;

            const chapterData = await loadChapter(book.id, chapter);
            if (chapterData) {
                for (const verse of chapterData.verses) {
                    const normalizedText = verse.text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    if (normalizedText.includes(lowerQuery)) {
                        results.push(verse);
                        if (results.length >= maxResults) break;
                    }
                }
            }
        }
    }

    return results;
}

// Get a random verse (for games and daily verse)
export async function getRandomVerse(): Promise<BibleVerse | null> {
    const randomBook = BIBLE_BOOKS[Math.floor(Math.random() * BIBLE_BOOKS.length)];
    const randomChapter = Math.floor(Math.random() * randomBook.chapters) + 1;

    const chapterData = await loadChapter(randomBook.id, randomChapter);
    if (!chapterData || chapterData.verses.length === 0) {
        // Try again with a fallback
        const fallbackBook = BIBLE_BOOKS.find(b => b.id === 'psaumes') || BIBLE_BOOKS[0];
        const fallbackChapter = Math.floor(Math.random() * Math.min(10, fallbackBook.chapters)) + 1;
        const fallbackData = await loadChapter(fallbackBook.id, fallbackChapter);
        if (!fallbackData || fallbackData.verses.length === 0) return null;
        return fallbackData.verses[Math.floor(Math.random() * fallbackData.verses.length)];
    }

    return chapterData.verses[Math.floor(Math.random() * chapterData.verses.length)];
}

// Get verses from a specific testament
export async function getRandomVerseFromTestament(testament: 'AT' | 'NT'): Promise<BibleVerse | null> {
    const books = BIBLE_BOOKS.filter(b => b.testament === testament);
    const randomBook = books[Math.floor(Math.random() * books.length)];
    const randomChapter = Math.floor(Math.random() * randomBook.chapters) + 1;

    const chapterData = await loadChapter(randomBook.id, randomChapter);
    if (!chapterData || chapterData.verses.length === 0) {
        return null;
    }

    return chapterData.verses[Math.floor(Math.random() * chapterData.verses.length)];
}

// Get a random verse from popular/well-known books (for better game experience)
export async function getRandomPopularVerse(): Promise<BibleVerse | null> {
    const popularBooks = ['psaumes', 'proverbes', 'jean', 'matthieu', 'romains', 'genese', 'exode', 'actes'];
    const randomBook = popularBooks[Math.floor(Math.random() * popularBooks.length)];
    const book = getBookById(randomBook);
    if (!book) return getRandomVerse();

    const randomChapter = Math.floor(Math.random() * book.chapters) + 1;
    const chapterData = await loadChapter(randomBook, randomChapter);

    if (!chapterData || chapterData.verses.length === 0) {
        return getRandomVerse();
    }

    return chapterData.verses[Math.floor(Math.random() * chapterData.verses.length)];
}

// Get multiple random verses (for games)
export async function getRandomVerses(count: number): Promise<BibleVerse[]> {
    const verses: BibleVerse[] = [];
    const attempts = count * 3; // Try more times in case some fail

    for (let i = 0; i < attempts && verses.length < count; i++) {
        const verse = await getRandomPopularVerse();
        if (verse && !verses.some(v =>
            v.book === verse.book && v.chapter === verse.chapter && v.verse === verse.verse
        )) {
            verses.push(verse);
        }
    }

    return verses;
}

// Get verse of the day (deterministic based on date)
export async function getVerseOfTheDay(): Promise<BibleVerse | null> {
    // Popular verses for verse of the day
    const popularVerses = [
        { book: 'jean', chapter: 3, verse: 16 },
        { book: 'psaumes', chapter: 23, verse: 1 },
        { book: 'genese', chapter: 1, verse: 1 },
        { book: 'philippiens', chapter: 4, verse: 13 },
        { book: 'romains', chapter: 8, verse: 28 },
        { book: 'proverbes', chapter: 3, verse: 5 },
        { book: 'esaie', chapter: 40, verse: 31 },
        { book: 'josue', chapter: 1, verse: 9 },
        { book: 'matthieu', chapter: 11, verse: 28 },
        { book: 'romains', chapter: 12, verse: 2 },
        { book: 'psaumes', chapter: 46, verse: 1 },
        { book: 'hebreux', chapter: 11, verse: 1 },
        { book: 'jean', chapter: 14, verse: 6 },
        { book: 'matthieu', chapter: 6, verse: 33 },
        { book: 'psaumes', chapter: 37, verse: 4 },
        { book: 'esaie', chapter: 41, verse: 10 },
        { book: 'psaumes', chapter: 119, verse: 105 },
        { book: 'romains', chapter: 10, verse: 9 },
        { book: '1jean', chapter: 1, verse: 9 },
        { book: 'galates', chapter: 5, verse: 22 },
        { book: 'colossiens', chapter: 3, verse: 23 },
        { book: 'jacques', chapter: 1, verse: 5 },
        { book: '2corinthiens', chapter: 5, verse: 17 },
        { book: 'psaumes', chapter: 27, verse: 1 },
        { book: '1pierre', chapter: 5, verse: 7 },
        { book: 'hebreux', chapter: 4, verse: 16 },
        { book: 'psaumes', chapter: 91, verse: 1 },
        { book: 'jean', chapter: 1, verse: 1 },
        { book: 'jean', chapter: 11, verse: 35 },
        { book: 'luc', chapter: 6, verse: 31 },
        { book: 'matthieu', chapter: 5, verse: 16 },
        { book: 'proverbes', chapter: 16, verse: 3 },
        { book: 'psaumes', chapter: 34, verse: 8 },
        { book: 'jeremie', chapter: 29, verse: 11 },
        { book: 'lamentations', chapter: 3, verse: 22 },
        { book: 'psaumes', chapter: 100, verse: 5 },
        { book: 'romains', chapter: 5, verse: 8 },
        { book: 'ephesiens', chapter: 2, verse: 8 },
        { book: '1corinthiens', chapter: 16, verse: 14 },
        { book: 'psaumes', chapter: 150, verse: 6 },
    ];

    // Get day of year
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now.getTime() - start.getTime();
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));

    const verseRef = popularVerses[dayOfYear % popularVerses.length];
    return loadVerse(verseRef.book, verseRef.chapter, verseRef.verse);
}

// Clear cache (useful for memory management)
export function clearBibleCache(): void {
    chapterCache.clear();
}

// Get cache size
export function getCacheSize(): number {
    return chapterCache.size;
}

// Preload popular books for better performance
export async function preloadPopularBooks(): Promise<void> {
    const popularBooks = ['psaumes', 'proverbes', 'jean', 'matthieu', 'romains'];

    for (const bookId of popularBooks) {
        const book = getBookById(bookId);
        if (book) {
            // Load first few chapters
            for (let i = 1; i <= Math.min(5, book.chapters); i++) {
                await loadChapter(bookId, i);
            }
        }
    }
}

// Re-export types and data for convenience
export { BIBLE_BOOKS, getBookById, formatReference, type BibleVerse, type BibleChapter, type BibleBook } from './local-bible-data';
