/**
 * BIBLE STORE
 * ===========
 * State management for Bible features: favorites, highlights, reading history
 * Uses Zustand with localStorage persistence
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Types
export interface BibleHighlight {
    id: string;
    bookId: string;
    bookName: string;
    chapter: number;
    verse: number;
    text: string;
    color: HighlightColor;
    createdAt: string;
}

export interface BibleFavorite {
    id: string;
    bookId: string;
    bookName: string;
    chapter: number;
    verse: number;
    text: string;
    note?: string;
    createdAt: string;
}

export interface ReadingHistory {
    bookId: string;
    bookName: string;
    chapter: number;
    lastReadAt: string;
}

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'orange' | 'purple';

export const HIGHLIGHT_COLORS: {
    color: HighlightColor;
    label: string;
    labelEn: string;
    bgClass: string;
    textClass: string;
    borderClass: string;
}[] = [
        { color: 'yellow', label: 'Jaune', labelEn: 'Yellow', bgClass: 'bg-yellow-300/40', textClass: 'text-yellow-400', borderClass: 'border-yellow-400' },
        { color: 'green', label: 'Vert', labelEn: 'Green', bgClass: 'bg-green-300/40', textClass: 'text-green-400', borderClass: 'border-green-400' },
        { color: 'blue', label: 'Bleu', labelEn: 'Blue', bgClass: 'bg-blue-300/40', textClass: 'text-blue-400', borderClass: 'border-blue-400' },
        { color: 'pink', label: 'Rose', labelEn: 'Pink', bgClass: 'bg-pink-300/40', textClass: 'text-pink-400', borderClass: 'border-pink-400' },
        { color: 'orange', label: 'Orange', labelEn: 'Orange', bgClass: 'bg-orange-300/40', textClass: 'text-orange-400', borderClass: 'border-orange-400' },
        { color: 'purple', label: 'Violet', labelEn: 'Purple', bgClass: 'bg-purple-300/40', textClass: 'text-purple-400', borderClass: 'border-purple-400' },
    ];

export type GameLanguage = 'fr' | 'en';

interface BibleState {
    // Current reading position
    currentBook: string;
    currentChapter: number;
    setCurrentPosition: (bookId: string, chapter: number) => void;

    // Highlights
    highlights: BibleHighlight[];
    addHighlight: (bookId: string, bookName: string, chapter: number, verse: number, text: string, color: HighlightColor) => void;
    removeHighlight: (id: string) => void;
    removeHighlightByVerse: (bookId: string, chapter: number, verse: number) => void;
    getHighlight: (bookId: string, chapter: number, verse: number) => BibleHighlight | undefined;
    updateHighlightColor: (id: string, color: HighlightColor) => void;
    clearAllHighlights: () => void;

    // Favorites
    favorites: BibleFavorite[];
    addFavorite: (bookId: string, bookName: string, chapter: number, verse: number, text: string, note?: string) => void;
    removeFavorite: (id: string) => void;
    removeFavoriteByVerse: (bookId: string, chapter: number, verse: number) => void;
    isFavorite: (bookId: string, chapter: number, verse: number) => boolean;
    updateFavoriteNote: (id: string, note: string) => void;
    clearAllFavorites: () => void;

    // Reading history
    readingHistory: ReadingHistory[];
    addToHistory: (bookId: string, bookName: string, chapter: number) => void;
    getLastRead: () => ReadingHistory | undefined;
    clearHistory: () => void;

    // Selected verses (for bulk operations)
    selectedVerses: string[]; // Format: "bookId:chapter:verse"
    toggleVerseSelection: (bookId: string, chapter: number, verse: number) => void;
    selectVerse: (bookId: string, chapter: number, verse: number) => void;
    deselectVerse: (bookId: string, chapter: number, verse: number) => void;
    clearSelection: () => void;
    isVerseSelected: (bookId: string, chapter: number, verse: number) => boolean;
    getSelectedCount: () => number;

    // Game language preference
    gameLanguage: GameLanguage;
    setGameLanguage: (lang: GameLanguage) => void;

    // Font size
    fontSize: 'small' | 'medium' | 'large' | 'xlarge';
    setFontSize: (size: 'small' | 'medium' | 'large' | 'xlarge') => void;

    // Reading mode
    readingMode: 'verse' | 'paragraph';
    setReadingMode: (mode: 'verse' | 'paragraph') => void;
}

export const useBibleStore = create<BibleState>()(
    persist(
        (set, get) => ({
            // Current reading position
            currentBook: 'genese',
            currentChapter: 1,
            setCurrentPosition: (bookId, chapter) => {
                set({ currentBook: bookId, currentChapter: chapter });
                // Also add to history
                const book = get().readingHistory.find(h => h.bookId === bookId);
                const bookName = book?.bookName || bookId;
                get().addToHistory(bookId, bookName, chapter);
            },

            // Highlights
            highlights: [],
            addHighlight: (bookId, bookName, chapter, verse, text, color) => {
                const existing = get().getHighlight(bookId, chapter, verse);
                if (existing) {
                    // Update existing highlight
                    set(state => ({
                        highlights: state.highlights.map(h =>
                            h.id === existing.id ? { ...h, color } : h
                        )
                    }));
                } else {
                    // Add new highlight
                    set(state => ({
                        highlights: [
                            ...state.highlights,
                            {
                                id: `hl-${bookId}-${chapter}-${verse}-${Date.now()}`,
                                bookId,
                                bookName,
                                chapter,
                                verse,
                                text,
                                color,
                                createdAt: new Date().toISOString()
                            }
                        ]
                    }));
                }
            },
            removeHighlight: (id) => set(state => ({
                highlights: state.highlights.filter(h => h.id !== id)
            })),
            removeHighlightByVerse: (bookId, chapter, verse) => set(state => ({
                highlights: state.highlights.filter(h =>
                    !(h.bookId === bookId && h.chapter === chapter && h.verse === verse)
                )
            })),
            getHighlight: (bookId, chapter, verse) => {
                return get().highlights.find(
                    h => h.bookId === bookId && h.chapter === chapter && h.verse === verse
                );
            },
            updateHighlightColor: (id, color) => set(state => ({
                highlights: state.highlights.map(h =>
                    h.id === id ? { ...h, color } : h
                )
            })),
            clearAllHighlights: () => set({ highlights: [] }),

            // Favorites
            favorites: [],
            addFavorite: (bookId, bookName, chapter, verse, text, note) => {
                // Check if already favorite
                if (get().isFavorite(bookId, chapter, verse)) {
                    return;
                }
                set(state => ({
                    favorites: [
                        {
                            id: `fav-${bookId}-${chapter}-${verse}-${Date.now()}`,
                            bookId,
                            bookName,
                            chapter,
                            verse,
                            text,
                            note,
                            createdAt: new Date().toISOString()
                        },
                        ...state.favorites
                    ]
                }));
            },
            removeFavorite: (id) => set(state => ({
                favorites: state.favorites.filter(f => f.id !== id)
            })),
            removeFavoriteByVerse: (bookId, chapter, verse) => set(state => ({
                favorites: state.favorites.filter(f =>
                    !(f.bookId === bookId && f.chapter === chapter && f.verse === verse)
                )
            })),
            isFavorite: (bookId, chapter, verse) => {
                return get().favorites.some(
                    f => f.bookId === bookId && f.chapter === chapter && f.verse === verse
                );
            },
            updateFavoriteNote: (id, note) => set(state => ({
                favorites: state.favorites.map(f =>
                    f.id === id ? { ...f, note } : f
                )
            })),
            clearAllFavorites: () => set({ favorites: [] }),

            // Reading history
            readingHistory: [],
            addToHistory: (bookId, bookName, chapter) => set(state => {
                const now = new Date().toISOString();
                const filtered = state.readingHistory.filter(
                    h => !(h.bookId === bookId && h.chapter === chapter)
                );
                return {
                    readingHistory: [
                        { bookId, bookName, chapter, lastReadAt: now },
                        ...filtered
                    ].slice(0, 100) // Keep only last 100
                };
            }),
            getLastRead: () => get().readingHistory[0],
            clearHistory: () => set({ readingHistory: [] }),

            // Selected verses
            selectedVerses: [],
            toggleVerseSelection: (bookId, chapter, verse) => set(state => {
                const key = `${bookId}:${chapter}:${verse}`;
                if (state.selectedVerses.includes(key)) {
                    return { selectedVerses: state.selectedVerses.filter(v => v !== key) };
                } else {
                    return { selectedVerses: [...state.selectedVerses, key] };
                }
            }),
            selectVerse: (bookId, chapter, verse) => set(state => {
                const key = `${bookId}:${chapter}:${verse}`;
                if (!state.selectedVerses.includes(key)) {
                    return { selectedVerses: [...state.selectedVerses, key] };
                }
                return state;
            }),
            deselectVerse: (bookId, chapter, verse) => set(state => {
                const key = `${bookId}:${chapter}:${verse}`;
                return { selectedVerses: state.selectedVerses.filter(v => v !== key) };
            }),
            clearSelection: () => set({ selectedVerses: [] }),
            isVerseSelected: (bookId, chapter, verse) => {
                const key = `${bookId}:${chapter}:${verse}`;
                return get().selectedVerses.includes(key);
            },
            getSelectedCount: () => get().selectedVerses.length,

            // Game language preference
            gameLanguage: 'fr',
            setGameLanguage: (lang) => set({ gameLanguage: lang }),

            // Font size
            fontSize: 'medium',
            setFontSize: (size) => set({ fontSize: size }),

            // Reading mode
            readingMode: 'verse',
            setReadingMode: (mode) => set({ readingMode: mode }),
        }),
        {
            name: 'bible-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                currentBook: state.currentBook,
                currentChapter: state.currentChapter,
                highlights: state.highlights,
                favorites: state.favorites,
                readingHistory: state.readingHistory,
                gameLanguage: state.gameLanguage,
                fontSize: state.fontSize,
                readingMode: state.readingMode,
            }),
        }
    )
);

// Utility functions for copying and sharing
export async function copyVerse(reference: string, text: string): Promise<boolean> {
    try {
        const copyText = `${reference}\n"${text}"`;
        await navigator.clipboard.writeText(copyText);
        return true;
    } catch (e) {
        console.error('Error copying verse:', e);
        return false;
    }
}

export async function copyMultipleVerses(verses: { reference: string; text: string }[]): Promise<boolean> {
    try {
        const copyText = verses.map(v => `${v.reference}\n"${v.text}"`).join('\n\n');
        await navigator.clipboard.writeText(copyText);
        return true;
    } catch (e) {
        console.error('Error copying verses:', e);
        return false;
    }
}

export async function shareVerse(reference: string, text: string): Promise<boolean> {
    const shareText = `📖 ${reference}\n\n"${text}"\n\n— Prayer Marathon App`;

    try {
        if (navigator.share) {
            await navigator.share({
                title: reference,
                text: shareText,
            });
            return true;
        } else {
            // Fallback to clipboard
            await navigator.clipboard.writeText(shareText);
            return true;
        }
    } catch (e) {
        // User cancelled or error
        if ((e as Error).name !== 'AbortError') {
            console.error('Error sharing verse:', e);
        }
        return false;
    }
}

export async function shareMultipleVerses(verses: { reference: string; text: string }[]): Promise<boolean> {
    const shareText = verses.map(v => `📖 ${v.reference}\n"${v.text}"`).join('\n\n') + '\n\n— Prayer Marathon App';

    try {
        if (navigator.share) {
            await navigator.share({
                title: 'Versets bibliques',
                text: shareText,
            });
            return true;
        } else {
            await navigator.clipboard.writeText(shareText);
            return true;
        }
    } catch (e) {
        if ((e as Error).name !== 'AbortError') {
            console.error('Error sharing verses:', e);
        }
        return false;
    }
}
