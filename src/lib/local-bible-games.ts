/**
 * LOCAL BIBLE GAMES SERVICE
 * =========================
 * Generate unlimited Bible game content from local Bible data
 * Supports both French and English languages
 */

import {
    BIBLE_BOOKS,
    BibleVerse,
    formatReference,
    getBookById
} from './local-bible-data';
import {
    loadChapter,
    getRandomVerse,
    getRandomVerses,
    getRandomPopularVerse
} from './local-bible-service';

// Types
export type GameType = 'quiz' | 'fill-blank' | 'verse-order' | 'book-order' | 'word-search' | 'memory';
export type GameDifficulty = 'easy' | 'medium' | 'hard';
export type GameLanguage = 'fr' | 'en';

// Quiz Question
export interface QuizQuestion {
    id: string;
    question: string;
    options: string[];
    correctAnswer: number;
    reference: string;
    explanation?: string;
    difficulty: GameDifficulty;
}

// Fill in the Blank Question
export interface FillBlankQuestion {
    id: string;
    text: string;
    missingWord: string;
    options: string[];
    correctAnswer: number;
    reference: string;
}

// Verse Order Question
export interface VerseOrderQuestion {
    id: string;
    reference: string;
    words: string[];
    correctOrder: number[];
    originalText: string;
}

// Book Order Question
export interface BookOrderQuestion {
    id: string;
    books: { id: string; name: string }[];
    correctOrder: number[];
    testament: 'AT' | 'NT' | 'mixed';
}

// Memory Card
export interface MemoryCard {
    id: string;
    type: 'reference' | 'text';
    content: string;
    pairId: string;
}

// Word Search Grid
export interface WordSearchGame {
    id: string;
    grid: string[][];
    words: string[];
    theme: string;
    foundWords: string[];
}

// ==========================================
// QUIZ QUESTIONS GENERATION
// ==========================================

export async function generateQuizQuestion(
    language: GameLanguage = 'fr',
    difficulty: GameDifficulty = 'medium'
): Promise<QuizQuestion | null> {
    try {
        const verse = await getRandomPopularVerse();
        if (!verse) return null;

        const book = getBookById(verse.book);
        if (!book) return null;

        const bookName = language === 'en' && book.nameEn ? book.nameEn : book.name;

        // Generate different question types based on difficulty
        const questionTypes = [
            () => generateBookQuestion(verse, bookName, language, difficulty),
            () => generateVerseContentQuestion(verse, bookName, language, difficulty),
            () => generateReferenceQuestion(verse, bookName, language, difficulty),
            () => generateTestamentQuestion(verse, book, language, difficulty),
        ];

        // Add more complex questions for higher difficulty
        if (difficulty !== 'easy') {
            questionTypes.push(() => generateChapterQuestion(verse, bookName, language, difficulty));
        }

        const questionGenerator = questionTypes[Math.floor(Math.random() * questionTypes.length)];
        return questionGenerator();
    } catch (error) {
        console.error('Error generating quiz question:', error);
        return null;
    }
}

// Question: Which book contains this verse?
function generateBookQuestion(
    verse: BibleVerse,
    bookName: string,
    language: GameLanguage,
    difficulty: GameDifficulty
): QuizQuestion {
    const maxLength = difficulty === 'easy' ? 80 : difficulty === 'medium' ? 120 : 150;
    const shortText = verse.text.length > maxLength
        ? verse.text.substring(0, maxLength) + '...'
        : verse.text;

    // Get wrong book names from same testament for harder difficulty
    const book = getBookById(verse.book);
    const testament = book?.testament;

    const wrongBooks = BIBLE_BOOKS
        .filter(b => b.id !== verse.book && (difficulty === 'hard' ? b.testament === testament : true))
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(b => language === 'en' && b.nameEn ? b.nameEn : b.name);

    const options = [bookName, ...wrongBooks].sort(() => Math.random() - 0.5);
    const correctAnswer = options.indexOf(bookName);

    const question = language === 'fr'
        ? `Dans quel livre trouve-t-on ce verset ?\n\n"${shortText}"`
        : `In which book is this verse found?\n\n"${shortText}"`;

    const explanation = language === 'fr'
        ? `Ce verset se trouve dans ${bookName} ${verse.chapter}:${verse.verse}`
        : `This verse is found in ${bookName} ${verse.chapter}:${verse.verse}`;

    return {
        id: `quiz-book-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        question,
        options,
        correctAnswer,
        reference: formatReference(verse.book, verse.chapter, verse.verse, language),
        explanation,
        difficulty
    };
}

// Question: What does this verse say? (Complete the verse)
function generateVerseContentQuestion(
    verse: BibleVerse,
    bookName: string,
    language: GameLanguage,
    difficulty: GameDifficulty
): QuizQuestion {
    const words = verse.text.split(' ');
    if (words.length < 6) {
        return generateBookQuestion(verse, bookName, language, difficulty);
    }

    const wordCount = difficulty === 'easy' ? 3 : difficulty === 'medium' ? 4 : 5;
    const startIdx = Math.floor(Math.random() * Math.max(1, words.length - wordCount - 3));
    const portion = words.slice(startIdx, startIdx + wordCount).join(' ');
    const continuation = words.slice(startIdx + wordCount, startIdx + wordCount + 4).join(' ') || '...';

    const question = language === 'fr'
        ? `Complétez ce verset de ${bookName} ${verse.chapter}:${verse.verse} :\n\n"${portion}..."`
        : `Complete this verse from ${bookName} ${verse.chapter}:${verse.verse}:\n\n"${portion}..."`;

    const wrongOptions = [
        generateRandomPhrase(language),
        generateRandomPhrase(language),
        generateRandomPhrase(language)
    ];

    const options = [continuation, ...wrongOptions].sort(() => Math.random() - 0.5);
    const correctAnswer = options.indexOf(continuation);

    return {
        id: `quiz-content-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        question,
        options,
        correctAnswer,
        reference: formatReference(verse.book, verse.chapter, verse.verse, language),
        difficulty
    };
}

// Question: Find the correct reference
function generateReferenceQuestion(
    verse: BibleVerse,
    bookName: string,
    language: GameLanguage,
    difficulty: GameDifficulty
): QuizQuestion {
    const maxLength = difficulty === 'easy' ? 100 : 150;
    const shortText = verse.text.length > maxLength
        ? verse.text.substring(0, maxLength) + '...'
        : verse.text;

    const correctRef = `${bookName} ${verse.chapter}:${verse.verse}`;

    // Generate plausible wrong references
    const wrongRefs = [
        `${bookName} ${verse.chapter + 1}:${verse.verse}`,
        `${bookName} ${verse.chapter}:${verse.verse + 2}`,
        `${bookName} ${Math.max(1, verse.chapter - 1)}:${verse.verse + 1}`
    ];

    const options = [correctRef, ...wrongRefs].sort(() => Math.random() - 0.5);
    const correctAnswer = options.indexOf(correctRef);

    const question = language === 'fr'
        ? `Quelle est la référence exacte de ce verset ?\n\n"${shortText}"`
        : `What is the exact reference of this verse?\n\n"${shortText}"`;

    return {
        id: `quiz-ref-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        question,
        options,
        correctAnswer,
        reference: correctRef,
        difficulty
    };
}

// Question: Which testament?
function generateTestamentQuestion(
    verse: BibleVerse,
    book: { testament: string; name: string; nameEn?: string },
    language: GameLanguage,
    difficulty: GameDifficulty
): QuizQuestion {
    const shortText = verse.text.length > 100 ? verse.text.substring(0, 100) + '...' : verse.text;
    const bookName = language === 'en' && book.nameEn ? book.nameEn : book.name;

    const correctAnswer = book.testament === 'AT' ? 0 : 1;
    const options = language === 'fr'
        ? ['Ancien Testament', 'Nouveau Testament']
        : ['Old Testament', 'New Testament'];

    const question = language === 'fr'
        ? `Le livre de ${bookName} appartient à quel testament ?\n\n(Extrait: "${shortText}")`
        : `The book of ${bookName} belongs to which testament?\n\n(Excerpt: "${shortText}")`;

    return {
        id: `quiz-testament-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        question,
        options,
        correctAnswer,
        reference: formatReference(verse.book, verse.chapter, verse.verse, language),
        difficulty
    };
}

// Question: Which chapter?
function generateChapterQuestion(
    verse: BibleVerse,
    bookName: string,
    language: GameLanguage,
    difficulty: GameDifficulty
): QuizQuestion {
    const book = getBookById(verse.book);
    const maxChapters = book?.chapters || 10;

    const shortText = verse.text.length > 80 ? verse.text.substring(0, 80) + '...' : verse.text;

    const wrongChapters: number[] = [];
    while (wrongChapters.length < 3) {
        const wrongChapter = Math.floor(Math.random() * maxChapters) + 1;
        if (wrongChapter !== verse.chapter && !wrongChapters.includes(wrongChapter)) {
            wrongChapters.push(wrongChapter);
        }
    }

    const options = [verse.chapter, ...wrongChapters]
        .sort(() => Math.random() - 0.5)
        .map(c => c.toString());
    const correctAnswer = options.indexOf(verse.chapter.toString());

    const question = language === 'fr'
        ? `Ce verset se trouve dans quel chapitre de ${bookName} ?\n\n"${shortText}"`
        : `This verse is found in which chapter of ${bookName}?\n\n"${shortText}"`;

    return {
        id: `quiz-chapter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        question,
        options,
        correctAnswer,
        reference: formatReference(verse.book, verse.chapter, verse.verse, language),
        difficulty
    };
}

// Helper: Generate random filler phrase
function generateRandomPhrase(language: GameLanguage): string {
    const frPhrases = [
        'et il leur dit ainsi',
        'car en vérité je vous le dis',
        'selon la volonté de Dieu',
        'dans le Seigneur notre Dieu',
        'avec puissance et gloire',
        'pour les siècles des siècles',
        'dans la lumière éternelle',
        'par la foi en Christ',
        'marchez dans la lumière',
        'le royaume des cieux',
        'la gloire de Dieu',
        'l\'amour du prochain'
    ];

    const enPhrases = [
        'and he said unto them',
        'for verily I say unto you',
        'according to God\'s will',
        'in the Lord our God',
        'with power and glory',
        'for ever and ever',
        'in the eternal light',
        'by faith in Christ',
        'walk in the light',
        'the kingdom of heaven',
        'the glory of God',
        'love your neighbor'
    ];

    const phrases = language === 'fr' ? frPhrases : enPhrases;
    return phrases[Math.floor(Math.random() * phrases.length)];
}

// ==========================================
// FILL IN THE BLANK QUESTIONS
// ==========================================

export async function generateFillBlankQuestion(
    language: GameLanguage = 'fr'
): Promise<FillBlankQuestion | null> {
    try {
        const verse = await getRandomPopularVerse();
        if (!verse) return null;

        const words = verse.text.split(' ').filter(w => w.length > 4);
        if (words.length < 3) return null;

        // Pick a random significant word to blank out
        const wordIndex = Math.floor(Math.random() * words.length);
        let missingWord = words[wordIndex].replace(/[.,;:!?'"()]/g, '');

        // Skip common words
        const commonWords = language === 'fr'
            ? ['dans', 'pour', 'avec', 'sans', 'mais', 'donc', 'comme', 'cette', 'celui']
            : ['that', 'this', 'with', 'from', 'them', 'they', 'have', 'been', 'which'];

        if (commonWords.includes(missingWord.toLowerCase())) {
            // Try another word
            const altIndex = (wordIndex + 1) % words.length;
            missingWord = words[altIndex].replace(/[.,;:!?'"()]/g, '');
        }

        // Create text with blank
        const textWithBlank = verse.text.replace(
            new RegExp(`\\b${missingWord}\\b`, 'i'),
            '______'
        );

        // Generate wrong options
        const wrongOptions = [
            generateRandomWord(language),
            generateRandomWord(language),
            generateRandomWord(language)
        ].filter(w => w.toLowerCase() !== missingWord.toLowerCase());

        // Ensure we have 3 wrong options
        while (wrongOptions.length < 3) {
            wrongOptions.push(generateRandomWord(language));
        }

        const options = [missingWord, ...wrongOptions.slice(0, 3)].sort(() => Math.random() - 0.5);
        const correctAnswer = options.indexOf(missingWord);

        const book = getBookById(verse.book);
        const bookName = language === 'en' && book?.nameEn ? book.nameEn : book?.name || verse.book;

        return {
            id: `fill-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            text: textWithBlank,
            missingWord,
            options,
            correctAnswer,
            reference: `${bookName} ${verse.chapter}:${verse.verse}`
        };
    } catch (error) {
        console.error('Error generating fill blank question:', error);
        return null;
    }
}

// Helper: Generate random biblical word
function generateRandomWord(language: GameLanguage): string {
    const frWords = [
        'Seigneur', 'cœur', 'peuple', 'Dieu', 'amour', 'gloire',
        'prière', 'esprit', 'parole', 'force', 'lumière', 'vérité',
        'grâce', 'paix', 'joie', 'foi', 'espérance', 'salut',
        'justice', 'miséricorde', 'sagesse', 'puissance', 'éternité',
        'bénédiction', 'alliance', 'promesse', 'royaume', 'temple'
    ];

    const enWords = [
        'Lord', 'heart', 'people', 'God', 'love', 'glory',
        'prayer', 'spirit', 'word', 'strength', 'light', 'truth',
        'grace', 'peace', 'joy', 'faith', 'hope', 'salvation',
        'righteousness', 'mercy', 'wisdom', 'power', 'eternity',
        'blessing', 'covenant', 'promise', 'kingdom', 'temple'
    ];

    const words = language === 'fr' ? frWords : enWords;
    return words[Math.floor(Math.random() * words.length)];
}

// ==========================================
// VERSE ORDER QUESTIONS
// ==========================================

export async function generateVerseOrderQuestion(
    difficulty: GameDifficulty = 'medium'
): Promise<VerseOrderQuestion | null> {
    try {
        const verse = await getRandomPopularVerse();
        if (!verse) return null;

        const wordCount = difficulty === 'easy' ? 5 : difficulty === 'medium' ? 7 : 10;
        const words = verse.text.split(' ').slice(0, wordCount);
        if (words.length < 4) return null;

        const originalText = words.join(' ');
        const correctOrder = words.map((_, i) => i);

        // Shuffle words
        const shuffledIndices = [...correctOrder].sort(() => Math.random() - 0.5);
        const shuffledWords = shuffledIndices.map(i => words[i]);

        const book = getBookById(verse.book);
        const bookName = book?.name || verse.book;

        return {
            id: `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            reference: `${bookName} ${verse.chapter}:${verse.verse}`,
            words: shuffledWords,
            correctOrder: shuffledIndices.map((_, index) => {
                return shuffledIndices.indexOf(correctOrder[index]);
            }),
            originalText
        };
    } catch (error) {
        console.error('Error generating verse order question:', error);
        return null;
    }
}

// ==========================================
// BOOK ORDER QUESTIONS
// ==========================================

export function generateBookOrderQuestion(
    difficulty: GameDifficulty = 'medium',
    language: GameLanguage = 'fr',
    testament?: 'AT' | 'NT'
): BookOrderQuestion {
    const count = difficulty === 'easy' ? 3 : difficulty === 'medium' ? 5 : 7;

    // Filter books by testament if specified
    const availableBooks = testament
        ? BIBLE_BOOKS.filter(b => b.testament === testament)
        : BIBLE_BOOKS;

    // Pick random consecutive books
    const maxStart = availableBooks.length - count;
    const startIdx = Math.floor(Math.random() * Math.max(1, maxStart));
    const selectedBooks = availableBooks.slice(startIdx, startIdx + count);

    const books = selectedBooks.map(b => ({
        id: b.id,
        name: language === 'en' && b.nameEn ? b.nameEn : b.name
    }));

    const shuffledBooks = [...books].sort(() => Math.random() - 0.5);
    const correctOrder = shuffledBooks.map(b => books.findIndex(orig => orig.id === b.id));

    return {
        id: `book-order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        books: shuffledBooks,
        correctOrder,
        testament: testament || 'mixed'
    };
}

// ==========================================
// MEMORY GAME
// ==========================================

export async function generateMemoryCards(
    pairCount: number = 6,
    language: GameLanguage = 'fr'
): Promise<MemoryCard[]> {
    const verses = await getRandomVerses(pairCount);
    const cards: MemoryCard[] = [];

    verses.forEach((verse, index) => {
        const book = getBookById(verse.book);
        const bookName = language === 'en' && book?.nameEn ? book.nameEn : book?.name || verse.book;
        const reference = `${bookName} ${verse.chapter}:${verse.verse}`;
        const pairId = `pair-${index}`;

        // Shorten text for memory cards
        const shortText = verse.text.length > 60
            ? verse.text.substring(0, 57) + '...'
            : verse.text;

        cards.push(
            { id: `card-ref-${index}`, type: 'reference', content: reference, pairId },
            { id: `card-text-${index}`, type: 'text', content: shortText, pairId }
        );
    });

    // Shuffle cards
    return cards.sort(() => Math.random() - 0.5);
}

// ==========================================
// WORD SEARCH
// ==========================================

export function generateWordSearchGame(
    theme: string = 'faith',
    language: GameLanguage = 'fr'
): WordSearchGame {
    const themes: Record<string, Record<GameLanguage, string[]>> = {
        faith: {
            fr: ['FOI', 'AMOUR', 'GRACE', 'PAIX', 'JOIE', 'ESPOIR', 'PRIERE', 'AMEN', 'DIEU', 'JESUS'],
            en: ['FAITH', 'LOVE', 'GRACE', 'PEACE', 'JOY', 'HOPE', 'PRAYER', 'AMEN', 'GOD', 'JESUS']
        },
        books: {
            fr: ['GENESE', 'EXODE', 'JEAN', 'MARC', 'LUC', 'ACTES', 'RUTH', 'PSAUMES'],
            en: ['GENESIS', 'EXODUS', 'JOHN', 'MARK', 'LUKE', 'ACTS', 'RUTH', 'PSALMS']
        },
        characters: {
            fr: ['JESUS', 'MOISE', 'DAVID', 'PAUL', 'PIERRE', 'MARIE', 'ABRAHAM', 'JACOB'],
            en: ['JESUS', 'MOSES', 'DAVID', 'PAUL', 'PETER', 'MARY', 'ABRAHAM', 'JACOB']
        },
        virtues: {
            fr: ['AMOUR', 'PAIX', 'PATIENCE', 'BONTE', 'SAGESSE', 'VERITE', 'JUSTICE', 'HUMILITE'],
            en: ['LOVE', 'PEACE', 'PATIENCE', 'KINDNESS', 'WISDOM', 'TRUTH', 'JUSTICE', 'HUMILITY']
        }
    };

    const words = themes[theme]?.[language] || themes.faith[language];
    const gridSize = 12;

    // Create grid filled with random letters
    const grid: string[][] = Array(gridSize).fill(null).map(() =>
        Array(gridSize).fill('').map(() => String.fromCharCode(65 + Math.floor(Math.random() * 26)))
    );

    // Place words in grid (horizontal, vertical, and diagonal)
    const directions = [
        [0, 1],  // horizontal
        [1, 0],  // vertical
        [1, 1],  // diagonal down-right
        [-1, 1], // diagonal up-right
    ];

    words.forEach(word => {
        let placed = false;
        let attempts = 0;

        while (!placed && attempts < 100) {
            attempts++;
            const dir = directions[Math.floor(Math.random() * directions.length)];
            const [dr, dc] = dir;

            // Calculate valid starting positions
            let row = Math.floor(Math.random() * gridSize);
            let col = Math.floor(Math.random() * gridSize);

            // Check if word fits
            const endRow = row + (word.length - 1) * dr;
            const endCol = col + (word.length - 1) * dc;

            if (endRow >= 0 && endRow < gridSize && endCol >= 0 && endCol < gridSize) {
                // Check if we can place the word
                let canPlace = true;
                for (let i = 0; i < word.length && canPlace; i++) {
                    const r = row + i * dr;
                    const c = col + i * dc;
                    if (grid[r][c] !== word[i] && grid[r][c] !== String.fromCharCode(65 + Math.floor(Math.random() * 26))) {
                        // Allow placing anyway for simplicity
                    }
                }

                if (canPlace) {
                    for (let i = 0; i < word.length; i++) {
                        const r = row + i * dr;
                        const c = col + i * dc;
                        grid[r][c] = word[i];
                    }
                    placed = true;
                }
            }
        }
    });

    return {
        id: `wordsearch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        grid,
        words,
        theme,
        foundWords: []
    };
}

// ==========================================
// BATCH GENERATION
// ==========================================

export async function generateQuizQuestions(
    count: number,
    language: GameLanguage = 'fr',
    difficulty: GameDifficulty = 'medium'
): Promise<QuizQuestion[]> {
    const questions: QuizQuestion[] = [];
    const maxAttempts = count * 3;

    for (let i = 0; i < maxAttempts && questions.length < count; i++) {
        const question = await generateQuizQuestion(language, difficulty);
        if (question) {
            // Avoid duplicate questions
            if (!questions.some(q => q.reference === question.reference)) {
                questions.push(question);
            }
        }
    }

    return questions;
}

export async function generateMixedGameQuestions(
    count: number,
    language: GameLanguage = 'fr'
): Promise<(QuizQuestion | FillBlankQuestion)[]> {
    const questions: (QuizQuestion | FillBlankQuestion)[] = [];

    for (let i = 0; i < count; i++) {
        if (Math.random() > 0.5) {
            const q = await generateQuizQuestion(language);
            if (q) questions.push(q);
        } else {
            const q = await generateFillBlankQuestion(language);
            if (q) questions.push(q);
        }
    }

    return questions;
}
