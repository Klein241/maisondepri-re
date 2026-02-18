import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from './supabase';
import { BibleVerse, DEFAULT_TRANSLATION as DEFAULT_BIBLE_ID } from './unified-bible-api';
import { PrayerCategory, PrayerRequest as PrayerRequestType, Testimonial as TestimonialType } from './types';
import { notifyPrayerPrayed, notifyFriendPrayed } from './notifications';

// Types
export interface DayProgress {
    dayNumber: number;
    completed: boolean;
    completedAt?: string;
    prayerCompleted: boolean;
    bibleReadingCompleted: boolean;
    fastingCompleted: boolean;
    journalEntry?: string;
}

export interface BibleHighlight {
    id: string; // bibleId + verseId
    color: string;
}

export interface BibleFavorite {
    id: string; // verseId (which includes book/chapter context)
    bibleId: string;
    reference: string;
    text: string;
}

export interface User {
    id: string;
    email: string;
    name: string;
    avatar?: string;
    joinedAt: string;
    whatsapp?: string;
    city?: string;
    country?: string;
    role?: string;
}

// Re-export types from types.ts to avoid duplication or use aliases
// But for now, we will just use the imported types in the AppState interface
// and remove the local definitions if they clash, or rename them.

export type PrayerRequest = PrayerRequestType;
export type Testimonial = TestimonialType;

export interface Achievement {
    id: string;
    name: string;
    description: string;
    icon: string;
    unlockedAt?: string;
    requirement: {
        type: 'streak' | 'days_completed' | 'prayers' | 'journal_entries';
        count: number;
    };
}

// Store interface
interface AppState {
    // User & Auth
    user: User | null;
    isLoading: boolean;
    authError: string | null;
    setUser: (user: User | null) => void;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (formData: any) => Promise<void>;
    signOut: () => Promise<void>;
    clearAuthError: () => void;
    loadInitialData: () => Promise<void>;

    // Progress
    currentDay: number;
    startDate: string | null;
    dayProgress: DayProgress[];
    setStartDate: (date: string) => void;
    updateDayProgress: (dayNumber: number, progress: Partial<DayProgress>) => void;
    completeDay: (dayNumber: number) => void;

    // Stats
    streak: number;
    totalDaysCompleted: number;
    calculateStreak: () => number;

    // Achievements
    achievements: Achievement[];
    unlockedAchievements: string[];
    unlockAchievement: (achievementId: string) => void;

    // Prayer Wall
    prayerRequests: PrayerRequest[];
    addPrayerRequest: (content: string, isAnonymous?: boolean, category?: PrayerCategory, photos?: string[]) => Promise<string | null>;
    prayForRequest: (requestId: string) => void;
    removePrayerRequest: (requestId: string) => void;

    // Testimonials
    testimonials: Testimonial[];
    addTestimonial: (content: string, photos?: string[]) => void;
    likeTestimonial: (testimonialId: string) => void;

    // Journal
    journalEntries: { date: string; content: string; mood?: string }[];
    addJournalEntry: (content: string, mood?: string) => void;

    // Theme
    theme: 'light' | 'dark' | 'system';
    setTheme: (theme: 'light' | 'dark' | 'system') => void;

    // App state
    isHydrated: boolean;
    setHydrated: (state: boolean) => void;

    // Navigation Context
    bibleNavigation: { bookId: string; chapterId: string } | null;
    bibleViewTarget: 'home' | 'read' | 'study' | 'search' | 'favorites' | 'games' | null;
    setBibleNavigation: (nav: { bookId: string; chapterId: string } | null) => void;
    setBibleViewTarget: (target: 'home' | 'read' | 'study' | 'search' | 'favorites' | 'games' | null) => void;

    // UI State
    activeTab: 'home' | 'program' | 'bible' | 'journal' | 'community' | 'profile' | 'games';
    selectedDay: number | null;
    setActiveTab: (tab: 'home' | 'program' | 'bible' | 'journal' | 'community' | 'profile' | 'games') => void;
    setSelectedDay: (day: number | null) => void;

    // Navigation from notifications (deep-link)
    pendingNavigation: { viewState?: string; groupId?: string; groupName?: string; prayerId?: string; communityTab?: string; conversationId?: string } | null;
    setPendingNavigation: (nav: { viewState?: string; groupId?: string; groupName?: string; prayerId?: string; communityTab?: string; conversationId?: string } | null) => void;

    // DM refresh signal — triggers message reload in chat when a DM notification arrives (workaround for RLS blocking realtime)
    dmRefreshSignal: { conversationId: string; timestamp: number } | null;
    triggerDMRefresh: (conversationId: string) => void;

    // Bible Persistence
    bibleHighlights: BibleHighlight[];
    bibleFavorites: BibleFavorite[];
    addBibleHighlight: (highlight: BibleHighlight) => void;
    removeBibleHighlight: (id: string) => void;
    toggleBibleFavorite: (favorite: BibleFavorite) => void;

    // Advanced Bible State
    downloadedBibles: string[]; // IDs
    toggleDownloadBible: (id: string) => void;
    bibleSettings: {
        offlineMode: boolean;
        splitView: boolean;
        parallelBibleId: string | null;
    };
    setBibleSettings: (settings: Partial<AppState['bibleSettings']>) => void;
    dailyVerse: BibleVerse | null;
    setDailyVerse: (verse: BibleVerse | null) => void;

    // Global App Settings (Admin Controlled)
    appSettings: Record<string, string>;
    loadAppSettings: () => Promise<void>;
}

// Default achievements
const defaultAchievements: Achievement[] = [
    {
        id: 'first-day',
        name: 'Premier Pas',
        description: 'Complétez votre premier jour de marathon',
        icon: '🌟',
        requirement: { type: 'days_completed', count: 1 },
    },
    {
        id: 'week-warrior',
        name: 'Guerrier de la Semaine',
        description: 'Complétez 7 jours consécutifs',
        icon: '⚔️',
        requirement: { type: 'streak', count: 7 },
    },
    {
        id: 'halfway',
        name: 'Mi-Parcours',
        description: 'Atteignez la moitié du marathon (20 jours)',
        icon: '🎯',
        requirement: { type: 'days_completed', count: 20 },
    },
    {
        id: 'finisher',
        name: 'Finisseur',
        description: 'Complétez les 40 jours du marathon',
        icon: '🏆',
        requirement: { type: 'days_completed', count: 40 },
    },
    {
        id: 'prayer-warrior',
        name: 'Guerrier de Prière',
        description: 'Priez pour 10 demandes de prière',
        icon: '🙏',
        requirement: { type: 'prayers', count: 10 },
    },
    {
        id: 'journal-master',
        name: 'Maître Journal',
        description: 'Écrivez 20 entrées dans votre journal',
        icon: '📖',
        requirement: { type: 'journal_entries', count: 20 },
    },
];

// Initialize 40 days of progress
const initializeDayProgress = (): DayProgress[] => {
    return Array.from({ length: 40 }, (_, i) => ({
        dayNumber: i + 1,
        completed: false,
        prayerCompleted: false,
        bibleReadingCompleted: false,
        fastingCompleted: false,
    }));
};

export const useAppStore = create<AppState>()(
    persist(
        (set, get) => ({
            // User & Auth
            user: null,
            isLoading: false,
            authError: null,
            setUser: (user) => set({ user }),

            signIn: async (email, password) => {
                set({ isLoading: true, authError: null });
                try {
                    const { data, error } = await supabase.auth.signInWithPassword({
                        email,
                        password,
                    });
                    if (error) throw error;

                    // User will be set by the auth listener in layout but we can set strictly here too
                    if (data.user) {
                        // We'll fetch profile data later, for now just basic info
                        // The AuthListener will handle the real sync
                    }
                } catch (error: any) {
                    set({ authError: error.message || 'Erreur de connexion' });
                } finally {
                    set({ isLoading: false });
                }
            },

            signUp: async (formData: any) => {
                set({ isLoading: true, authError: null });
                try {
                    // Strategy: Use whatsapp number to generate a fake email for Supabase Auth
                    // email: [clean_whatsapp]@marathon.local
                    const cleanPhone = formData.whatsapp.replace(/\D/g, '');
                    const email = `${cleanPhone}@marathon.local`;
                    const password = formData.password;
                    const fullName = `${formData.firstName} ${formData.lastName}`;

                    const { data, error } = await supabase.auth.signUp({
                        email,
                        password,
                        options: {
                            data: {
                                full_name: fullName,
                                first_name: formData.firstName,
                                last_name: formData.lastName,
                                country: formData.country,
                                city: formData.city,
                                whatsapp: formData.whatsapp,
                                avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${fullName}`,
                            },
                        },
                    });
                    if (error) throw error;
                    // Success
                } catch (error: any) {
                    set({ authError: error.message || 'Erreur d\'inscription' });
                } finally {
                    set({ isLoading: false });
                }
            },

            signOut: async () => {
                set({ isLoading: true });
                try {
                    await supabase.auth.signOut();
                    set({ user: null }); // Clear user immediately
                } catch (error) {
                    console.error('Error signing out', error);
                } finally {
                    set({ isLoading: false });
                }
            },

            clearAuthError: () => set({ authError: null }),

            loadAppSettings: async () => {
                const { data } = await supabase.from('app_settings').select('key, value');
                if (data) {
                    const settingsMap = data.reduce((acc: any, s: any) => ({ ...acc, [s.key]: s.value }), {});
                    set({ appSettings: settingsMap });
                }
            },

            loadInitialData: async () => {
                get().loadAppSettings();
                const { user } = get();

                try {
                    // Load Prayers (public - accessible even without login)
                    const { data: prayers } = await supabase
                        .from('prayer_requests')
                        .select('*, profiles(full_name, avatar_url)')
                        .order('created_at', { ascending: false })
                        .limit(20);

                    if (prayers) {
                        const formattedPrayers = prayers.map((p: any) => ({
                            id: p.id,
                            userId: p.user_id,
                            userName: p.profiles?.full_name || 'Anonyme',
                            userAvatar: p.profiles?.avatar_url,
                            content: p.content,
                            isAnonymous: p.is_anonymous,
                            category: p.category,
                            photos: p.photos,
                            isAnswered: p.is_answered,
                            answeredAt: p.answered_at,
                            createdAt: p.created_at,
                            prayerCount: p.prayer_count || 0,
                            prayedBy: p.prayed_by || [],
                        }));
                        set({ prayerRequests: formattedPrayers });
                    }

                    // Load Testimonials (public)
                    const { data: testimonials } = await supabase
                        .from('testimonials')
                        .select('*, profiles(full_name, avatar_url)')
                        .eq('is_approved', true)
                        .order('created_at', { ascending: false })
                        .limit(20);

                    if (testimonials) {
                        const formattedTestimonials = testimonials.map((t: any) => ({
                            id: t.id,
                            userId: t.user_id,
                            userName: t.profiles?.full_name || 'Utilisateur',
                            userAvatar: t.profiles?.avatar_url,
                            content: t.content,
                            photos: t.photos || [],
                            createdAt: t.created_at,
                            likes: t.likes || 0,
                            likedBy: t.liked_by || [],
                        }));
                        set({ testimonials: formattedTestimonials });
                    }

                    // User-specific data requires login
                    if (!user) return;
                    // Load Progress
                    const { data: progressData } = await supabase
                        .from('user_progress')
                        .select('*')
                        .eq('user_id', user.id);

                    if (progressData && progressData.length > 0) {
                        set((state) => {
                            const newDayProgress = state.dayProgress.map(day => {
                                const serverDay = progressData.find((pd: any) => pd.day_number === day.dayNumber);
                                if (serverDay) {
                                    return {
                                        ...day,
                                        completed: serverDay.completed,
                                        completedAt: serverDay.completed_at,
                                        prayerCompleted: serverDay.prayer_completed,
                                        bibleReadingCompleted: serverDay.bible_reading_completed,
                                        fastingCompleted: serverDay.fasting_completed,
                                    };
                                }
                                return day;
                            });

                            const totalDaysCompleted = newDayProgress.filter(d => d.completed).length;

                            return {
                                dayProgress: newDayProgress,
                                totalDaysCompleted,
                            };
                        });
                        // Recalculate streak after setting progress
                        get().calculateStreak();
                    }


                } catch (error) {
                    console.error('Error loading initial data', error);
                }
            },

            // Progress
            currentDay: 1,
            startDate: null,
            dayProgress: initializeDayProgress(),
            setStartDate: (date) => set({ startDate: date }),
            updateDayProgress: async (dayNumber, progress) => {
                const { user } = get();
                // Update local state first (Optimistic UI)
                set((state) => ({
                    dayProgress: state.dayProgress.map((day) =>
                        day.dayNumber === dayNumber ? { ...day, ...progress } : day
                    ),
                }));

                // Sync with Supabase if user logged in
                if (user) {
                    try {
                        // Try upsert first, fallback to update if constraint doesn't exist
                        const { error } = await supabase
                            .from('user_progress')
                            .upsert({
                                user_id: user.id,
                                day_number: dayNumber,
                                ...progress,
                                created_at: new Date().toISOString()
                            }, { onConflict: 'user_id,day_number' });

                        if (error) {
                            // Fallback: try plain insert (ignore if already exists)
                            try {
                                await supabase
                                    .from('user_progress')
                                    .insert({
                                        user_id: user.id,
                                        day_number: dayNumber,
                                        ...progress,
                                        created_at: new Date().toISOString()
                                    });
                            } catch {
                                // Silently ignore
                            }
                        }
                    } catch (e) {
                        // Silently ignore sync errors - local state is already updated
                    }
                }
            },
            completeDay: async (dayNumber) => {
                const { user } = get();
                const completedAt = new Date().toISOString();

                // Update local state
                set((state) => {
                    const updatedProgress = state.dayProgress.map((day) =>
                        day.dayNumber === dayNumber
                            ? { ...day, completed: true, completedAt }
                            : day
                    );
                    const totalDaysCompleted = updatedProgress.filter((d) => d.completed).length;
                    return {
                        dayProgress: updatedProgress,
                        totalDaysCompleted,
                        currentDay: Math.min(dayNumber + 1, 40),
                    };
                });

                // Sync with Supabase - silently ignore errors
                if (user) {
                    try {
                        const { error } = await supabase.from('user_progress').upsert({
                            user_id: user.id,
                            day_number: dayNumber,
                            completed: true,
                            completed_at: completedAt
                        }, { onConflict: 'user_id,day_number' });

                        if (error) {
                            // Fallback: plain insert
                            try {
                                await supabase.from('user_progress').insert({
                                    user_id: user.id,
                                    day_number: dayNumber,
                                    completed: true,
                                    completed_at: completedAt
                                });
                            } catch {
                                // Silently ignore
                            }
                        }
                    } catch (e) {
                        // Silently ignore
                    }
                }
            },

            // Stats
            streak: 0,
            totalDaysCompleted: 0,
            calculateStreak: () => {
                const { dayProgress } = get();
                let streak = 0;
                for (let i = dayProgress.length - 1; i >= 0; i--) {
                    if (dayProgress[i].completed) {
                        streak++;
                    } else {
                        break;
                    }
                }
                set({ streak });
                return streak;
            },

            // Achievements
            achievements: defaultAchievements,
            unlockedAchievements: [],
            unlockAchievement: (achievementId) =>
                set((state) => {
                    if (state.unlockedAchievements.includes(achievementId)) return state;
                    return {
                        unlockedAchievements: [...state.unlockedAchievements, achievementId],
                        achievements: state.achievements.map((a) =>
                            a.id === achievementId
                                ? { ...a, unlockedAt: new Date().toISOString() }
                                : a
                        ),
                    };
                }),

            // Prayer Wall
            prayerRequests: [],
            addPrayerRequest: async (content, isAnonymous = false, category = 'other', photos = []) => {
                const { user } = get();
                if (!user) return null;

                try {
                    // Include all fields in the insert
                    const newRequest: any = {
                        user_id: user.id,
                        content,
                        is_anonymous: isAnonymous,
                        category: category || 'other',
                        photos: photos && photos.length > 0 ? photos : null,
                    };

                    // Save to Supabase
                    const { data, error } = await supabase.from('prayer_requests').insert([newRequest]).select();

                    if (error) {
                        console.error('Error adding prayer request:', error);
                        throw error;
                    }

                    if (data && data[0]) {
                        const newId = data[0].id;
                        set((state) => ({
                            prayerRequests: [{
                                id: newId,
                                userId: user.id,
                                userName: user.name,
                                userAvatar: user.avatar,
                                content,
                                isAnonymous: isAnonymous,
                                category: category || 'other',
                                photos: photos,
                                createdAt: data[0].created_at,
                                prayerCount: 0,
                                prayedBy: [],
                            }, ...state.prayerRequests]
                        }));
                        return newId;
                    }
                    return null;
                } catch (e) {
                    console.error('Failed to add prayer request:', e);
                    throw e;
                }
            },
            prayForRequest: async (requestId) => {
                const { user } = get();
                if (!user) return;

                try {
                    // First, get current prayer data
                    const { data: currentPrayer, error: fetchError } = await supabase
                        .from('prayer_requests')
                        .select('prayer_count, prayed_by')
                        .eq('id', requestId)
                        .single();

                    if (fetchError) {
                        console.error('Error fetching prayer:', fetchError);
                        return;
                    }

                    const currentPrayedBy = currentPrayer?.prayed_by || [];
                    const currentCount = currentPrayer?.prayer_count || 0;

                    // Check if user already prayed
                    if (currentPrayedBy.includes(user.id)) {
                        console.log('User already prayed for this request');
                        return;
                    }

                    // Update with new prayer
                    const { error: updateError } = await supabase
                        .from('prayer_requests')
                        .update({
                            prayer_count: currentCount + 1,
                            prayed_by: [...currentPrayedBy, user.id]
                        })
                        .eq('id', requestId);

                    if (updateError) {
                        console.error('Error updating prayer count:', updateError);
                        return;
                    }

                    // Update local state
                    set((state) => ({
                        prayerRequests: state.prayerRequests.map((req) =>
                            req.id === requestId && !req.prayedBy.includes(user.id)
                                ? {
                                    ...req,
                                    prayerCount: req.prayerCount + 1,
                                    prayedBy: [...req.prayedBy, user.id],
                                }
                                : req
                        ),
                    }));

                    // Send notification to prayer owner
                    const prayerReq = get().prayerRequests.find(p => p.id === requestId);
                    const prayerOwnerId = prayerReq?.userId;
                    if (prayerOwnerId && prayerOwnerId !== user.id) {
                        notifyPrayerPrayed({
                            prayerOwnerId,
                            prayerContent: prayerReq?.content || '',
                            prayerUserName: user.name,
                            prayerId: requestId,
                        }).catch(console.error);
                    }

                    // Notify user's friends that they prayed for this topic
                    notifyFriendPrayed({
                        userId: user.id,
                        userName: user.name,
                        prayerContent: prayerReq?.content || '',
                        prayerId: requestId,
                    }).catch(console.error);
                } catch (e) {
                    console.error('Error in prayForRequest:', e);
                }
            },

            removePrayerRequest: (requestId) => {
                set((state) => ({
                    prayerRequests: state.prayerRequests.filter(p => p.id !== requestId)
                }));
            },

            // Testimonials
            testimonials: [],
            addTestimonial: async (content, photos = []) => {
                const { user } = get();
                if (!user) return;

                try {
                    // Start with minimal fields
                    const newTestimonial: any = {
                        user_id: user.id,
                        content,
                    };

                    // Save to Supabase
                    const { data, error } = await supabase.from('testimonials').insert([newTestimonial]).select();

                    if (error) {
                        console.error('Error adding testimonial:', error);
                        throw error;
                    }

                    if (data) {
                        set((state) => ({
                            testimonials: [{
                                id: data[0].id,
                                userId: user.id,
                                userName: user.name,
                                userAvatar: user.avatar,
                                content,
                                photos,
                                createdAt: data[0].created_at,
                                likes: 0,
                                likedBy: [],
                            }, ...state.testimonials]
                        }));
                    }
                } catch (e) {
                    console.error('Failed to add testimonial:', e);
                    throw e;
                }
            },
            likeTestimonial: async (testimonialId) => {
                const { user } = get();
                if (!user) return;

                const { error } = await supabase.rpc('like_testimonial', { testimonial_id: testimonialId });

                if (!error) {
                    set((state) => ({
                        testimonials: state.testimonials.map((t) =>
                            t.id === testimonialId && !t.likedBy.includes(user.id)
                                ? {
                                    ...t,
                                    likes: t.likes + 1,
                                    likedBy: [...t.likedBy, user.id],
                                }
                                : t
                        ),
                    }));
                }
            },

            // Journal
            journalEntries: [],
            addJournalEntry: (content, mood) =>
                set((state) => ({
                    journalEntries: [
                        { date: new Date().toISOString(), content, mood },
                        ...state.journalEntries,
                    ],
                })),

            // Theme
            theme: 'system',
            setTheme: (theme) => set({ theme }),

            // Hydration
            isHydrated: false,
            setHydrated: (state) => set({ isHydrated: state }),

            // Navigation Context
            bibleNavigation: null,
            bibleViewTarget: null,
            setBibleNavigation: (nav) => set({ bibleNavigation: nav }),
            setBibleViewTarget: (target) => set({ bibleViewTarget: target }),

            // UI State
            activeTab: 'home',
            selectedDay: null,
            setActiveTab: (tab) => set({ activeTab: tab }),
            setSelectedDay: (day) => set({ selectedDay: day }),
            pendingNavigation: null,
            setPendingNavigation: (nav) => set({ pendingNavigation: nav }),
            dmRefreshSignal: null,
            triggerDMRefresh: (conversationId) => set({ dmRefreshSignal: { conversationId, timestamp: Date.now() } }),

            // Bible Persistence
            bibleHighlights: [],
            bibleFavorites: [],
            addBibleHighlight: (highlight) => set((state) => ({
                bibleHighlights: [...state.bibleHighlights.filter(h => h.id !== highlight.id), highlight]
            })),
            removeBibleHighlight: (id) => set((state) => ({
                bibleHighlights: state.bibleHighlights.filter(h => h.id !== id)
            })),
            toggleBibleFavorite: (fav) => set((state) => {
                const exists = state.bibleFavorites.find(f => f.id === fav.id && f.bibleId === fav.bibleId);
                if (exists) {
                    return { bibleFavorites: state.bibleFavorites.filter(f => !(f.id === fav.id && f.bibleId === fav.bibleId)) };
                }
                return { bibleFavorites: [...state.bibleFavorites, fav] };
            }),

            // Advanced Bible Persistence
            downloadedBibles: [DEFAULT_BIBLE_ID], // LSG downloaded by default
            toggleDownloadBible: (id) => set((state) => ({
                downloadedBibles: state.downloadedBibles.includes(id)
                    ? state.downloadedBibles.filter(bid => bid !== id)
                    : [...state.downloadedBibles, id]
            })),
            bibleSettings: {
                offlineMode: false,
                splitView: false,
                parallelBibleId: null,
            },
            setBibleSettings: (settings) => set((state) => ({
                bibleSettings: { ...state.bibleSettings, ...settings }
            })),
            dailyVerse: null,
            setDailyVerse: (verse) => set({ dailyVerse: verse }),

            // Global App Settings
            appSettings: {},
        }),
        {
            name: 'prayer-marathon-storage',
            partialize: (state) => ({
                // Sync only local prefs
                theme: state.theme,
                // UI state like activeTab shouldn't persist usually, but maybe helpful? 
                // Let's persist basic data, not navigation state for now to avoid stuck states.
                currentDay: state.currentDay,
                startDate: state.startDate,
                dayProgress: state.dayProgress,
                streak: state.streak,
                totalDaysCompleted: state.totalDaysCompleted,
                unlockedAchievements: state.unlockedAchievements,
                journalEntries: state.journalEntries,
                bibleHighlights: state.bibleHighlights,
                bibleFavorites: state.bibleFavorites,
                downloadedBibles: state.downloadedBibles,
                bibleSettings: state.bibleSettings,
                dailyVerse: state.dailyVerse,
                // Don't persist user/auth state ideally, rely on session check, 
                // but for transitioning we might keep it or clear it on load if session invalid
            }),
            onRehydrateStorage: () => (state) => {
                state?.setHydrated(true);
            },
        }
    )
);
