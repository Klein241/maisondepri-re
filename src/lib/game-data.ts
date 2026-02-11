/**
 * GAME DATA SERVICE - Unlimited Bible Games
 * ==========================================
 * Provides static data for games to work without external Bible API dependencies.
 * Games can use this data when Bible is not available.
 */

// Extensive list of Bible questions for Quiz
export const BIBLE_QUESTIONS = [
    // Easy Questions
    { question: "Qui a créé le monde selon la Bible?", options: ["Dieu", "Moïse", "Abraham", "Jésus"], answer: 0, difficulty: "easy" },
    { question: "Combien de jours Dieu a-t-il utilisé pour créer le monde?", options: ["6", "7", "5", "3"], answer: 0, difficulty: "easy" },
    { question: "Quel est le premier livre de la Bible?", options: ["Genèse", "Exode", "Matthieu", "Apocalypse"], answer: 0, difficulty: "easy" },
    { question: "Qui a construit l'arche?", options: ["Noé", "Abraham", "Moïse", "David"], answer: 0, difficulty: "easy" },
    { question: "Combien d'apôtres Jésus avait-il?", options: ["12", "10", "7", "3"], answer: 0, difficulty: "easy" },
    { question: "Dans quelle ville Jésus est-il né?", options: ["Bethléem", "Jérusalem", "Nazareth", "Capernaüm"], answer: 0, difficulty: "easy" },
    { question: "Qui a trahi Jésus?", options: ["Judas", "Pierre", "Jean", "Thomas"], answer: 0, difficulty: "easy" },
    { question: "Combien de livres y a-t-il dans la Bible?", options: ["66", "72", "50", "100"], answer: 0, difficulty: "easy" },
    { question: "Qui était le premier homme?", options: ["Adam", "Noé", "Abraham", "Moïse"], answer: 0, difficulty: "easy" },
    { question: "Qui était la première femme?", options: ["Ève", "Marie", "Sarah", "Ruth"], answer: 0, difficulty: "easy" },
    { question: "Quelle mer Moïse a-t-il traversée?", options: ["Mer Rouge", "Mer Morte", "Mer Méditerranée", "Jourdain"], answer: 0, difficulty: "easy" },
    { question: "Qui a tué Goliath?", options: ["David", "Saül", "Jonathan", "Samuel"], answer: 0, difficulty: "easy" },
    { question: "Quel fruit était interdit dans le jardin d'Éden?", options: ["Fruit de l'arbre de la connaissance", "Pomme", "Raisin", "Figue"], answer: 0, difficulty: "easy" },
    { question: "Qui a été avalé par un grand poisson?", options: ["Jonas", "Élie", "Élisée", "Daniel"], answer: 0, difficulty: "easy" },
    { question: "Combien de plaies d'Égypte y a-t-il eu?", options: ["10", "7", "12", "5"], answer: 0, difficulty: "easy" },

    // Medium Questions
    { question: "Quel roi a bâti le premier temple de Jérusalem?", options: ["Salomon", "David", "Saül", "Roboam"], answer: 0, difficulty: "medium" },
    { question: "Combien de fils Jacob avait-il?", options: ["12", "10", "7", "13"], answer: 0, difficulty: "medium" },
    { question: "Qui était le père de Jean-Baptiste?", options: ["Zacharie", "Joseph", "Élisée", "Siméon"], answer: 0, difficulty: "medium" },
    { question: "Quelle est la plus longue épître de Paul?", options: ["Romains", "1 Corinthiens", "Hébreux", "Galates"], answer: 0, difficulty: "medium" },
    { question: "Combien de temps Jésus a-t-il jeûné dans le désert?", options: ["40 jours", "30 jours", "7 jours", "21 jours"], answer: 0, difficulty: "medium" },
    { question: "Qui a demandé la tête de Jean-Baptiste?", options: ["Hérodiade", "Salomé", "Hérode", "Pilate"], answer: 0, difficulty: "medium" },
    { question: "Quel prophète a été enlevé au ciel dans un char de feu?", options: ["Élie", "Énoch", "Élisée", "Moïse"], answer: 0, difficulty: "medium" },
    { question: "Qui a renié Jésus trois fois?", options: ["Pierre", "Judas", "Thomas", "Jacques"], answer: 0, difficulty: "medium" },
    { question: "Combien de personnes Jésus a-t-il nourries avec 5 pains et 2 poissons?", options: ["5000", "4000", "3000", "7000"], answer: 0, difficulty: "medium" },
    { question: "Quelle ville Josué a-t-il conquise en premier?", options: ["Jéricho", "Aï", "Hébron", "Sichem"], answer: 0, difficulty: "medium" },
    { question: "Qui était le frère de Moïse?", options: ["Aaron", "Lévi", "Myriam", "Josué"], answer: 0, difficulty: "medium" },
    { question: "Quel ange a annoncé la naissance de Jésus à Marie?", options: ["Gabriel", "Michel", "Raphaël", "Uriel"], answer: 0, difficulty: "medium" },
    { question: "De quoi étaient faits les dix commandements?", options: ["Pierre", "Bois", "Or", "Argile"], answer: 0, difficulty: "medium" },
    { question: "Qui a interprété les rêves de Pharaon?", options: ["Joseph", "Daniel", "Moïse", "Abraham"], answer: 0, difficulty: "medium" },
    { question: "Quel roi a eu la sagesse de Dieu?", options: ["Salomon", "David", "Saül", "Ézéchias"], answer: 0, difficulty: "medium" },

    // Hard Questions
    { question: "Quel est le verset le plus court de la Bible?", options: ["Jésus pleura", "Priez sans cesse", "Aimez-vous", "Soyez saints"], answer: 0, difficulty: "hard" },
    { question: "Combien de livres l'apôtre Paul a-t-il écrits?", options: ["13", "14", "10", "7"], answer: 0, difficulty: "hard" },
    { question: "Qui était Melchisédek?", options: ["Roi et sacrificateur", "Prophète", "Ange", "Juge"], answer: 0, difficulty: "hard" },
    { question: "Quel patriarche a vécu le plus longtemps?", options: ["Mathusalem", "Adam", "Noé", "Seth"], answer: 0, difficulty: "hard" },
    { question: "Quelle est la 'Grande Commission'?", options: ["Faire des disciples", "Construire le temple", "Jeûner 40 jours", "Vaincre les géants"], answer: 0, difficulty: "hard" },
    { question: "Qui était Barnabas?", options: ["Compagnon de Paul", "Apôtre de Jésus", "Prophète", "Ange"], answer: 0, difficulty: "hard" },
    { question: "Combien de fois le mot 'amour' apparaît-il dans 1 Corinthiens 13?", options: ["9 fois", "7 fois", "12 fois", "5 fois"], answer: 0, difficulty: "hard" },
    { question: "Quel livre de la Bible ne mentionne pas Dieu?", options: ["Esther", "Ruth", "Jonas", "Amos"], answer: 0, difficulty: "hard" },
    { question: "Qui a écrit le livre des Proverbes?", options: ["Salomon principalement", "David", "Moïse", "Samuel"], answer: 0, difficulty: "hard" },
    { question: "Quel était le métier de Lydie dans Actes 16?", options: ["Marchande de pourpre", "Couturière", "Potière", "Tisserande"], answer: 0, difficulty: "hard" },
    { question: "Combien d'années les Israélites ont-ils erré dans le désert?", options: ["40 ans", "50 ans", "30 ans", "25 ans"], answer: 0, difficulty: "hard" },
    { question: "Quel prophète a mangé un rouleau?", options: ["Ézéchiel", "Jérémie", "Ésaïe", "Daniel"], answer: 0, difficulty: "hard" },
    { question: "Qui a été le dernier juge d'Israël?", options: ["Samuel", "Samson", "Éli", "Gédéon"], answer: 0, difficulty: "hard" },
    { question: "Quelle est la signification du nom Emmanuel?", options: ["Dieu avec nous", "Dieu sauve", "Dieu est grand", "Dieu écoute"], answer: 0, difficulty: "hard" },
    { question: "Combien de lettres Jean a-t-il écrites?", options: ["3", "2", "4", "1"], answer: 0, difficulty: "hard" },
];

// Famous Bible verses for Memory Game
export const BIBLE_VERSES_PAIRS = [
    { reference: "Jean 3:16", text: "Car Dieu a tant aimé le monde" },
    { reference: "Psaume 23:1", text: "L'Éternel est mon berger" },
    { reference: "Philippiens 4:13", text: "Je puis tout par celui qui me fortifie" },
    { reference: "Romains 8:28", text: "Toutes choses concourent au bien" },
    { reference: "Proverbes 3:5", text: "Confie-toi en l'Éternel de tout ton coeur" },
    { reference: "Ésaïe 40:31", text: "Ceux qui se confient en l'Éternel renouvellent leur force" },
    { reference: "Matthieu 11:28", text: "Venez à moi, vous tous qui êtes fatigués" },
    { reference: "Josué 1:9", text: "Fortifie-toi et prends courage" },
    { reference: "Jérémie 29:11", text: "Je connais les projets que j'ai formés sur vous" },
    { reference: "Galates 5:22", text: "Le fruit de l'Esprit, c'est l'amour" },
    { reference: "Romains 6:23", text: "Le salaire du péché, c'est la mort" },
    { reference: "Hébreux 11:1", text: "La foi est une ferme assurance" },
    { reference: "1 Jean 4:8", text: "Dieu est amour" },
    { reference: "2 Timothée 1:7", text: "Dieu ne nous a pas donné un esprit de timidité" },
    { reference: "Ephésiens 2:8", text: "C'est par la grâce que vous êtes sauvés" },
    { reference: "Matthieu 28:19", text: "Allez, faites de toutes les nations des disciples" },
    { reference: "Jean 14:6", text: "Je suis le chemin, la vérité et la vie" },
    { reference: "Romains 12:2", text: "Ne vous conformez pas au siècle présent" },
    { reference: "Proverbes 18:10", text: "Le nom de l'Éternel est une tour forte" },
    { reference: "Psaume 119:105", text: "Ta parole est une lampe à mes pieds" },
];

// Biblical words for Word Search
export const BIBLE_WORDS = {
    easy: [
        "JESUS", "DIEU", "AMOUR", "FOI", "PAIX", "JOIE", "GRACE", "ESPRIT",
        "BIBLE", "PRIERE", "AMEN", "CIEL", "VIE", "COEUR", "ANGE", "CROIX"
    ],
    medium: [
        "SALUT", "PARDON", "LOUANGE", "GLOIRE", "SAINTE", "VERITE", "LUMIERE",
        "BERGER", "TEMPLE", "ESPOIR", "SAGESSE", "JUSTICE", "PROMESSE", "ALLIANCE"
    ],
    hard: [
        "RESURRECTION", "REDEMPTION", "SANCTIFICATION", "JUSTIFICATION", "RECONCILIATION",
        "BENEDICTION", "REVELATION", "PERSECUTION", "CONVERSION", "INTERCESSION"
    ],
    names: [
        "MOISE", "ABRAHAM", "DAVID", "SALOMON", "ELIE", "DANIEL", "PIERRE",
        "PAUL", "MARIE", "JOSEPH", "SAMUEL", "ESAIE", "JEREMIE"
    ],
    places: [
        "JERUSALEM", "BETHLEEM", "NAZARETH", "GALILEE", "EGYPTE", "JORDAN",
        "SINAI", "CANAAN", "BABEL", "EDEN"
    ]
};

// Bible characters for games
export const BIBLE_CHARACTERS = [
    { name: "Adam", role: "Premier homme", testament: "AT" },
    { name: "Ève", role: "Première femme", testament: "AT" },
    { name: "Noé", role: "Constructeur de l'arche", testament: "AT" },
    { name: "Abraham", role: "Père de la foi", testament: "AT" },
    { name: "Moïse", role: "Libérateur d'Israël", testament: "AT" },
    { name: "David", role: "Roi berger", testament: "AT" },
    { name: "Salomon", role: "Roi sage", testament: "AT" },
    { name: "Daniel", role: "Prophète dans la fosse aux lions", testament: "AT" },
    { name: "Élie", role: "Prophète de feu", testament: "AT" },
    { name: "Jonas", role: "Prophète et le grand poisson", testament: "AT" },
    { name: "Jésus", role: "Fils de Dieu, Sauveur", testament: "NT" },
    { name: "Marie", role: "Mère de Jésus", testament: "NT" },
    { name: "Joseph", role: "Père adoptif de Jésus", testament: "NT" },
    { name: "Pierre", role: "Apôtre, Pierre de l'Église", testament: "NT" },
    { name: "Paul", role: "Apôtre des nations", testament: "NT" },
    { name: "Jean", role: "L'apôtre que Jésus aimait", testament: "NT" },
    { name: "Lazare", role: "Ressuscité par Jésus", testament: "NT" },
    { name: "Marthe", role: "Sœur de Marie et Lazare", testament: "NT" },
];

// Chronological Bible events for chronology game - ORDERED from oldest to newest
export const CHRONO_EVENTS = [
    { id: "creation", event: "Création du monde", year: "Au commencement" },
    { id: "adam_eve", event: "Adam et Ève dans le jardin d'Éden", year: "~4000 av. J.-C." },
    { id: "fall", event: "La chute de l'homme", year: "~4000 av. J.-C." },
    { id: "cain_abel", event: "Caïn tue Abel", year: "~4000 av. J.-C." },
    { id: "flood", event: "Le déluge de Noé", year: "~2500 av. J.-C." },
    { id: "babel", event: "La tour de Babel", year: "~2200 av. J.-C." },
    { id: "abraham_call", event: "L'appel d'Abraham", year: "~2000 av. J.-C." },
    { id: "isaac_birth", event: "Naissance d'Isaac", year: "~1900 av. J.-C." },
    { id: "jacob_esau", event: "Jacob et Ésaü", year: "~1850 av. J.-C." },
    { id: "joseph_egypt", event: "Joseph vendu en Égypte", year: "~1720 av. J.-C." },
    { id: "moses_birth", event: "Naissance de Moïse", year: "~1530 av. J.-C." },
    { id: "exodus", event: "L'Exode d'Égypte", year: "~1450 av. J.-C." },
    { id: "ten_commandments", event: "Les dix commandements", year: "~1450 av. J.-C." },
    { id: "jericho", event: "Chute de Jéricho", year: "~1400 av. J.-C." },
    { id: "david_goliath", event: "David vainc Goliath", year: "~1025 av. J.-C." },
    { id: "solomon_temple", event: "Construction du temple de Salomon", year: "~960 av. J.-C." },
    { id: "elijah_prophets", event: "Élie et les prophètes de Baal", year: "~870 av. J.-C." },
    { id: "jonah_nineveh", event: "Jonas à Ninive", year: "~760 av. J.-C." },
    { id: "babylonian_exile", event: "Exil à Babylone", year: "~586 av. J.-C." },
    { id: "daniel_lions", event: "Daniel dans la fosse aux lions", year: "~539 av. J.-C." },
    { id: "temple_rebuilt", event: "Reconstruction du temple", year: "~516 av. J.-C." },
    { id: "jesus_birth", event: "Naissance de Jésus", year: "~4 av. J.-C." },
    { id: "jesus_baptism", event: "Baptême de Jésus", year: "~27 ap. J.-C." },
    { id: "transfiguration", event: "La Transfiguration", year: "~29 ap. J.-C." },
    { id: "crucifixion", event: "Crucifixion de Jésus", year: "~30 ap. J.-C." },
    { id: "resurrection", event: "Résurrection de Jésus", year: "~30 ap. J.-C." },
    { id: "pentecost", event: "La Pentecôte", year: "~30 ap. J.-C." },
    { id: "paul_conversion", event: "Conversion de Paul", year: "~35 ap. J.-C." },
    { id: "first_council", event: "Concile de Jérusalem", year: "~50 ap. J.-C." },
    { id: "revelation", event: "Jean écrit l'Apocalypse", year: "~95 ap. J.-C." },
];

// Characters for "Who Am I?" game with clues
export const WHO_AM_I_CHARACTERS = [
    {
        id: "moses",
        name: "Moïse",
        clues: [
            "J'ai été sauvé des eaux étant bébé",
            "J'ai conduit mon peuple hors d'Égypte",
            "J'ai reçu les dix commandements sur une montagne"
        ]
    },
    {
        id: "david",
        name: "David",
        clues: [
            "J'étais berger avant de devenir roi",
            "J'ai vaincu un géant avec une fronde",
            "J'ai écrit beaucoup de psaumes"
        ]
    },
    {
        id: "abraham",
        name: "Abraham",
        clues: [
            "Dieu m'a promis une descendance nombreuse",
            "Ma femme s'appelait Sarah",
            "Je suis appelé le père de la foi"
        ]
    },
    {
        id: "joseph",
        name: "Joseph",
        clues: [
            "Mes frères m'ont vendu comme esclave",
            "J'ai interprété les rêves de Pharaon",
            "J'avais une tunique de plusieurs couleurs"
        ]
    },
    {
        id: "paul",
        name: "Paul",
        clues: [
            "J'ai persécuté les chrétiens avant ma conversion",
            "J'ai été aveuglé sur le chemin de Damas",
            "J'ai écrit de nombreuses lettres aux églises"
        ]
    },
    {
        id: "peter",
        name: "Pierre",
        clues: [
            "J'étais pêcheur avant de suivre Jésus",
            "J'ai marché sur l'eau",
            "J'ai renié Jésus trois fois"
        ]
    },
    {
        id: "daniel",
        name: "Daniel",
        clues: [
            "J'ai été jeté dans une fosse aux lions",
            "J'ai interprété les rêves du roi Nebucadnetsar",
            "J'ai vu une écriture mystérieuse sur un mur"
        ]
    },
    {
        id: "noah",
        name: "Noé",
        clues: [
            "J'ai construit un grand bateau",
            "J'ai sauvé des animaux deux par deux",
            "J'ai vu un arc-en-ciel comme signe d'alliance"
        ]
    },
    {
        id: "mary",
        name: "Marie",
        clues: [
            "Un ange m'a annoncé une nouvelle extraordinaire",
            "Mon fils est né dans une étable",
            "Je suis la mère du Sauveur"
        ]
    },
    {
        id: "samson",
        name: "Samson",
        clues: [
            "Ma force était dans mes cheveux",
            "J'ai été trahi par Dalila",
            "J'ai détruit le temple des Philistins"
        ]
    },
    {
        id: "elijah",
        name: "Élie",
        clues: [
            "J'ai été nourri par des corbeaux",
            "J'ai combattu les prophètes de Baal au mont Carmel",
            "J'ai été enlevé au ciel dans un char de feu"
        ]
    },
    {
        id: "ruth",
        name: "Ruth",
        clues: [
            "Je suis une Moabite qui a suivi sa belle-mère",
            "J'ai dit: 'Ton peuple sera mon peuple'",
            "Je suis une ancêtre du roi David"
        ]
    },
    {
        id: "jonah",
        name: "Jonas",
        clues: [
            "J'ai fui l'appel de Dieu en bateau",
            "J'ai passé trois jours dans le ventre d'un gros poisson",
            "J'ai prêché à Ninive"
        ]
    },
    {
        id: "solomon",
        name: "Salomon",
        clues: [
            "J'ai demandé la sagesse à Dieu",
            "J'ai construit le premier temple de Jérusalem",
            "J'ai écrit des proverbes et des cantiques"
        ]
    },
    {
        id: "esther",
        name: "Esther",
        clues: [
            "Je suis devenue reine de Perse",
            "J'ai sauvé mon peuple d'un complot",
            "Mon cousin s'appelait Mardochée"
        ]
    },
];

// Get random questions for quiz
export function getRandomQuestions(count: number, difficulty?: 'easy' | 'medium' | 'hard'): typeof BIBLE_QUESTIONS {
    let questions = [...BIBLE_QUESTIONS];

    if (difficulty) {
        questions = questions.filter(q => q.difficulty === difficulty);
    }

    // Shuffle
    for (let i = questions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [questions[i], questions[j]] = [questions[j], questions[i]];
    }

    return questions.slice(0, count);
}

// Get pairs for memory game
export function getMemoryPairs(count: number): typeof BIBLE_VERSES_PAIRS {
    const pairs = [...BIBLE_VERSES_PAIRS];

    // Shuffle
    for (let i = pairs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
    }

    return pairs.slice(0, count);
}

// Get words for word search
export function getWordSearchWords(count: number, category?: keyof typeof BIBLE_WORDS): string[] {
    let words: string[] = [];

    if (category) {
        words = [...BIBLE_WORDS[category]];
    } else {
        // Mix from all categories
        Object.values(BIBLE_WORDS).forEach(arr => {
            words.push(...arr);
        });
    }

    // Shuffle
    for (let i = words.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [words[i], words[j]] = [words[j], words[i]];
    }

    return words.slice(0, count);
}

// Get random chronological events for chrono game
export function getRandomChronoEvents(count: number = 5): typeof CHRONO_EVENTS {
    const events = [...CHRONO_EVENTS];

    // Shuffle
    for (let i = events.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [events[i], events[j]] = [events[j], events[i]];
    }

    return events.slice(0, count);
}

// Get random characters for "Who Am I?" game
export function getRandomWhoAmICharacters(count: number = 5): typeof WHO_AM_I_CHARACTERS {
    const characters = [...WHO_AM_I_CHARACTERS];

    // Shuffle
    for (let i = characters.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [characters[i], characters[j]] = [characters[j], characters[i]];
    }

    return characters.slice(0, count);
}

// Generate game configuration based on game type
export async function generateGameConfig(gameType: string): Promise<any> {
    switch (gameType) {
        case 'bible_memory':
            return {
                pairs: getMemoryPairs(8),
                type: 'memory'
            };

        case 'quiz_duel':
            return {
                questions: getRandomQuestions(10),
                type: 'quiz'
            };

        case 'who_am_i':
            return {
                characters: getRandomWhoAmICharacters(5),
                type: 'who_am_i'
            };

        case 'chrono':
            return {
                events: getRandomChronoEvents(6),
                type: 'chrono'
            };

        case 'word_search':
            return {
                words: getWordSearchWords(10),
                type: 'word_search',
                gridSize: 12
            };

        default:
            return {
                questions: getRandomQuestions(10),
                type: 'quiz'
            };
    }
}

export default {
    BIBLE_QUESTIONS,
    BIBLE_VERSES_PAIRS,
    BIBLE_WORDS,
    BIBLE_CHARACTERS,
    CHRONO_EVENTS,
    WHO_AM_I_CHARACTERS,
    getRandomQuestions,
    getMemoryPairs,
    getWordSearchWords,
    getRandomChronoEvents,
    getRandomWhoAmICharacters,
    generateGameConfig
};
