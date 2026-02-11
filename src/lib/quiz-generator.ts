/**
 * DYNAMIC BIBLE QUIZ GENERATOR
 * ==============================
 * 
 * Generates unlimited quiz questions using LOCAL Bible data.
 * No external API calls - fully offline capable.
 * 
 * Creates different types of questions:
 * - Fill in the blank (verse completion)
 * - Who said it? (character attribution)
 * - Where in the Bible? (book location)
 * - True/False (verse accuracy)
 * - Multiple choice
 */

import {
    BIBLE_BOOKS,
    getBookById,
    formatReference,
    BibleVerse
} from './local-bible-data';
import {
    getRandomPopularVerse,
    getRandomVerses,
    loadVerse
} from './local-bible-service';
import type { GameLanguage } from './bible-store';

// Types
export interface QuizQuestion {
    id: string;
    type: 'fill_blank' | 'who_said' | 'where' | 'true_false' | 'multiple_choice';
    question: string;
    options: string[];
    correctIndex: number;
    reference: string;
    difficulty: 'easy' | 'medium' | 'hard';
    explanation?: string;
}

// Static knowledge base for character questions
const BIBLE_CHARACTERS = [
    { name: 'Jésus', nameEn: 'Jesus', aliases: ['Jésus-Christ', 'Christ', 'le Seigneur'] },
    { name: 'Moïse', nameEn: 'Moses', aliases: ['Moïse'] },
    { name: 'David', nameEn: 'David', aliases: ['le roi David', 'David'] },
    { name: 'Paul', nameEn: 'Paul', aliases: ['Paul', 'l\'apôtre Paul', 'Saul'] },
    { name: 'Pierre', nameEn: 'Peter', aliases: ['Pierre', 'Simon Pierre'] },
    { name: 'Abraham', nameEn: 'Abraham', aliases: ['Abraham', 'Abram'] },
    { name: 'Salomon', nameEn: 'Solomon', aliases: ['le roi Salomon', 'Salomon'] },
    { name: 'Élie', nameEn: 'Elijah', aliases: ['Élie', 'le prophète Élie'] },
    { name: 'Jean-Baptiste', nameEn: 'John the Baptist', aliases: ['Jean-Baptiste', 'Jean le Baptiste'] },
    { name: 'Marie', nameEn: 'Mary', aliases: ['Marie', 'la Vierge Marie'] },
];

// Static questions - always available, no API needed
const STATIC_QUESTIONS_FR: QuizQuestion[] = [
    {
        id: 'static_1',
        type: 'multiple_choice',
        question: "Qui a construit l'arche selon la Genèse ?",
        options: ["Abraham", "Noé", "Moïse", "David"],
        correctIndex: 1,
        reference: "Genèse 6-9",
        difficulty: 'easy'
    },
    {
        id: 'static_2',
        type: 'multiple_choice',
        question: "Combien de jours a duré la création selon la Genèse ?",
        options: ["3 jours", "5 jours", "6 jours", "7 jours"],
        correctIndex: 2,
        reference: "Genèse 1",
        difficulty: 'easy',
        explanation: "Dieu a créé en 6 jours et s'est reposé le 7ème jour."
    },
    {
        id: 'static_3',
        type: 'multiple_choice',
        question: "Quel disciple a renié Jésus trois fois ?",
        options: ["Jean", "Jacques", "Pierre", "Judas"],
        correctIndex: 2,
        reference: "Matthieu 26:69-75",
        difficulty: 'easy'
    },
    {
        id: 'static_4',
        type: 'multiple_choice',
        question: "Quel est le premier livre de la Bible ?",
        options: ["Exode", "Genèse", "Matthieu", "Psaumes"],
        correctIndex: 1,
        reference: "Bible",
        difficulty: 'easy'
    },
    {
        id: 'static_5',
        type: 'multiple_choice',
        question: "Qui a vaincu Goliath avec une fronde ?",
        options: ["Saül", "David", "Jonathan", "Samson"],
        correctIndex: 1,
        reference: "1 Samuel 17",
        difficulty: 'easy'
    },
    {
        id: 'static_6',
        type: 'multiple_choice',
        question: "Où Jésus est-il né ?",
        options: ["Nazareth", "Jérusalem", "Bethléem", "Capharnaüm"],
        correctIndex: 2,
        reference: "Matthieu 2:1",
        difficulty: 'easy'
    },
    {
        id: 'static_7',
        type: 'multiple_choice',
        question: "Qui a ouvert la Mer Rouge ?",
        options: ["Moïse", "Josué", "Aaron", "Élie"],
        correctIndex: 0,
        reference: "Exode 14",
        difficulty: 'easy'
    },
    {
        id: 'static_8',
        type: 'multiple_choice',
        question: "Combien d'apôtres Jésus avait-il ?",
        options: ["10", "12", "7", "70"],
        correctIndex: 1,
        reference: "Matthieu 10:1-4",
        difficulty: 'easy'
    },
    {
        id: 'static_9',
        type: 'multiple_choice',
        question: "Quel prophète a été avalé par un grand poisson ?",
        options: ["Daniel", "Jonas", "Job", "Élie"],
        correctIndex: 1,
        reference: "Jonas 1:17",
        difficulty: 'easy'
    },
    {
        id: 'static_10',
        type: 'multiple_choice',
        question: "Quel est le dernier livre de la Bible ?",
        options: ["Apocalypse", "Jude", "Actes", "Malachie"],
        correctIndex: 0,
        reference: "Bible",
        difficulty: 'easy'
    },
    // Medium difficulty
    {
        id: 'static_11',
        type: 'multiple_choice',
        question: "Quel roi a demandé la sagesse à Dieu ?",
        options: ["David", "Salomon", "Saül", "Ézéchias"],
        correctIndex: 1,
        reference: "1 Rois 3:5-14",
        difficulty: 'medium'
    },
    {
        id: 'static_12',
        type: 'multiple_choice',
        question: "Combien de plaies Dieu a-t-il envoyées sur l'Égypte ?",
        options: ["7", "10", "12", "40"],
        correctIndex: 1,
        reference: "Exode 7-12",
        difficulty: 'medium'
    },
    {
        id: 'static_13',
        type: 'multiple_choice',
        question: "Qui a été jeté dans la fosse aux lions ?",
        options: ["Joseph", "Daniel", "Samson", "Jonas"],
        correctIndex: 1,
        reference: "Daniel 6",
        difficulty: 'medium'
    },
    {
        id: 'static_14',
        type: 'multiple_choice',
        question: "Quelle femme est devenue reine de Perse et a sauvé son peuple ?",
        options: ["Ruth", "Esther", "Rebecca", "Sarah"],
        correctIndex: 1,
        reference: "Livre d'Esther",
        difficulty: 'medium'
    },
    {
        id: 'static_15',
        type: 'multiple_choice',
        question: "Combien de temps Jésus a-t-il jeûné dans le désert ?",
        options: ["7 jours", "21 jours", "40 jours", "3 jours"],
        correctIndex: 2,
        reference: "Matthieu 4:2",
        difficulty: 'medium'
    },
    {
        id: 'static_16',
        type: 'multiple_choice',
        question: "Quel fruit était sur l'arbre de la connaissance du bien et du mal ?",
        options: ["Pomme", "Raisin", "Figue", "Non spécifié"],
        correctIndex: 3,
        reference: "Genèse 2-3",
        difficulty: 'medium',
        explanation: "La Bible ne précise pas le type de fruit."
    },
    {
        id: 'static_17',
        type: 'multiple_choice',
        question: "Qui a trahi Jésus pour 30 pièces d'argent ?",
        options: ["Pierre", "Thomas", "Judas Iscariote", "Matthieu"],
        correctIndex: 2,
        reference: "Matthieu 26:14-16",
        difficulty: 'medium'
    },
    // Hard difficulty
    {
        id: 'static_18',
        type: 'multiple_choice',
        question: "Quel apôtre a écrit le plus de livres du Nouveau Testament ?",
        options: ["Pierre", "Jean", "Paul", "Luc"],
        correctIndex: 2,
        reference: "Nouveau Testament",
        difficulty: 'hard'
    },
    {
        id: 'static_19',
        type: 'multiple_choice',
        question: "Quel est le verset le plus court de la Bible ?",
        options: ["Jean 11:35", "1 Thessaloniciens 5:16", "Exode 20:13", "Genèse 1:1"],
        correctIndex: 0,
        reference: "Jean 11:35 - 'Jésus pleura.'",
        difficulty: 'hard',
        explanation: "'Jésus pleura' (Jean 11:35) est le plus court verset."
    },
    {
        id: 'static_20',
        type: 'multiple_choice',
        question: "Quel est le premier des Dix Commandements ?",
        options: ["Tu ne tueras point", "Honore ton père et ta mère", "Tu n'auras pas d'autres dieux devant ma face", "Tu ne voleras point"],
        correctIndex: 2,
        reference: "Exode 20:3",
        difficulty: 'hard'
    },
    {
        id: 'static_21',
        type: 'multiple_choice',
        question: "Quel livre de la Bible ne mentionne pas le nom de Dieu ?",
        options: ["Ruth", "Esther", "Cantique des Cantiques", "Proverbes"],
        correctIndex: 1,
        reference: "Livre d'Esther",
        difficulty: 'hard'
    },
    {
        id: 'static_22',
        type: 'multiple_choice',
        question: "Qui est le plus vieil homme mentionné dans la Bible ?",
        options: ["Adam", "Noé", "Mathusalem", "Énoch"],
        correctIndex: 2,
        reference: "Genèse 5:27",
        difficulty: 'hard',
        explanation: "Mathusalem a vécu 969 ans selon la Genèse."
    },
    {
        id: 'static_23',
        type: 'multiple_choice',
        question: "Combien de livres y a-t-il dans la Bible protestante ?",
        options: ["66", "73", "81", "39"],
        correctIndex: 0,
        reference: "Bible",
        difficulty: 'hard'
    },
    {
        id: 'static_24',
        type: 'multiple_choice',
        question: "Quel prophète a été enlevé au ciel dans un char de feu ?",
        options: ["Moïse", "Élie", "Énoch", "Élisée"],
        correctIndex: 1,
        reference: "2 Rois 2:11",
        difficulty: 'hard'
    }
];

// English static questions
const STATIC_QUESTIONS_EN: QuizQuestion[] = [
    {
        id: 'static_en_1',
        type: 'multiple_choice',
        question: "Who built the ark according to Genesis?",
        options: ["Abraham", "Noah", "Moses", "David"],
        correctIndex: 1,
        reference: "Genesis 6-9",
        difficulty: 'easy'
    },
    {
        id: 'static_en_2',
        type: 'multiple_choice',
        question: "How many days did creation last according to Genesis?",
        options: ["3 days", "5 days", "6 days", "7 days"],
        correctIndex: 2,
        reference: "Genesis 1",
        difficulty: 'easy',
        explanation: "God created in 6 days and rested on the 7th day."
    },
    {
        id: 'static_en_3',
        type: 'multiple_choice',
        question: "Which disciple denied Jesus three times?",
        options: ["John", "James", "Peter", "Judas"],
        correctIndex: 2,
        reference: "Matthew 26:69-75",
        difficulty: 'easy'
    },
    {
        id: 'static_en_4',
        type: 'multiple_choice',
        question: "What is the first book of the Bible?",
        options: ["Exodus", "Genesis", "Matthew", "Psalms"],
        correctIndex: 1,
        reference: "Bible",
        difficulty: 'easy'
    },
    {
        id: 'static_en_5',
        type: 'multiple_choice',
        question: "Who defeated Goliath with a sling?",
        options: ["Saul", "David", "Jonathan", "Samson"],
        correctIndex: 1,
        reference: "1 Samuel 17",
        difficulty: 'easy'
    },
    {
        id: 'static_en_6',
        type: 'multiple_choice',
        question: "Where was Jesus born?",
        options: ["Nazareth", "Jerusalem", "Bethlehem", "Capernaum"],
        correctIndex: 2,
        reference: "Matthew 2:1",
        difficulty: 'easy'
    },
    {
        id: 'static_en_7',
        type: 'multiple_choice',
        question: "Who parted the Red Sea?",
        options: ["Moses", "Joshua", "Aaron", "Elijah"],
        correctIndex: 0,
        reference: "Exodus 14",
        difficulty: 'easy'
    },
    {
        id: 'static_en_8',
        type: 'multiple_choice',
        question: "How many apostles did Jesus have?",
        options: ["10", "12", "7", "70"],
        correctIndex: 1,
        reference: "Matthew 10:1-4",
        difficulty: 'easy'
    },
    // Medium
    {
        id: 'static_en_9',
        type: 'multiple_choice',
        question: "Which king asked God for wisdom?",
        options: ["David", "Solomon", "Saul", "Hezekiah"],
        correctIndex: 1,
        reference: "1 Kings 3:5-14",
        difficulty: 'medium'
    },
    {
        id: 'static_en_10',
        type: 'multiple_choice',
        question: "How many plagues did God send on Egypt?",
        options: ["7", "10", "12", "40"],
        correctIndex: 1,
        reference: "Exodus 7-12",
        difficulty: 'medium'
    },
    // Hard
    {
        id: 'static_en_11',
        type: 'multiple_choice',
        question: "Which apostle wrote the most books in the New Testament?",
        options: ["Peter", "John", "Paul", "Luke"],
        correctIndex: 2,
        reference: "New Testament",
        difficulty: 'hard'
    },
    {
        id: 'static_en_12',
        type: 'multiple_choice',
        question: "What is the shortest verse in the Bible?",
        options: ["John 11:35", "1 Thessalonians 5:16", "Exodus 20:13", "Genesis 1:1"],
        correctIndex: 0,
        reference: "John 11:35 - 'Jesus wept.'",
        difficulty: 'hard'
    }
];

/**
 * Generate a fill-in-the-blank question from a verse
 */
async function generateFillBlankQuestion(
    verse: BibleVerse,
    difficulty: 'easy' | 'medium' | 'hard',
    language: GameLanguage = 'fr'
): Promise<QuizQuestion | null> {
    if (!verse.text || verse.text.length < 30) return null;

    const words = verse.text.split(' ').filter(w => w.length > 3);
    if (words.length < 4) return null;

    // Pick a word to blank out (based on difficulty)
    const blankIndex = difficulty === 'easy'
        ? Math.floor(words.length * 0.7) // Later in verse (easier context)
        : difficulty === 'medium'
            ? Math.floor(words.length / 2) // Middle
            : Math.floor(words.length * 0.3); // Earlier (harder)

    const correctWord = words[blankIndex].replace(/[.,;:!?"']/g, '');
    if (correctWord.length < 4) return null;

    const blankedText = verse.text.replace(correctWord, '________');

    // Generate distractors (random biblical words)
    const distractorsFr = [
        'amour', 'paix', 'lumière', 'vérité', 'esprit', 'cœur', 'âme', 'grâce',
        'foi', 'espérance', 'joie', 'salut', 'gloire', 'vie', 'terre', 'ciel'
    ];
    const distractorsEn = [
        'love', 'peace', 'light', 'truth', 'spirit', 'heart', 'soul', 'grace',
        'faith', 'hope', 'joy', 'salvation', 'glory', 'life', 'earth', 'heaven'
    ];

    const distractors = (language === 'en' ? distractorsEn : distractorsFr)
        .filter(w => w.toLowerCase() !== correctWord.toLowerCase())
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);

    const options = [...distractors, correctWord].sort(() => Math.random() - 0.5);
    const correctIndex = options.indexOf(correctWord);

    const book = getBookById(verse.book);
    const bookName = language === 'en' && book?.nameEn ? book.nameEn : book?.name || verse.book;

    const questionText = language === 'fr'
        ? `Complétez ce verset :\n"${blankedText}"`
        : `Complete this verse:\n"${blankedText}"`;

    return {
        id: `fill_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        type: 'fill_blank',
        question: questionText,
        options,
        correctIndex,
        reference: `${bookName} ${verse.chapter}:${verse.verse}`,
        difficulty
    };
}

/**
 * Generate a "Where in the Bible" question
 */
async function generateWhereQuestion(
    verse: BibleVerse,
    difficulty: 'easy' | 'medium' | 'hard',
    language: GameLanguage = 'fr'
): Promise<QuizQuestion | null> {
    if (!verse.text) return null;

    const book = getBookById(verse.book);
    if (!book) return null;

    const correctBookName = language === 'en' && book.nameEn ? book.nameEn : book.name;

    // Get distractor books from the same testament for harder questions
    const distractorPool = difficulty === 'easy'
        ? BIBLE_BOOKS.filter(b => b.testament !== book.testament)
        : BIBLE_BOOKS.filter(b => b.id !== book.id && b.testament === book.testament);

    const distractors = distractorPool
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(b => language === 'en' && b.nameEn ? b.nameEn : b.name);

    const options = [...distractors, correctBookName].sort(() => Math.random() - 0.5);
    const correctIndex = options.indexOf(correctBookName);

    const truncatedVerse = verse.text.length > 100
        ? verse.text.substring(0, 100) + '...'
        : verse.text;

    const questionText = language === 'fr'
        ? `Dans quel livre se trouve ce verset ?\n"${truncatedVerse}"`
        : `In which book is this verse found?\n"${truncatedVerse}"`;

    return {
        id: `where_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        type: 'where',
        question: questionText,
        options,
        correctIndex,
        reference: `${correctBookName} ${verse.chapter}:${verse.verse}`,
        difficulty
    };
}

/**
 * Main API for quiz generation
 */
export const quizGenerator = {
    /**
     * Get a set of questions for a quiz - uses LOCAL data only
     */
    async getQuestions(
        count: number = 10,
        difficulty: 'easy' | 'medium' | 'hard' = 'easy',
        language: GameLanguage = 'fr'
    ): Promise<QuizQuestion[]> {
        const questions: QuizQuestion[] = [];

        // Get static questions pool based on language
        const staticPool = language === 'en' ? STATIC_QUESTIONS_EN : STATIC_QUESTIONS_FR;
        const filteredStatic = staticPool.filter(q => q.difficulty === difficulty);
        const shuffledStatic = [...filteredStatic].sort(() => Math.random() - 0.5);

        // Generate dynamic questions from local Bible data
        try {
            const verses = await getRandomVerses(Math.ceil(count * 0.6));

            for (const verse of verses) {
                if (questions.length >= count) break;

                // Randomly choose question type
                const rand = Math.random();
                let question: QuizQuestion | null = null;

                if (rand < 0.5) {
                    question = await generateFillBlankQuestion(verse, difficulty, language);
                } else {
                    question = await generateWhereQuestion(verse, difficulty, language);
                }

                if (question) {
                    questions.push(question);
                }
            }
        } catch (error) {
            console.warn('Dynamic question generation failed, using static questions:', error);
        }

        // Fill remaining slots with static questions
        while (questions.length < count && shuffledStatic.length > 0) {
            const staticQ = shuffledStatic.shift();
            if (staticQ && !questions.find(q => q.id === staticQ.id)) {
                questions.push(staticQ);
            }
        }

        // If we still don't have enough, use any difficulty static questions
        if (questions.length < count) {
            const remainingStatic = staticPool
                .filter(q => !questions.find(existing => existing.id === q.id))
                .sort(() => Math.random() - 0.5);

            while (questions.length < count && remainingStatic.length > 0) {
                questions.push(remainingStatic.shift()!);
            }
        }

        return questions.sort(() => Math.random() - 0.5);
    },

    /**
     * Get static questions only (for offline/fast mode)
     */
    getStaticQuestions(
        count: number = 10,
        difficulty?: 'easy' | 'medium' | 'hard',
        language: GameLanguage = 'fr'
    ): QuizQuestion[] {
        const staticPool = language === 'en' ? STATIC_QUESTIONS_EN : STATIC_QUESTIONS_FR;
        let pool = [...staticPool];

        if (difficulty) {
            pool = pool.filter(q => q.difficulty === difficulty);
        }

        return pool.sort(() => Math.random() - 0.5).slice(0, count);
    },

    /**
     * Get all static questions for a specific difficulty
     */
    getQuestionsByDifficulty(
        difficulty: 'easy' | 'medium' | 'hard',
        language: GameLanguage = 'fr'
    ): QuizQuestion[] {
        const staticPool = language === 'en' ? STATIC_QUESTIONS_EN : STATIC_QUESTIONS_FR;
        return staticPool.filter(q => q.difficulty === difficulty);
    }
};

export default quizGenerator;
