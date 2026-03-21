'use client';

/**
 * READING PLANS & VERSE MEMORIZATION
 * ===================================
 * State management for Bible reading plans and spaced-repetition flashcards
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================
// READING PLAN TYPES
// ============================================

export interface ReadingPlanDay {
    day: number;
    passages: { bookId: string; bookName: string; chapter: number }[];
    completed: boolean;
    completedAt?: string;
}

export interface ReadingPlan {
    id: string;
    name: string;
    description: string;
    icon: string;
    totalDays: number;
    category: 'full' | 'nt' | 'ot' | 'thematic';
    gradient: string;
}

export interface ActivePlan {
    planId: string;
    startDate: string;
    currentDay: number;
    completedDays: number[];
    streak: number;
    lastCompletedDate?: string;
}

// ============================================
// VERSE MEMORIZATION TYPES (SRS)
// ============================================

export interface MemoryCard {
    id: string;
    reference: string;
    text: string;
    bookId: string;
    chapter: number;
    verse: number;
    addedAt: string;
    // SRS fields
    easeFactor: number;     // Starts at 2.5
    interval: number;       // Days until next review
    repetitions: number;    // Total successful reviews
    nextReview: string;     // ISO date
    lastReview?: string;
    status: 'new' | 'learning' | 'reviewing' | 'mastered';
}

export type SRSRating = 'again' | 'hard' | 'good' | 'easy';

// ============================================
// PREDEFINED READING PLANS
// ============================================

export const READING_PLANS: ReadingPlan[] = [
    {
        id: 'bible-1-year',
        name: 'Bible en 1 an',
        description: 'Lisez toute la Bible en 365 jours à raison de ~3 chapitres par jour.',
        icon: '📖',
        totalDays: 365,
        category: 'full',
        gradient: 'from-amber-600/30 via-orange-600/20 to-transparent',
    },
    {
        id: 'nt-90-days',
        name: 'Nouveau Testament en 90 jours',
        description: 'Parcourez tout le Nouveau Testament en 3 mois.',
        icon: '✝️',
        totalDays: 90,
        category: 'nt',
        gradient: 'from-indigo-600/30 via-blue-600/20 to-transparent',
    },
    {
        id: 'psalms-30',
        name: 'Psaumes en 30 jours',
        description: 'Méditez les 150 Psaumes en un mois (5 par jour).',
        icon: '🎵',
        totalDays: 30,
        category: 'thematic',
        gradient: 'from-emerald-600/30 via-teal-600/20 to-transparent',
    },
    {
        id: 'proverbs-31',
        name: 'Proverbes en 31 jours',
        description: 'Un chapitre de Proverbes par jour pendant un mois.',
        icon: '💎',
        totalDays: 31,
        category: 'thematic',
        gradient: 'from-purple-600/30 via-pink-600/20 to-transparent',
    },
    {
        id: 'gospels-40',
        name: 'Les Évangiles en 40 jours',
        description: 'Suivez Jésus à travers les 4 Évangiles en 40 jours.',
        icon: '🕊️',
        totalDays: 40,
        category: 'nt',
        gradient: 'from-sky-600/30 via-cyan-600/20 to-transparent',
    },
];

// ============================================
// NOTIFICATION SETTINGS
// ============================================

export interface NotifSettings {
    enabled: boolean;
    time: string; // HH:mm format
    daysOfWeek: number[]; // 0=Sunday, 6=Saturday
}

// ============================================
// ZUSTAND STORE
// ============================================

interface ReadingPlanState {
    // Active plans
    activePlans: ActivePlan[];
    startPlan: (planId: string) => void;
    completePlanDay: (planId: string, day: number) => void;
    removePlan: (planId: string) => void;
    getActivePlan: (planId: string) => ActivePlan | undefined;

    // Verse Memorization (SRS)
    memoryCards: MemoryCard[];
    addMemoryCard: (reference: string, text: string, bookId: string, chapter: number, verse: number) => void;
    removeMemoryCard: (id: string) => void;
    reviewCard: (id: string, rating: SRSRating) => void;
    getDueCards: () => MemoryCard[];
    getCardStats: () => { total: number; new: number; learning: number; reviewing: number; mastered: number };

    // Notification settings
    notifSettings: NotifSettings;
    setNotifSettings: (settings: Partial<NotifSettings>) => void;
}

// SRS Algorithm (simplified SM-2)
function calculateSRS(card: MemoryCard, rating: SRSRating): Partial<MemoryCard> {
    const now = new Date();
    let { easeFactor, interval, repetitions } = card;

    switch (rating) {
        case 'again':
            repetitions = 0;
            interval = 1;
            easeFactor = Math.max(1.3, easeFactor - 0.2);
            break;
        case 'hard':
            interval = Math.max(1, Math.floor(interval * 1.2));
            easeFactor = Math.max(1.3, easeFactor - 0.15);
            repetitions++;
            break;
        case 'good':
            if (repetitions === 0) interval = 1;
            else if (repetitions === 1) interval = 6;
            else interval = Math.floor(interval * easeFactor);
            repetitions++;
            break;
        case 'easy':
            if (repetitions === 0) interval = 4;
            else interval = Math.floor(interval * easeFactor * 1.3);
            easeFactor += 0.15;
            repetitions++;
            break;
    }

    const nextReview = new Date(now);
    nextReview.setDate(nextReview.getDate() + interval);

    let status: MemoryCard['status'] = 'learning';
    if (repetitions === 0) status = 'new';
    else if (repetitions >= 5 && interval >= 21) status = 'mastered';
    else if (repetitions >= 2) status = 'reviewing';

    return {
        easeFactor,
        interval,
        repetitions,
        nextReview: nextReview.toISOString(),
        lastReview: now.toISOString(),
        status,
    };
}

export const useReadingPlanStore = create<ReadingPlanState>()(
    persist(
        (set, get) => ({
            // Active Plans
            activePlans: [],

            startPlan: (planId) => {
                const existing = get().activePlans.find(p => p.planId === planId);
                if (existing) return; // Already started

                set((state) => ({
                    activePlans: [...state.activePlans, {
                        planId,
                        startDate: new Date().toISOString(),
                        currentDay: 1,
                        completedDays: [],
                        streak: 0,
                    }],
                }));
            },

            completePlanDay: (planId, day) => {
                const now = new Date().toISOString();
                const today = new Date().toDateString();

                set((state) => ({
                    activePlans: state.activePlans.map(p => {
                        if (p.planId !== planId) return p;
                        if (p.completedDays.includes(day)) return p;

                        const newCompletedDays = [...p.completedDays, day];

                        // Calculate streak
                        let streak = p.streak;
                        if (p.lastCompletedDate) {
                            const lastDate = new Date(p.lastCompletedDate);
                            const diffDays = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
                            if (diffDays <= 1) streak++;
                            else streak = 1;
                        } else {
                            streak = 1;
                        }

                        return {
                            ...p,
                            completedDays: newCompletedDays,
                            currentDay: Math.max(p.currentDay, day + 1),
                            streak,
                            lastCompletedDate: today,
                        };
                    }),
                }));
            },

            removePlan: (planId) => {
                set((state) => ({
                    activePlans: state.activePlans.filter(p => p.planId !== planId),
                }));
            },

            getActivePlan: (planId) => {
                return get().activePlans.find(p => p.planId === planId);
            },

            // Verse Memorization
            memoryCards: [],

            addMemoryCard: (reference, text, bookId, chapter, verse) => {
                const id = `${bookId}-${chapter}-${verse}`;
                const existing = get().memoryCards.find(c => c.id === id);
                if (existing) return;

                const now = new Date().toISOString();
                set((state) => ({
                    memoryCards: [...state.memoryCards, {
                        id,
                        reference,
                        text,
                        bookId,
                        chapter,
                        verse,
                        addedAt: now,
                        easeFactor: 2.5,
                        interval: 0,
                        repetitions: 0,
                        nextReview: now,
                        status: 'new',
                    }],
                }));
            },

            removeMemoryCard: (id) => {
                set((state) => ({
                    memoryCards: state.memoryCards.filter(c => c.id !== id),
                }));
            },

            reviewCard: (id, rating) => {
                set((state) => ({
                    memoryCards: state.memoryCards.map(card => {
                        if (card.id !== id) return card;
                        const updates = calculateSRS(card, rating);
                        return { ...card, ...updates };
                    }),
                }));
            },

            getDueCards: () => {
                const now = new Date();
                return get().memoryCards.filter(card => {
                    if (card.status === 'new') return true;
                    return new Date(card.nextReview) <= now;
                });
            },

            getCardStats: () => {
                const cards = get().memoryCards;
                return {
                    total: cards.length,
                    new: cards.filter(c => c.status === 'new').length,
                    learning: cards.filter(c => c.status === 'learning').length,
                    reviewing: cards.filter(c => c.status === 'reviewing').length,
                    mastered: cards.filter(c => c.status === 'mastered').length,
                };
            },

            // Notification Settings
            notifSettings: {
                enabled: false,
                time: '07:00',
                daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
            },

            setNotifSettings: (settings) => {
                set((state) => ({
                    notifSettings: { ...state.notifSettings, ...settings },
                }));
            },
        }),
        {
            name: 'bible-reading-plans-storage',
        }
    )
);
