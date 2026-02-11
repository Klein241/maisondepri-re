/**
 * UNIFIED BIBLE API SERVICE - FIXED
 * ==================================
 * 
 * Single source of truth for all Bible data in the app.
 * Uses LOCAL FRENCH DATA from .txt files as primary source.
 * Uses bible-api.com only for English translations.
 */

import {
    BIBLE_BOOKS as LOCAL_BOOKS,
    BibleVerse as LocalVerse,
    BibleChapter,
    BibleBook as LocalBook,
    getBookById as getLocalBookById,
    formatReference,
    getChapterCount,
    parseVerseLine
} from './local-bible-data';

import {
    loadChapter,
    loadVerse,
    loadVerseRange,
    searchBible as localSearchBible,
    getRandomVerse as getLocalRandomVerse,
    getRandomVerses as getLocalRandomVerses,
    getVerseOfTheDay as getLocalVerseOfTheDay,
    preloadPopularBooks
} from './local-bible-service';

// ============================================
// TYPES (Backward compatible)
// ============================================

export interface BibleVerse {
    reference: string;
    text: string;
    book_id?: string;
    book_name?: string;
    chapter?: number;
    verse?: number;
}

export interface BiblePassage {
    reference: string;
    text: string;
    translation_id: string;
    translation_name: string;
    verses: BibleVerse[];
}

export interface BibleBook {
    id: string;
    name: string;
    nameLong: string;
    abbreviation: string;
    testament: 'OT' | 'NT';
    chapters: number;
    nameEn?: string;
    localId?: string;
}

export interface BibleTranslation {
    id: string;
    name: string;
    abbreviation: string;
    language: string;
}

// ============================================
// CONSTANTS
// ============================================

const API_BASE_URL = 'https://bible-api.com';
const CACHE_DURATION_MS = 1000 * 60 * 60;

export const TRANSLATIONS: BibleTranslation[] = [
    { id: 'lsg', name: 'Louis Segond 1910', abbreviation: 'LSG', language: 'fr' },
    { id: 'kjv', name: 'King James Version', abbreviation: 'KJV', language: 'en' },
    { id: 'web', name: 'World English Bible', abbreviation: 'WEB', language: 'en' },
];

export const DEFAULT_TRANSLATION = 'lsg';

// Mapping from standard Bible IDs to local file names
const STANDARD_TO_LOCAL: Record<string, string> = {
    'GEN': 'genese', 'EXO': 'exode', 'LEV': 'levitique', 'NUM': 'nombres', 'DEU': 'deuteronome',
    'JOS': 'josue', 'JDG': 'juges', 'RUT': 'ruth', '1SA': '1samuel', '2SA': '2samuel',
    '1KI': '1rois', '2KI': '2rois', '1CH': '1chroniques', '2CH': '2chroniques',
    'EZR': 'esdras', 'NEH': 'nehemie', 'EST': 'esther', 'JOB': 'job',
    'PSA': 'psaumes', 'PRO': 'proverbes', 'ECC': 'ecclesiaste', 'SNG': 'cantique',
    'ISA': 'esaie', 'JER': 'jeremie', 'LAM': 'lamentations', 'EZK': 'ezechiel',
    'DAN': 'daniel', 'HOS': 'osee', 'JOL': 'joel', 'AMO': 'amos', 'OBA': 'abdias',
    'JON': 'jonas', 'MIC': 'michee', 'NAM': 'nahum', 'HAB': 'habacuc',
    'ZEP': 'sophonie', 'HAG': 'aggee', 'ZEC': 'zacharie', 'MAL': 'malachie',
    'MAT': 'matthieu', 'MRK': 'marc', 'LUK': 'luc', 'JHN': 'jean', 'ACT': 'actes',
    'ROM': 'romains', '1CO': '1corinthiens', '2CO': '2corinthiens', 'GAL': 'galates',
    'EPH': 'ephesiens', 'PHP': 'philippiens', 'COL': 'colossiens',
    '1TH': '1thessaloniciens', '2TH': '2thessaloniciens', '1TI': '1timothee',
    '2TI': '2timothee', 'TIT': 'tite', 'PHM': 'philemon', 'HEB': 'hebreux',
    'JAS': 'jacques', '1PE': '1pierre', '2PE': '2pierre', '1JN': '1jean',
    '2JN': '2jean', '3JN': '3jean', 'JUD': 'jude', 'REV': 'apocalypse'
};

// Reverse mapping
const LOCAL_TO_STANDARD: Record<string, string> = Object.fromEntries(
    Object.entries(STANDARD_TO_LOCAL).map(([k, v]) => [v, k])
);

// Complete list of Bible books with standard IDs
export const BIBLE_BOOKS: BibleBook[] = [
    // Old Testament (39 books)
    { id: 'GEN', name: 'Genèse', nameLong: 'Genèse', abbreviation: 'Gen', testament: 'OT', chapters: 50, nameEn: 'Genesis', localId: 'genese' },
    { id: 'EXO', name: 'Exode', nameLong: 'Exode', abbreviation: 'Exo', testament: 'OT', chapters: 40, nameEn: 'Exodus', localId: 'exode' },
    { id: 'LEV', name: 'Lévitique', nameLong: 'Lévitique', abbreviation: 'Lév', testament: 'OT', chapters: 27, nameEn: 'Leviticus', localId: 'levitique' },
    { id: 'NUM', name: 'Nombres', nameLong: 'Nombres', abbreviation: 'Nom', testament: 'OT', chapters: 36, nameEn: 'Numbers', localId: 'nombres' },
    { id: 'DEU', name: 'Deutéronome', nameLong: 'Deutéronome', abbreviation: 'Deu', testament: 'OT', chapters: 34, nameEn: 'Deuteronomy', localId: 'deuteronome' },
    { id: 'JOS', name: 'Josué', nameLong: 'Josué', abbreviation: 'Jos', testament: 'OT', chapters: 24, nameEn: 'Joshua', localId: 'josue' },
    { id: 'JDG', name: 'Juges', nameLong: 'Juges', abbreviation: 'Jug', testament: 'OT', chapters: 21, nameEn: 'Judges', localId: 'juges' },
    { id: 'RUT', name: 'Ruth', nameLong: 'Ruth', abbreviation: 'Rut', testament: 'OT', chapters: 4, nameEn: 'Ruth', localId: 'ruth' },
    { id: '1SA', name: '1 Samuel', nameLong: '1 Samuel', abbreviation: '1Sa', testament: 'OT', chapters: 31, nameEn: '1 Samuel', localId: '1samuel' },
    { id: '2SA', name: '2 Samuel', nameLong: '2 Samuel', abbreviation: '2Sa', testament: 'OT', chapters: 24, nameEn: '2 Samuel', localId: '2samuel' },
    { id: '1KI', name: '1 Rois', nameLong: '1 Rois', abbreviation: '1Ro', testament: 'OT', chapters: 22, nameEn: '1 Kings', localId: '1rois' },
    { id: '2KI', name: '2 Rois', nameLong: '2 Rois', abbreviation: '2Ro', testament: 'OT', chapters: 25, nameEn: '2 Kings', localId: '2rois' },
    { id: '1CH', name: '1 Chroniques', nameLong: '1 Chroniques', abbreviation: '1Ch', testament: 'OT', chapters: 29, nameEn: '1 Chronicles', localId: '1chroniques' },
    { id: '2CH', name: '2 Chroniques', nameLong: '2 Chroniques', abbreviation: '2Ch', testament: 'OT', chapters: 36, nameEn: '2 Chronicles', localId: '2chroniques' },
    { id: 'EZR', name: 'Esdras', nameLong: 'Esdras', abbreviation: 'Esd', testament: 'OT', chapters: 10, nameEn: 'Ezra', localId: 'esdras' },
    { id: 'NEH', name: 'Néhémie', nameLong: 'Néhémie', abbreviation: 'Néh', testament: 'OT', chapters: 13, nameEn: 'Nehemiah', localId: 'nehemie' },
    { id: 'EST', name: 'Esther', nameLong: 'Esther', abbreviation: 'Est', testament: 'OT', chapters: 10, nameEn: 'Esther', localId: 'esther' },
    { id: 'JOB', name: 'Job', nameLong: 'Job', abbreviation: 'Job', testament: 'OT', chapters: 42, nameEn: 'Job', localId: 'job' },
    { id: 'PSA', name: 'Psaumes', nameLong: 'Psaumes', abbreviation: 'Psa', testament: 'OT', chapters: 150, nameEn: 'Psalms', localId: 'psaumes' },
    { id: 'PRO', name: 'Proverbes', nameLong: 'Proverbes', abbreviation: 'Pro', testament: 'OT', chapters: 31, nameEn: 'Proverbs', localId: 'proverbes' },
    { id: 'ECC', name: 'Ecclésiaste', nameLong: 'Ecclésiaste', abbreviation: 'Ecc', testament: 'OT', chapters: 12, nameEn: 'Ecclesiastes', localId: 'ecclesiaste' },
    { id: 'SNG', name: 'Cantique', nameLong: 'Cantique des Cantiques', abbreviation: 'Can', testament: 'OT', chapters: 8, nameEn: 'Song of Solomon', localId: 'cantique' },
    { id: 'ISA', name: 'Ésaïe', nameLong: 'Ésaïe', abbreviation: 'Ésa', testament: 'OT', chapters: 66, nameEn: 'Isaiah', localId: 'esaie' },
    { id: 'JER', name: 'Jérémie', nameLong: 'Jérémie', abbreviation: 'Jér', testament: 'OT', chapters: 52, nameEn: 'Jeremiah', localId: 'jeremie' },
    { id: 'LAM', name: 'Lamentations', nameLong: 'Lamentations', abbreviation: 'Lam', testament: 'OT', chapters: 5, nameEn: 'Lamentations', localId: 'lamentations' },
    { id: 'EZK', name: 'Ézéchiel', nameLong: 'Ézéchiel', abbreviation: 'Ézé', testament: 'OT', chapters: 48, nameEn: 'Ezekiel', localId: 'ezechiel' },
    { id: 'DAN', name: 'Daniel', nameLong: 'Daniel', abbreviation: 'Dan', testament: 'OT', chapters: 12, nameEn: 'Daniel', localId: 'daniel' },
    { id: 'HOS', name: 'Osée', nameLong: 'Osée', abbreviation: 'Osé', testament: 'OT', chapters: 14, nameEn: 'Hosea', localId: 'osee' },
    { id: 'JOL', name: 'Joël', nameLong: 'Joël', abbreviation: 'Joë', testament: 'OT', chapters: 3, nameEn: 'Joel', localId: 'joel' },
    { id: 'AMO', name: 'Amos', nameLong: 'Amos', abbreviation: 'Amo', testament: 'OT', chapters: 9, nameEn: 'Amos', localId: 'amos' },
    { id: 'OBA', name: 'Abdias', nameLong: 'Abdias', abbreviation: 'Abd', testament: 'OT', chapters: 1, nameEn: 'Obadiah', localId: 'abdias' },
    { id: 'JON', name: 'Jonas', nameLong: 'Jonas', abbreviation: 'Jon', testament: 'OT', chapters: 4, nameEn: 'Jonah', localId: 'jonas' },
    { id: 'MIC', name: 'Michée', nameLong: 'Michée', abbreviation: 'Mic', testament: 'OT', chapters: 7, nameEn: 'Micah', localId: 'michee' },
    { id: 'NAM', name: 'Nahum', nameLong: 'Nahum', abbreviation: 'Nah', testament: 'OT', chapters: 3, nameEn: 'Nahum', localId: 'nahum' },
    { id: 'HAB', name: 'Habacuc', nameLong: 'Habacuc', abbreviation: 'Hab', testament: 'OT', chapters: 3, nameEn: 'Habakkuk', localId: 'habacuc' },
    { id: 'ZEP', name: 'Sophonie', nameLong: 'Sophonie', abbreviation: 'Sop', testament: 'OT', chapters: 3, nameEn: 'Zephaniah', localId: 'sophonie' },
    { id: 'HAG', name: 'Aggée', nameLong: 'Aggée', abbreviation: 'Agg', testament: 'OT', chapters: 2, nameEn: 'Haggai', localId: 'aggee' },
    { id: 'ZEC', name: 'Zacharie', nameLong: 'Zacharie', abbreviation: 'Zac', testament: 'OT', chapters: 14, nameEn: 'Zechariah', localId: 'zacharie' },
    { id: 'MAL', name: 'Malachie', nameLong: 'Malachie', abbreviation: 'Mal', testament: 'OT', chapters: 4, nameEn: 'Malachi', localId: 'malachie' },
    // New Testament (27 books)
    { id: 'MAT', name: 'Matthieu', nameLong: 'Matthieu', abbreviation: 'Mat', testament: 'NT', chapters: 28, nameEn: 'Matthew', localId: 'matthieu' },
    { id: 'MRK', name: 'Marc', nameLong: 'Marc', abbreviation: 'Mar', testament: 'NT', chapters: 16, nameEn: 'Mark', localId: 'marc' },
    { id: 'LUK', name: 'Luc', nameLong: 'Luc', abbreviation: 'Luc', testament: 'NT', chapters: 24, nameEn: 'Luke', localId: 'luc' },
    { id: 'JHN', name: 'Jean', nameLong: 'Jean', abbreviation: 'Jea', testament: 'NT', chapters: 21, nameEn: 'John', localId: 'jean' },
    { id: 'ACT', name: 'Actes', nameLong: 'Actes des Apôtres', abbreviation: 'Act', testament: 'NT', chapters: 28, nameEn: 'Acts', localId: 'actes' },
    { id: 'ROM', name: 'Romains', nameLong: 'Romains', abbreviation: 'Rom', testament: 'NT', chapters: 16, nameEn: 'Romans', localId: 'romains' },
    { id: '1CO', name: '1 Corinthiens', nameLong: '1 Corinthiens', abbreviation: '1Co', testament: 'NT', chapters: 16, nameEn: '1 Corinthians', localId: '1corinthiens' },
    { id: '2CO', name: '2 Corinthiens', nameLong: '2 Corinthiens', abbreviation: '2Co', testament: 'NT', chapters: 13, nameEn: '2 Corinthians', localId: '2corinthiens' },
    { id: 'GAL', name: 'Galates', nameLong: 'Galates', abbreviation: 'Gal', testament: 'NT', chapters: 6, nameEn: 'Galatians', localId: 'galates' },
    { id: 'EPH', name: 'Éphésiens', nameLong: 'Éphésiens', abbreviation: 'Éph', testament: 'NT', chapters: 6, nameEn: 'Ephesians', localId: 'ephesiens' },
    { id: 'PHP', name: 'Philippiens', nameLong: 'Philippiens', abbreviation: 'Phi', testament: 'NT', chapters: 4, nameEn: 'Philippians', localId: 'philippiens' },
    { id: 'COL', name: 'Colossiens', nameLong: 'Colossiens', abbreviation: 'Col', testament: 'NT', chapters: 4, nameEn: 'Colossians', localId: 'colossiens' },
    { id: '1TH', name: '1 Thessaloniciens', nameLong: '1 Thessaloniciens', abbreviation: '1Th', testament: 'NT', chapters: 5, nameEn: '1 Thessalonians', localId: '1thessaloniciens' },
    { id: '2TH', name: '2 Thessaloniciens', nameLong: '2 Thessaloniciens', abbreviation: '2Th', testament: 'NT', chapters: 3, nameEn: '2 Thessalonians', localId: '2thessaloniciens' },
    { id: '1TI', name: '1 Timothée', nameLong: '1 Timothée', abbreviation: '1Ti', testament: 'NT', chapters: 6, nameEn: '1 Timothy', localId: '1timothee' },
    { id: '2TI', name: '2 Timothée', nameLong: '2 Timothée', abbreviation: '2Ti', testament: 'NT', chapters: 4, nameEn: '2 Timothy', localId: '2timothee' },
    { id: 'TIT', name: 'Tite', nameLong: 'Tite', abbreviation: 'Tit', testament: 'NT', chapters: 3, nameEn: 'Titus', localId: 'tite' },
    { id: 'PHM', name: 'Philémon', nameLong: 'Philémon', abbreviation: 'Phm', testament: 'NT', chapters: 1, nameEn: 'Philemon', localId: 'philemon' },
    { id: 'HEB', name: 'Hébreux', nameLong: 'Hébreux', abbreviation: 'Héb', testament: 'NT', chapters: 13, nameEn: 'Hebrews', localId: 'hebreux' },
    { id: 'JAS', name: 'Jacques', nameLong: 'Jacques', abbreviation: 'Jac', testament: 'NT', chapters: 5, nameEn: 'James', localId: 'jacques' },
    { id: '1PE', name: '1 Pierre', nameLong: '1 Pierre', abbreviation: '1Pi', testament: 'NT', chapters: 5, nameEn: '1 Peter', localId: '1pierre' },
    { id: '2PE', name: '2 Pierre', nameLong: '2 Pierre', abbreviation: '2Pi', testament: 'NT', chapters: 3, nameEn: '2 Peter', localId: '2pierre' },
    { id: '1JN', name: '1 Jean', nameLong: '1 Jean', abbreviation: '1Je', testament: 'NT', chapters: 5, nameEn: '1 John', localId: '1jean' },
    { id: '2JN', name: '2 Jean', nameLong: '2 Jean', abbreviation: '2Je', testament: 'NT', chapters: 1, nameEn: '2 John', localId: '2jean' },
    { id: '3JN', name: '3 Jean', nameLong: '3 Jean', abbreviation: '3Je', testament: 'NT', chapters: 1, nameEn: '3 John', localId: '3jean' },
    { id: 'JUD', name: 'Jude', nameLong: 'Jude', abbreviation: 'Jud', testament: 'NT', chapters: 1, nameEn: 'Jude', localId: 'jude' },
    { id: 'REV', name: 'Apocalypse', nameLong: 'Apocalypse', abbreviation: 'Apo', testament: 'NT', chapters: 22, nameEn: 'Revelation', localId: 'apocalypse' },
];

// Static fallback verses
const FALLBACK_VERSES: BibleVerse[] = [
    { text: "Au commencement, Dieu créa les cieux et la terre.", reference: "Genèse 1:1" },
    { text: "L'Éternel est mon berger: je ne manquerai de rien.", reference: "Psaumes 23:1" },
    { text: "Car Dieu a tant aimé le monde qu'il a donné son Fils unique, afin que quiconque croit en lui ne périsse point, mais qu'il ait la vie éternelle.", reference: "Jean 3:16" },
    { text: "Je puis tout par celui qui me fortifie.", reference: "Philippiens 4:13" },
];

// ============================================
// CACHE
// ============================================

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_DURATION_MS) {
        cache.delete(key);
        return null;
    }
    return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
    cache.set(key, { data, timestamp: Date.now() });
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getLocalId(standardId: string): string {
    return STANDARD_TO_LOCAL[standardId.toUpperCase()] || standardId.toLowerCase();
}

function getStandardId(localId: string): string {
    return LOCAL_TO_STANDARD[localId.toLowerCase()] || localId.toUpperCase();
}

function getBookByStandardId(standardId: string): BibleBook | undefined {
    return BIBLE_BOOKS.find(b => b.id === standardId.toUpperCase());
}

function convertLocalVerseToApiFormat(verse: LocalVerse, translation: string = 'lsg'): BibleVerse {
    const localBook = getLocalBookById(verse.book);
    const standardId = getStandardId(verse.book);
    const book = getBookByStandardId(standardId);
    return {
        reference: `${book?.name || localBook?.name || verse.book} ${verse.chapter}:${verse.verse}`,
        text: verse.text,
        book_id: standardId,
        book_name: book?.name || localBook?.name || verse.book,
        chapter: verse.chapter,
        verse: verse.verse
    };
}

// ============================================
// MAIN API SERVICE
// ============================================

export const bibleApi = {
    /**
     * Get all Bible books
     */
    getBooks(): BibleBook[] {
        return BIBLE_BOOKS;
    },

    /**
     * Get chapters count for a book
     */
    getChapters(bookId: string): number[] {
        const book = BIBLE_BOOKS.find(b => b.id === bookId.toUpperCase());
        if (!book) return [];
        return Array.from({ length: book.chapters }, (_, i) => i + 1);
    },

    /**
     * Get a full chapter - uses LOCAL data
     */
    async getChapter(bookId: string, chapterNum: number, translation: string = DEFAULT_TRANSLATION): Promise<BiblePassage | null> {
        const localId = getLocalId(bookId);
        const book = getBookByStandardId(bookId);

        if (!book) {
            console.error('Book not found:', bookId);
            return null;
        }

        try {
            const chapter = await loadChapter(localId, chapterNum);
            if (!chapter) {
                console.error('Chapter not found:', localId, chapterNum);
                return null;
            }

            const text = chapter.verses.map(v => `${v.verse}. ${v.text}`).join(' ');

            return {
                reference: `${book.name} ${chapterNum}`,
                text,
                translation_id: translation,
                translation_name: 'Louis Segond 1910',
                verses: chapter.verses.map(v => ({
                    reference: `${book.name} ${v.chapter}:${v.verse}`,
                    text: v.text,
                    book_id: bookId.toUpperCase(),
                    book_name: book.name,
                    chapter: v.chapter,
                    verse: v.verse
                }))
            };
        } catch (error) {
            console.error('Error loading chapter:', error);
            return null;
        }
    },

    /**
     * Alias for backward compatibility
     */
    async getChapterContent(bookId: string, chapterNum: number, translation: string = DEFAULT_TRANSLATION): Promise<BiblePassage | null> {
        return this.getChapter(bookId, chapterNum, translation);
    },

    /**
     * Get verse of the day
     */
    async getVerseOfTheDay(translation: string = DEFAULT_TRANSLATION): Promise<BibleVerse> {
        try {
            const verse = await getLocalVerseOfTheDay();
            if (verse) {
                return convertLocalVerseToApiFormat(verse);
            }
        } catch (e) {
            console.error('Error getting verse of day:', e);
        }
        return FALLBACK_VERSES[Math.floor(Date.now() / 86400000) % FALLBACK_VERSES.length];
    },

    /**
     * Get a random verse
     */
    async getRandomVerse(translation: string = DEFAULT_TRANSLATION): Promise<BibleVerse> {
        try {
            const verse = await getLocalRandomVerse();
            if (verse) {
                return convertLocalVerseToApiFormat(verse);
            }
        } catch (e) {
            console.error('Error getting random verse:', e);
        }
        return FALLBACK_VERSES[Math.floor(Math.random() * FALLBACK_VERSES.length)];
    },

    /**
     * Get multiple random verses
     */
    async getMultipleRandomVerses(count: number, translation: string = DEFAULT_TRANSLATION): Promise<BibleVerse[]> {
        try {
            const verses = await getLocalRandomVerses(count);
            return verses.map(v => convertLocalVerseToApiFormat(v));
        } catch (e) {
            console.error('Error getting random verses:', e);
            return [];
        }
    },

    /**
     * Search Bible
     */
    async searchBible(query: string, translation: string = DEFAULT_TRANSLATION, maxResults: number = 50): Promise<BibleVerse[]> {
        try {
            const results = await localSearchBible(query, maxResults);
            return results.map(v => convertLocalVerseToApiFormat(v));
        } catch (e) {
            console.error('Error searching bible:', e);
            return [];
        }
    },

    /**
     * Preload popular books
     */
    async preload(): Promise<void> {
        return preloadPopularBooks();
    },

    /**
     * Parse a Bible reference string like "Genèse 1:1-5", "Psaumes 23", "1 Corinthiens 13:4"
     * Returns { bookId, chapter, verseStart?, verseEnd? } or null if unparseable
     */
    parseReference(reference: string): { bookId: string; chapter: number; verseStart?: number; verseEnd?: number } | null {
        if (!reference) return null;

        try {
            // Normalize the reference
            const ref = reference.trim();

            // Try to match patterns like:
            // "Genèse 1:1-5", "Psaumes 23", "1 Corinthiens 13:4", "2 Rois 5:1-14"
            // Handle books starting with numbers (1 Samuel, 2 Chroniques, etc.)
            const match = ref.match(/^(\d?\s*\S+(?:\s+\S+)?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?/);

            if (!match) return null;

            const bookName = match[1].trim();
            const chapter = parseInt(match[2], 10);
            const verseStart = match[3] ? parseInt(match[3], 10) : undefined;
            const verseEnd = match[4] ? parseInt(match[4], 10) : undefined;

            // Find the book by name (try exact match first, then partial)
            const normalizedName = bookName.toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Remove accents

            let book = BIBLE_BOOKS.find(b => {
                const bName = b.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                const bLong = b.nameLong.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                return bName === normalizedName || bLong === normalizedName;
            });

            // Partial match fallback
            if (!book) {
                book = BIBLE_BOOKS.find(b => {
                    const bName = b.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    return bName.startsWith(normalizedName) || normalizedName.startsWith(bName);
                });
            }

            // Abbreviation fallback
            if (!book) {
                book = BIBLE_BOOKS.find(b =>
                    b.abbreviation.toLowerCase() === bookName.toLowerCase()
                );
            }

            if (!book) {
                console.warn(`[parseReference] Could not find book for: "${bookName}"`);
                return null;
            }

            return { bookId: book.id, chapter, verseStart, verseEnd };
        } catch (e) {
            console.error('[parseReference] Error parsing:', reference, e);
            return null;
        }
    }
};

export default bibleApi;
