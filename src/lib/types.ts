// Types for the Prayer Marathon App - V3 Extended
// ================================================

export interface DailyProgram {
    day: number;
    title: string;
    theme: string;
    bibleReading: {
        reference: string;
        passage: string;
    };
    prayerFocus: string[];
    meditation: string;
    practicalAction: string;
}

export interface BibleVerse {
    reference: string;
    text: string;
    version: string;
}

export interface User {
    id: string;
    email: string;
    name: string;
    avatar?: string;
    role?: 'user' | 'admin' | 'moderator';
    joinedAt: string;
    phone?: string;
    city?: string;
    church?: string;
    country?: string;
}

export interface DayProgress {
    dayNumber: number;
    completed: boolean;
    completedAt?: string;
    prayerCompleted: boolean;
    bibleReadingCompleted: boolean;
    fastingCompleted: boolean;
    journalEntry?: string;
}

// Prayer Categories
export type PrayerCategory =
    | 'healing'
    | 'family'
    | 'provision'
    | 'guidance'
    | 'spiritual'
    | 'work'
    | 'relationships'
    | 'protection'
    | 'thanksgiving'
    | 'other';

export interface PrayerCategoryInfo {
    id: PrayerCategory;
    nameFr: string;
    nameEn: string;
    icon: string;
    color: string;
}

export const PRAYER_CATEGORIES: PrayerCategoryInfo[] = [
    { id: 'healing', nameFr: 'Guérison', nameEn: 'Healing', icon: '🏥', color: '#ef4444' },
    { id: 'family', nameFr: 'Famille', nameEn: 'Family', icon: '👨‍👩‍👧‍👦', color: '#f97316' },
    { id: 'provision', nameFr: 'Provision', nameEn: 'Provision', icon: '💰', color: '#eab308' },
    { id: 'guidance', nameFr: 'Direction', nameEn: 'Guidance', icon: '🧭', color: '#22c55e' },
    { id: 'spiritual', nameFr: 'Spirituel', nameEn: 'Spiritual', icon: '🙏', color: '#8b5cf6' },
    { id: 'work', nameFr: 'Travail', nameEn: 'Work', icon: '💼', color: '#3b82f6' },
    { id: 'relationships', nameFr: 'Relations', nameEn: 'Relationships', icon: '💕', color: '#ec4899' },
    { id: 'protection', nameFr: 'Protection', nameEn: 'Protection', icon: '🛡️', color: '#14b8a6' },
    { id: 'thanksgiving', nameFr: 'Action de grâce', nameEn: 'Thanksgiving', icon: '🙌', color: '#f59e0b' },
    { id: 'other', nameFr: 'Autre', nameEn: 'Other', icon: '✨', color: '#6b7280' },
];

export interface PrayerRequest {
    id: string;
    userId: string;
    userName: string;
    userAvatar?: string;
    content: string;
    createdAt: string;
    prayerCount: number;
    prayedBy: string[];
    isAnonymous?: boolean;
    category: PrayerCategory;
    photos?: string[];
    isAnswered?: boolean;
    answeredAt?: string;
    isLocked?: boolean;
    groupId?: string;
}

export interface Testimonial {
    id: string;
    userId: string;
    userName: string;
    userAvatar?: string;
    content: string;
    createdAt: string;
    likes: number;
    likedBy: string[];
    photos?: string[];
}

export interface JournalEntry {
    id: string;
    date: string;
    content: string;
    mood?: 'joyful' | 'peaceful' | 'grateful' | 'hopeful' | 'reflective' | 'struggling';
    tags?: string[];
}

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

export interface Notification {
    id: string;
    type: 'reminder' | 'achievement' | 'community' | 'encouragement' | 'prayer_answered' | 'new_message';
    title: string;
    message: string;
    createdAt: string;
    read: boolean;
    actionUrl?: string;
}

// Day Resources (Admin can add media for each day)
export type ResourceType = 'image' | 'video' | 'pdf' | 'text' | 'audio';

export interface DayResource {
    id: string;
    dayNumber: number;
    resourceType: ResourceType;
    title: string;
    description?: string;
    url?: string;
    content?: string;
    sortOrder: number;
    isActive: boolean;
    createdAt: string;
}

// Day View Tracking
export interface DayView {
    id: string;
    userId: string;
    dayNumber: number;
    viewedAt: string;
    durationSeconds: number;
}

// Prayer Groups
export interface PrayerGroup {
    id: string;
    prayerRequestId?: string;
    name: string;
    description?: string;
    createdBy: string;
    isOpen: boolean;
    isAnswered: boolean;
    answeredAt?: string;
    maxMembers: number;
    memberCount?: number;
    createdAt: string;
    creator?: {
        fullName: string;
        avatarUrl?: string;
    };
}

export interface PrayerGroupMember {
    id: string;
    groupId: string;
    userId: string;
    role: 'admin' | 'moderator' | 'member';
    joinedAt: string;
    user?: {
        fullName: string;
        avatarUrl?: string;
    };
}

export interface PrayerGroupMessage {
    id: string;
    groupId: string;
    userId: string;
    content: string;
    isPrayer: boolean;
    createdAt: string;
    user?: {
        fullName: string;
        avatarUrl?: string;
    };
}

// Direct Messages
export interface DirectMessage {
    id: string;
    senderId: string;
    receiverId: string;
    content: string;
    isRead: boolean;
    createdAt: string;
    sender?: {
        fullName: string;
        avatarUrl?: string;
    };
}

export interface Conversation {
    id: string;
    recipientId: string;
    recipientName: string;
    recipientAvatar?: string;
    lastMessage: string;
    lastMessageAt: string;
    unreadCount: number;
}

// Bible Games
export type GameType = 'quiz' | 'memory' | 'word_search' | 'crossword' | 'verse_order';
export type GameDifficulty = 'easy' | 'medium' | 'hard';

export interface BibleGameResult {
    id: string;
    userId: string;
    gameType: GameType;
    score: number;
    maxScore: number;
    timeSeconds?: number;
    difficulty: GameDifficulty;
    metadata?: Record<string, any>;
    playedAt: string;
}

export interface LeaderboardEntry {
    userId: string;
    userName: string;
    userAvatar?: string;
    totalScore: number;
    gamesPlayed: number;
    averageScore: number;
    rank: number;
}

export type TabType = 'home' | 'program' | 'bible' | 'journal' | 'community' | 'profile' | 'games';

export interface AppSettings {
    notifications: {
        dailyReminder: boolean;
        reminderTime: string;
        prayerWallUpdates: boolean;
        achievementAlerts: boolean;
        newMessageAlerts: boolean;
    };
    privacy: {
        showProfilePublicly: boolean;
        showProgressPublicly: boolean;
        allowDirectMessages: boolean;
    };
    accessibility: {
        fontSize: 'small' | 'medium' | 'large';
        highContrast: boolean;
    };
}

// Bible API Types
export interface BibleVersion {
    id: string;
    name: string;
    abbreviation: string;
    language: string;
    description: string;
    hasAudio?: boolean;
}

export interface BibleBookInfo {
    id: string;
    bibleId: string;
    abbreviation: string;
    name: string;
    nameLong: string;
    chapters: number;
    testament: 'OT' | 'NT';
}

export interface BibleSearchResult {
    id: string;
    reference: string;
    text: string;
    bookId: string;
    chapterId: string;
}

// Admin Stats
export interface AdminStats {
    totalUsers: number;
    activeUsers: number;
    totalPrayers: number;
    answeredPrayers: number;
    totalTestimonials: number;
    totalJournalEntries: number;
    averageProgress: number;
    dailyActiveUsers: number[];
    prayersByCategory: Record<PrayerCategory, number>;
    recentViews: DayView[];
}
