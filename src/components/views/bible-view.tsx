'use client';

/**
 * BIBLE VIEW - PREMIUM REDESIGN
 * ================================
 * Modern, premium Bible experience with 5 key features:
 * 1. Passage Reader – Beautiful reader with navigation, font control, verse actions
 * 2. Full-Text Search – Smart search with highlighted results grouped by book
 * 3. Highlights & Notes – Color-coded annotations and favorites management
 * 4. Reading Plans – Predefined plans with streaks and progress tracking
 * 5. Verse Memorization – Flashcard SRS system for memorizing Scripture
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { BibleHeader, BibleTab } from '@/components/bible/bible-header';
import { BibleReader } from '@/components/bible/bible-reader';
import { BibleFullSearch } from '@/components/bible/bible-full-search';
import { BibleHighlightsNotes } from '@/components/bible/bible-highlights-notes';
import { BibleReadingPlans } from '@/components/bible/bible-reading-plans';
import { BibleMemorize } from '@/components/bible/bible-memorize';

export function BibleView() {
    const {
        bibleViewTarget,
        setBibleViewTarget,
        setBibleNavigation,
    } = useAppStore();

    const [currentTab, setCurrentTab] = useState<BibleTab>('home');
    const [isReading, setIsReading] = useState(false);
    const [readerInitialBook, setReaderInitialBook] = useState<string | undefined>();
    const [readerInitialChapter, setReaderInitialChapter] = useState<string | undefined>();

    // Handle navigation targets from other parts of the app
    useEffect(() => {
        if (bibleViewTarget) {
            const mapping: Record<string, BibleTab> = {
                'home': 'home',
                'read': 'home',
                'search': 'search',
                'favorites': 'highlights',
                'study': 'plans',
                'games': 'home',
            };
            setCurrentTab(mapping[bibleViewTarget] || 'home');
            if (bibleViewTarget === 'read') setIsReading(true);
            setBibleViewTarget(null);
        }
    }, [bibleViewTarget]);

    const handleTabChange = (tab: BibleTab) => {
        if (tab === 'home' && isReading) {
            setIsReading(false);
            return;
        }
        setCurrentTab(tab);
        setIsReading(false);
    };

    const handleNavigateToChapter = (bookId: string, chapterId: string) => {
        setReaderInitialBook(bookId);
        const ch = chapterId.includes('.') ? chapterId.split('.')[1] : chapterId;
        setReaderInitialChapter(ch);
        setCurrentTab('home');
        setIsReading(true);
    };

    return (
        <div className="flex flex-col h-full bg-[#0B0E14] text-white overflow-hidden">
            {/* Ambient background */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/[0.04] rounded-full blur-[120px]" />
                <div className="absolute bottom-1/4 right-0 w-72 h-72 bg-purple-600/[0.04] rounded-full blur-[100px]" />
            </div>

            <div className="relative z-10 flex flex-col h-full">
                {/* Header with navigation */}
                {!isReading && (
                    <BibleHeader
                        currentTab={currentTab}
                        onTabChange={handleTabChange}
                        title={currentTab === 'home' ? 'Bible' : undefined}
                        subtitle="Louis Segond"
                    />
                )}

                {/* Content Area */}
                <LayoutGroup>
                    <AnimatePresence mode="wait">
                        {/* Reader View */}
                        {(currentTab === 'home' && isReading) && (
                            <motion.div
                                key="reader"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.25 }}
                                className="flex-1 flex flex-col overflow-hidden"
                            >
                                <BibleReader
                                    onBack={() => setIsReading(false)}
                                    initialBookId={readerInitialBook}
                                    initialChapter={readerInitialChapter}
                                />
                            </motion.div>
                        )}

                        {/* Home / Book Explorer */}
                        {(currentTab === 'home' && !isReading) && (
                            <motion.div
                                key="home"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="flex-1 flex flex-col overflow-hidden"
                            >
                                <BibleReader
                                    onBack={() => { }}
                                    initialBookId={undefined}
                                    initialChapter={undefined}
                                />
                            </motion.div>
                        )}

                        {/* Search */}
                        {currentTab === 'search' && (
                            <motion.div
                                key="search"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="flex-1 flex flex-col overflow-hidden"
                            >
                                <BibleFullSearch onNavigate={handleNavigateToChapter} />
                            </motion.div>
                        )}

                        {/* Highlights & Notes */}
                        {currentTab === 'highlights' && (
                            <motion.div
                                key="highlights"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="flex-1 flex flex-col overflow-hidden"
                            >
                                <BibleHighlightsNotes onNavigate={handleNavigateToChapter} />
                            </motion.div>
                        )}

                        {/* Reading Plans */}
                        {currentTab === 'plans' && (
                            <motion.div
                                key="plans"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="flex-1 flex flex-col overflow-hidden"
                            >
                                <BibleReadingPlans />
                            </motion.div>
                        )}

                        {/* Memorization */}
                        {currentTab === 'memorize' && (
                            <motion.div
                                key="memorize"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="flex-1 flex flex-col overflow-hidden"
                            >
                                <BibleMemorize />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </LayoutGroup>
            </div>
        </div>
    );
}

// Backward compatibility export
export { BibleSearch } from '@/components/views/bible-search';
