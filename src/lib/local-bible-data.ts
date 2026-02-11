/**
 * LOCAL BIBLE DATA
 * ================
 * Complete Bible data structure for French and English translations
 * Uses local .txt files stored in public/bible/
 */

export interface BibleBook {
    id: string;
    name: string;
    shortName: string;
    chapters: number;
    testament: 'AT' | 'NT';
    nameEn?: string; // English name for bilingual support
}

export interface BibleVerse {
    book: string;
    bookName: string;
    chapter: number;
    verse: number;
    text: string;
}

export interface BibleChapter {
    book: string;
    bookName: string;
    chapter: number;
    verses: BibleVerse[];
}

// Complete list of Bible books with French and English names
export const BIBLE_BOOKS: BibleBook[] = [
    // Ancien Testament (39 books)
    { id: 'genese', name: 'Genèse', shortName: 'Gen', chapters: 50, testament: 'AT', nameEn: 'Genesis' },
    { id: 'exode', name: 'Exode', shortName: 'Exo', chapters: 40, testament: 'AT', nameEn: 'Exodus' },
    { id: 'levitique', name: 'Lévitique', shortName: 'Lev', chapters: 27, testament: 'AT', nameEn: 'Leviticus' },
    { id: 'nombres', name: 'Nombres', shortName: 'Nom', chapters: 36, testament: 'AT', nameEn: 'Numbers' },
    { id: 'deuteronome', name: 'Deutéronome', shortName: 'Deu', chapters: 34, testament: 'AT', nameEn: 'Deuteronomy' },
    { id: 'josue', name: 'Josué', shortName: 'Jos', chapters: 24, testament: 'AT', nameEn: 'Joshua' },
    { id: 'juges', name: 'Juges', shortName: 'Jug', chapters: 21, testament: 'AT', nameEn: 'Judges' },
    { id: 'ruth', name: 'Ruth', shortName: 'Rut', chapters: 4, testament: 'AT', nameEn: 'Ruth' },
    { id: '1samuel', name: '1 Samuel', shortName: '1Sa', chapters: 31, testament: 'AT', nameEn: '1 Samuel' },
    { id: '2samuel', name: '2 Samuel', shortName: '2Sa', chapters: 24, testament: 'AT', nameEn: '2 Samuel' },
    { id: '1rois', name: '1 Rois', shortName: '1Ro', chapters: 22, testament: 'AT', nameEn: '1 Kings' },
    { id: '2rois', name: '2 Rois', shortName: '2Ro', chapters: 25, testament: 'AT', nameEn: '2 Kings' },
    { id: '1chroniques', name: '1 Chroniques', shortName: '1Ch', chapters: 29, testament: 'AT', nameEn: '1 Chronicles' },
    { id: '2chroniques', name: '2 Chroniques', shortName: '2Ch', chapters: 36, testament: 'AT', nameEn: '2 Chronicles' },
    { id: 'esdras', name: 'Esdras', shortName: 'Esd', chapters: 10, testament: 'AT', nameEn: 'Ezra' },
    { id: 'nehemie', name: 'Néhémie', shortName: 'Neh', chapters: 13, testament: 'AT', nameEn: 'Nehemiah' },
    { id: 'esther', name: 'Esther', shortName: 'Est', chapters: 10, testament: 'AT', nameEn: 'Esther' },
    { id: 'job', name: 'Job', shortName: 'Job', chapters: 42, testament: 'AT', nameEn: 'Job' },
    { id: 'psaumes', name: 'Psaumes', shortName: 'Psa', chapters: 150, testament: 'AT', nameEn: 'Psalms' },
    { id: 'proverbes', name: 'Proverbes', shortName: 'Pro', chapters: 31, testament: 'AT', nameEn: 'Proverbs' },
    { id: 'ecclesiaste', name: 'Ecclésiaste', shortName: 'Ecc', chapters: 12, testament: 'AT', nameEn: 'Ecclesiastes' },
    { id: 'cantique', name: 'Cantique', shortName: 'Can', chapters: 8, testament: 'AT', nameEn: 'Song of Solomon' },
    { id: 'esaie', name: 'Ésaïe', shortName: 'Esa', chapters: 66, testament: 'AT', nameEn: 'Isaiah' },
    { id: 'jeremie', name: 'Jérémie', shortName: 'Jer', chapters: 52, testament: 'AT', nameEn: 'Jeremiah' },
    { id: 'lamentations', name: 'Lamentations', shortName: 'Lam', chapters: 5, testament: 'AT', nameEn: 'Lamentations' },
    { id: 'ezechiel', name: 'Ézéchiel', shortName: 'Eze', chapters: 48, testament: 'AT', nameEn: 'Ezekiel' },
    { id: 'daniel', name: 'Daniel', shortName: 'Dan', chapters: 12, testament: 'AT', nameEn: 'Daniel' },
    { id: 'osee', name: 'Osée', shortName: 'Ose', chapters: 14, testament: 'AT', nameEn: 'Hosea' },
    { id: 'joel', name: 'Joël', shortName: 'Joe', chapters: 3, testament: 'AT', nameEn: 'Joel' },
    { id: 'amos', name: 'Amos', shortName: 'Amo', chapters: 9, testament: 'AT', nameEn: 'Amos' },
    { id: 'abdias', name: 'Abdias', shortName: 'Abd', chapters: 1, testament: 'AT', nameEn: 'Obadiah' },
    { id: 'jonas', name: 'Jonas', shortName: 'Jon', chapters: 4, testament: 'AT', nameEn: 'Jonah' },
    { id: 'michee', name: 'Michée', shortName: 'Mic', chapters: 7, testament: 'AT', nameEn: 'Micah' },
    { id: 'nahum', name: 'Nahum', shortName: 'Nah', chapters: 3, testament: 'AT', nameEn: 'Nahum' },
    { id: 'habacuc', name: 'Habacuc', shortName: 'Hab', chapters: 3, testament: 'AT', nameEn: 'Habakkuk' },
    { id: 'sophonie', name: 'Sophonie', shortName: 'Sop', chapters: 3, testament: 'AT', nameEn: 'Zephaniah' },
    { id: 'aggee', name: 'Aggée', shortName: 'Agg', chapters: 2, testament: 'AT', nameEn: 'Haggai' },
    { id: 'zacharie', name: 'Zacharie', shortName: 'Zac', chapters: 14, testament: 'AT', nameEn: 'Zechariah' },
    { id: 'malachie', name: 'Malachie', shortName: 'Mal', chapters: 4, testament: 'AT', nameEn: 'Malachi' },

    // Nouveau Testament (27 books)
    { id: 'matthieu', name: 'Matthieu', shortName: 'Mat', chapters: 28, testament: 'NT', nameEn: 'Matthew' },
    { id: 'marc', name: 'Marc', shortName: 'Mar', chapters: 16, testament: 'NT', nameEn: 'Mark' },
    { id: 'luc', name: 'Luc', shortName: 'Luc', chapters: 24, testament: 'NT', nameEn: 'Luke' },
    { id: 'jean', name: 'Jean', shortName: 'Jea', chapters: 21, testament: 'NT', nameEn: 'John' },
    { id: 'actes', name: 'Actes', shortName: 'Act', chapters: 28, testament: 'NT', nameEn: 'Acts' },
    { id: 'romains', name: 'Romains', shortName: 'Rom', chapters: 16, testament: 'NT', nameEn: 'Romans' },
    { id: '1corinthiens', name: '1 Corinthiens', shortName: '1Co', chapters: 16, testament: 'NT', nameEn: '1 Corinthians' },
    { id: '2corinthiens', name: '2 Corinthiens', shortName: '2Co', chapters: 13, testament: 'NT', nameEn: '2 Corinthians' },
    { id: 'galates', name: 'Galates', shortName: 'Gal', chapters: 6, testament: 'NT', nameEn: 'Galatians' },
    { id: 'ephesiens', name: 'Éphésiens', shortName: 'Eph', chapters: 6, testament: 'NT', nameEn: 'Ephesians' },
    { id: 'philippiens', name: 'Philippiens', shortName: 'Phi', chapters: 4, testament: 'NT', nameEn: 'Philippians' },
    { id: 'colossiens', name: 'Colossiens', shortName: 'Col', chapters: 4, testament: 'NT', nameEn: 'Colossians' },
    { id: '1thessaloniciens', name: '1 Thessaloniciens', shortName: '1Th', chapters: 5, testament: 'NT', nameEn: '1 Thessalonians' },
    { id: '2thessaloniciens', name: '2 Thessaloniciens', shortName: '2Th', chapters: 3, testament: 'NT', nameEn: '2 Thessalonians' },
    { id: '1timothee', name: '1 Timothée', shortName: '1Ti', chapters: 6, testament: 'NT', nameEn: '1 Timothy' },
    { id: '2timothee', name: '2 Timothée', shortName: '2Ti', chapters: 4, testament: 'NT', nameEn: '2 Timothy' },
    { id: 'tite', name: 'Tite', shortName: 'Tit', chapters: 3, testament: 'NT', nameEn: 'Titus' },
    { id: 'philemon', name: 'Philémon', shortName: 'Phm', chapters: 1, testament: 'NT', nameEn: 'Philemon' },
    { id: 'hebreux', name: 'Hébreux', shortName: 'Heb', chapters: 13, testament: 'NT', nameEn: 'Hebrews' },
    { id: 'jacques', name: 'Jacques', shortName: 'Jac', chapters: 5, testament: 'NT', nameEn: 'James' },
    { id: '1pierre', name: '1 Pierre', shortName: '1Pi', chapters: 5, testament: 'NT', nameEn: '1 Peter' },
    { id: '2pierre', name: '2 Pierre', shortName: '2Pi', chapters: 3, testament: 'NT', nameEn: '2 Peter' },
    { id: '1jean', name: '1 Jean', shortName: '1Jn', chapters: 5, testament: 'NT', nameEn: '1 John' },
    { id: '2jean', name: '2 Jean', shortName: '2Jn', chapters: 1, testament: 'NT', nameEn: '2 John' },
    { id: '3jean', name: '3 Jean', shortName: '3Jn', chapters: 1, testament: 'NT', nameEn: '3 John' },
    { id: 'jude', name: 'Jude', shortName: 'Jud', chapters: 1, testament: 'NT', nameEn: 'Jude' },
    { id: 'apocalypse', name: 'Apocalypse', shortName: 'Apo', chapters: 22, testament: 'NT', nameEn: 'Revelation' },
];

export const OLD_TESTAMENT_BOOKS = BIBLE_BOOKS.filter(b => b.testament === 'AT');
export const NEW_TESTAMENT_BOOKS = BIBLE_BOOKS.filter(b => b.testament === 'NT');

// Parse verse text from file line format: "1  verse text here"
export function parseVerseLine(line: string): { verse: number; text: string } | null {
    const match = line.match(/^(\d+)\s+(.+)$/);
    if (match) {
        return {
            verse: parseInt(match[1], 10),
            text: match[2].trim()
        };
    }
    return null;
}

// Format reference for display
export function formatReference(bookId: string, chapter: number, verse?: number, language: 'fr' | 'en' = 'fr'): string {
    const bookInfo = BIBLE_BOOKS.find(b => b.id === bookId);
    const bookName = language === 'en' && bookInfo?.nameEn ? bookInfo.nameEn : (bookInfo?.name || bookId);
    if (verse) {
        return `${bookName} ${chapter}:${verse}`;
    }
    return `${bookName} ${chapter}`;
}

// Get book by ID
export function getBookById(id: string): BibleBook | undefined {
    return BIBLE_BOOKS.find(b => b.id === id.toLowerCase());
}

// Get book by name (French or English)
export function getBookByName(name: string): BibleBook | undefined {
    const normalizedName = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return BIBLE_BOOKS.find(b =>
        b.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === normalizedName ||
        b.nameEn?.toLowerCase() === normalizedName ||
        b.shortName.toLowerCase() === normalizedName
    );
}

// Get total chapters for a book
export function getChapterCount(bookId: string): number {
    const book = getBookById(bookId);
    return book?.chapters || 0;
}

// Get total verse count (approximate - for display purposes)
export function getTotalVerseCount(): number {
    return 31102; // Total verses in the Bible
}
