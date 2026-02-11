/**
 * BIBLE SERVICE - SUPABASE BASED
 * ===============================
 * Simple Bible service that reads from Supabase
 * Books are uploaded via admin panel
 */

import { supabase } from '@/lib/supabase';

// Types
export interface BibleBook {
    id: string;
    book_id: string;
    name: string;
    name_en: string;
    abbreviation: string;
    testament: 'AT' | 'NT';
    chapters: number;
    book_order: number;
    is_uploaded: boolean;
    file_url?: string;
}

export interface BibleVerse {
    verse: number;
    text: string;
}

export interface BibleChapter {
    book_id: string;
    book_name: string;
    chapter: number;
    verses: BibleVerse[];
}

// Cache for loaded chapters
const chapterCache: Map<string, BibleChapter> = new Map();

// Parse verse from line format: "1  verse text" or "1 verse text"
export function parseVerseLine(line: string): BibleVerse | null {
    const match = line.trim().match(/^(\d+)\s+(.+)$/);
    if (match) {
        return {
            verse: parseInt(match[1], 10),
            text: match[2].trim()
        };
    }
    return null;
}

// Get all books from database
export async function getAllBooks(): Promise<BibleBook[]> {
    const { data, error } = await supabase
        .from('bible_books')
        .select('*')
        .order('book_order');

    if (error) {
        console.error('Error loading books:', error);
        return [];
    }
    return data || [];
}

// Get only uploaded books
export async function getUploadedBooks(): Promise<BibleBook[]> {
    const { data, error } = await supabase
        .from('bible_books')
        .select('*')
        .eq('is_uploaded', true)
        .order('book_order');

    if (error) {
        console.error('Error loading books:', error);
        return [];
    }
    return data || [];
}

// Get book by ID
export async function getBookById(bookId: string): Promise<BibleBook | null> {
    const { data, error } = await supabase
        .from('bible_books')
        .select('*')
        .eq('book_id', bookId)
        .single();

    if (error) {
        console.error('Error loading book:', error);
        return null;
    }
    return data;
}

// Load chapter content
export async function loadChapter(bookId: string, chapterNum: number): Promise<BibleChapter | null> {
    const cacheKey = `${bookId}_${chapterNum}`;

    // Check cache
    if (chapterCache.has(cacheKey)) {
        return chapterCache.get(cacheKey)!;
    }

    // First check if chapter is cached in database
    const { data: cachedChapter } = await supabase
        .from('bible_chapters')
        .select('*')
        .eq('book_id', bookId)
        .eq('chapter_number', chapterNum)
        .single();

    if (cachedChapter) {
        const chapter: BibleChapter = {
            book_id: bookId,
            book_name: '',
            chapter: chapterNum,
            verses: JSON.parse(cachedChapter.content)
        };
        chapterCache.set(cacheKey, chapter);
        return chapter;
    }

    // Load book info
    const book = await getBookById(bookId);
    if (!book || !book.is_uploaded || !book.file_url) {
        console.error('Book not available:', bookId);
        return null;
    }

    // Fetch the file content
    try {
        const response = await fetch(book.file_url);
        if (!response.ok) {
            console.error('Failed to fetch book file');
            return null;
        }

        const text = await response.text();
        const allVerses = parseBookContent(text);

        // Extract verses for this chapter
        const chapterVerses = allVerses.filter(v => v.chapter === chapterNum);

        if (chapterVerses.length === 0) {
            console.error('No verses found for chapter:', chapterNum);
            return null;
        }

        const chapter: BibleChapter = {
            book_id: bookId,
            book_name: book.name,
            chapter: chapterNum,
            verses: chapterVerses.map(v => ({ verse: v.verse, text: v.text }))
        };

        chapterCache.set(cacheKey, chapter);
        return chapter;
    } catch (error) {
        console.error('Error loading chapter:', error);
        return null;
    }
}

// Parse full book content (all chapters)
interface ParsedVerse {
    chapter: number;
    verse: number;
    text: string;
}

function parseBookContent(content: string): ParsedVerse[] {
    const lines = content.split('\n').filter(l => l.trim());
    const verses: ParsedVerse[] = [];
    let currentChapter = 1;

    for (const line of lines) {
        // Check for chapter marker (e.g., "=== Chapitre 2 ===" or just starts with lower verse number)
        const chapterMatch = line.match(/(?:chapitre|chapter)\s*(\d+)/i);
        if (chapterMatch) {
            currentChapter = parseInt(chapterMatch[1], 10);
            continue;
        }

        // Parse verse
        const verseMatch = line.trim().match(/^(\d+)\s+(.+)$/);
        if (verseMatch) {
            const verseNum = parseInt(verseMatch[1], 10);

            // Detect new chapter if verse number resets to 1
            if (verseNum === 1 && verses.length > 0) {
                const lastVerse = verses[verses.length - 1];
                if (lastVerse.verse > 1) {
                    currentChapter++;
                }
            }

            verses.push({
                chapter: currentChapter,
                verse: verseNum,
                text: verseMatch[2].trim()
            });
        }
    }

    return verses;
}

// Get random verse from uploaded books
export async function getRandomVerse(): Promise<{ reference: string; text: string } | null> {
    const books = await getUploadedBooks();
    if (books.length === 0) {
        return {
            reference: "Jean 3:16",
            text: "Car Dieu a tant aimé le monde qu'il a donné son Fils unique, afin que quiconque croit en lui ne périsse point, mais qu'il ait la vie éternelle."
        };
    }

    const randomBook = books[Math.floor(Math.random() * books.length)];
    const randomChapter = Math.floor(Math.random() * randomBook.chapters) + 1;

    const chapter = await loadChapter(randomBook.book_id, randomChapter);
    if (!chapter || chapter.verses.length === 0) {
        return {
            reference: "Psaumes 23:1",
            text: "L'Éternel est mon berger: je ne manquerai de rien."
        };
    }

    const randomVerse = chapter.verses[Math.floor(Math.random() * chapter.verses.length)];
    return {
        reference: `${randomBook.name} ${randomChapter}:${randomVerse.verse}`,
        text: randomVerse.text
    };
}

// Get verse of the day (deterministic based on date)
export async function getVerseOfTheDay(): Promise<{ reference: string; text: string }> {
    // Fallback popular verses
    const popularVerses = [
        { reference: "Jean 3:16", text: "Car Dieu a tant aimé le monde qu'il a donné son Fils unique, afin que quiconque croit en lui ne périsse point, mais qu'il ait la vie éternelle." },
        { reference: "Psaumes 23:1", text: "L'Éternel est mon berger: je ne manquerai de rien." },
        { reference: "Philippiens 4:13", text: "Je puis tout par celui qui me fortifie." },
        { reference: "Romains 8:28", text: "Nous savons, du reste, que toutes choses concourent au bien de ceux qui aiment Dieu." },
        { reference: "Proverbes 3:5", text: "Confie-toi en l'Éternel de tout ton coeur, et ne t'appuie pas sur ta sagesse." },
        { reference: "Ésaïe 40:31", text: "Mais ceux qui se confient en l'Éternel renouvellent leur force." },
        { reference: "Josué 1:9", text: "Ne t'ai-je pas donné cet ordre: Fortifie-toi et prends courage?" },
        { reference: "Matthieu 11:28", text: "Venez à moi, vous tous qui êtes fatigués et chargés, et je vous donnerai du repos." },
    ];

    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    return popularVerses[dayOfYear % popularVerses.length];
}

// Search in uploaded books
export async function searchBible(query: string, maxResults: number = 20): Promise<Array<{ reference: string; text: string }>> {
    const books = await getUploadedBooks();
    const results: Array<{ reference: string; text: string }> = [];
    const lowerQuery = query.toLowerCase();

    for (const book of books) {
        if (results.length >= maxResults) break;

        for (let chapter = 1; chapter <= book.chapters && results.length < maxResults; chapter++) {
            const chapterData = await loadChapter(book.book_id, chapter);
            if (!chapterData) continue;

            for (const verse of chapterData.verses) {
                if (verse.text.toLowerCase().includes(lowerQuery)) {
                    results.push({
                        reference: `${book.name} ${chapter}:${verse.verse}`,
                        text: verse.text
                    });
                    if (results.length >= maxResults) break;
                }
            }
        }
    }

    return results;
}

// Clear cache
export function clearBibleCache(): void {
    chapterCache.clear();
}

// Export for games
export const bibleService = {
    getAllBooks,
    getUploadedBooks,
    getBookById,
    loadChapter,
    getRandomVerse,
    getVerseOfTheDay,
    searchBible,
    clearBibleCache
};

export default bibleService;
