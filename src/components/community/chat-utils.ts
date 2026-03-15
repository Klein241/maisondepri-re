// Chat Utilities — pure functions extracted from whatsapp-chat.tsx

export const MEMBER_COLORS = [
    '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6',
    '#EF4444', '#06B6D4', '#F97316', '#84CC16', '#A855F7',
    '#14B8A6', '#E11D48', '#0EA5E9', '#D946EF', '#22C55E',
];

export function getInitials(name: string | null): string {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function formatTime(date: string): string {
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
        return 'Hier';
    } else if (diffDays < 7) {
        return d.toLocaleDateString('fr-FR', { weekday: 'short' });
    } else {
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    }
}

export function getMemberColor(senderId: string): string {
    let hash = 0;
    for (let i = 0; i < senderId.length; i++) {
        hash = ((hash << 5) - hash) + senderId.charCodeAt(i);
        hash |= 0;
    }
    return MEMBER_COLORS[Math.abs(hash) % MEMBER_COLORS.length];
}

// Bible book name mappings (French abbreviations → canonical file names)
export const BIBLE_BOOK_MAP: Record<string, string> = {
    'genese': 'genese', 'gen': 'genese', 'gn': 'genese',
    'exode': 'exode', 'ex': 'exode',
    'levitique': 'levitique', 'lv': 'levitique',
    'nombres': 'nombres', 'nb': 'nombres',
    'deuteronome': 'deuteronome', 'dt': 'deuteronome',
    'josue': 'josue', 'jo': 'josue',
    'juges': 'juges', 'jg': 'juges',
    'ruth': 'ruth', 'rt': 'ruth',
    '1samuel': '1samuel', '1sam': '1samuel', '1sm': '1samuel',
    '2samuel': '2samuel', '2sam': '2samuel', '2sm': '2samuel',
    '1rois': '1rois', '1r': '1rois',
    '2rois': '2rois', '2r': '2rois',
    '1chroniques': '1chroniques', '1chr': '1chroniques',
    '2chroniques': '2chroniques', '2chr': '2chroniques',
    'esdras': 'esdras', 'esd': 'esdras',
    'nehemie': 'nehemie', 'ne': 'nehemie',
    'esther': 'esther', 'est': 'esther',
    'job': 'job', 'jb': 'job',
    'psaumes': 'psaumes', 'psaume': 'psaumes', 'ps': 'psaumes',
    'proverbes': 'proverbes', 'pr': 'proverbes', 'pro': 'proverbes',
    'ecclesiaste': 'ecclesiaste', 'ecc': 'ecclesiaste',
    'cantique': 'cantique', 'cantiques': 'cantique', 'ct': 'cantique',
    'esaie': 'esaie', 'isaie': 'esaie', 'is': 'esaie',
    'jeremie': 'jeremie', 'jer': 'jeremie', 'jr': 'jeremie',
    'lamentations': 'lamentations', 'lam': 'lamentations',
    'ezechiel': 'ezechiel', 'ez': 'ezechiel',
    'daniel': 'daniel', 'dn': 'daniel', 'da': 'daniel',
    'osee': 'osee', 'os': 'osee',
    'joel': 'joel', 'jl': 'joel',
    'amos': 'amos', 'am': 'amos',
    'abdias': 'abdias', 'ab': 'abdias',
    'jonas': 'jonas', 'jon': 'jonas',
    'michee': 'michee', 'mi': 'michee',
    'nahum': 'nahum', 'na': 'nahum',
    'habacuc': 'habacuc', 'ha': 'habacuc',
    'sophonie': 'sophonie', 'so': 'sophonie',
    'aggee': 'aggee', 'ag': 'aggee',
    'zacharie': 'zacharie', 'za': 'zacharie',
    'malachie': 'malachie', 'ml': 'malachie', 'mal': 'malachie',
    'matthieu': 'matthieu', 'mat': 'matthieu', 'mt': 'matthieu',
    'marc': 'marc', 'mc': 'marc', 'mk': 'marc',
    'luc': 'luc', 'lc': 'luc',
    'jean': 'jean', 'jn': 'jean',
    'actes': 'actes', 'ac': 'actes',
    'romains': 'romains', 'ro': 'romains', 'rm': 'romains',
    '1corinthiens': '1corinthiens', '1co': '1corinthiens', '1cor': '1corinthiens',
    '2corinthiens': '2corinthiens', '2co': '2corinthiens', '2cor': '2corinthiens',
    'galates': 'galates', 'ga': 'galates', 'gal': 'galates',
    'ephesiens': 'ephesiens', 'ep': 'ephesiens', 'eph': 'ephesiens',
    'philippiens': 'philippiens', 'ph': 'philippiens', 'phil': 'philippiens',
    'colossiens': 'colossiens', 'col': 'colossiens',
    '1thessaloniciens': '1thessaloniciens', '1th': '1thessaloniciens',
    '2thessaloniciens': '2thessaloniciens', '2th': '2thessaloniciens',
    '1timothee': '1timothee', '1tm': '1timothee', '1tim': '1timothee',
    '2timothee': '2timothee', '2tm': '2timothee', '2tim': '2timothee',
    'tite': 'tite', 'tt': 'tite',
    'philemon': 'philemon', 'phm': 'philemon',
    'hebreux': 'hebreux', 'he': 'hebreux', 'heb': 'hebreux',
    'jacques': 'jacques', 'jc': 'jacques', 'jac': 'jacques',
    '1pierre': '1pierre', '1pi': '1pierre', '1p': '1pierre',
    '2pierre': '2pierre', '2pi': '2pierre', '2p': '2pierre',
    '1jean': '1jean', '1jn': '1jean',
    '2jean': '2jean', '2jn': '2jean',
    '3jean': '3jean', '3jn': '3jean',
    'jude': 'jude', 'jd': 'jude',
    'apocalypse': 'apocalypse', 'ap': 'apocalypse', 'apo': 'apocalypse',
};

/** Normalize a French Bible book name for file lookup */
export function normalizeBibleBookName(raw: string): string {
    const normalized = raw.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '')
        .replace(/^1er?\s*/i, '1').replace(/^2e?\s*/i, '2').replace(/^3e?\s*/i, '3');
    return BIBLE_BOOK_MAP[normalized] || normalized;
}
