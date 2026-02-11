'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BottomNav } from '@/components/bottom-nav';
import { HomeView } from '@/components/views/home-view';
import { ProgramView } from '@/components/views/program-view';
import { DayDetailView } from '@/components/views/day-detail-view';
import { BibleView } from '@/components/views/bible-view';
import { JournalView } from '@/components/views/journal-view';
import { CommunityView } from '@/components/views/community-view';
import { ProfileView } from '@/components/views/profile-view';
import { AuthView } from '@/components/views/auth-view';
import { useAppStore } from '@/lib/store';
import { TabType } from '@/lib/types';

// Splash screen component
function SplashScreen() {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-spiritual via-primary to-spiritual/80"
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring' }}
        className="text-center text-white"
      >
        <motion.div
          animate={{
            rotate: [0, 10, -10, 0],
            scale: [1, 1.1, 1]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatDelay: 0.5
          }}
          className="text-7xl mb-4"
        >
          🙏
        </motion.div>
        <h1 className="text-3xl font-bold mb-2">Prayer Marathon</h1>
        <p className="text-white/80">40 Jours de Jeûne et Prière</p>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: '100%' }}
          transition={{ delay: 0.5, duration: 1.5 }}
          className="mt-8 h-1 bg-white/30 rounded-full overflow-hidden mx-auto max-w-[200px]"
        >
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ duration: 1, repeat: Infinity }}
            className="h-full w-1/2 bg-white rounded-full"
          />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

export default function Home() {
  const { user, isHydrated, activeTab, setActiveTab, selectedDay, setSelectedDay } = useAppStore();
  const [showSplash, setShowSplash] = useState(true);

  // Handle splash screen duration
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // Wait for hydration or splash screen
  if (!isHydrated || showSplash) {
    return <SplashScreen />;
  }

  // If not authenticated, show Auth View
  if (!user) {
    return <AuthView />;
  }

  const handleNavigateToDay = (day: number) => {
    setSelectedDay(day);
  };

  const handleBackFromDay = () => {
    setSelectedDay(null);
  };

  const handleNavigateTo = (tab: string) => {
    setActiveTab(tab as any);
  };

  const renderContent = () => {
    // If a specific day is selected, show day detail
    if (selectedDay !== null) {
      return (
        <DayDetailView
          dayNumber={selectedDay}
          onBack={handleBackFromDay}
        />
      );
    }

    // Otherwise, show the active tab content
    switch (activeTab) {
      case 'home':
        return (
          <HomeView
            onNavigateToDay={handleNavigateToDay}
            onNavigateTo={handleNavigateTo}
          />
        );
      case 'program':
        return <ProgramView onSelectDay={handleNavigateToDay} />;
      case 'bible':
        return <BibleView />;
      case 'journal':
        return <JournalView />;
      case 'community':
        return <CommunityView />;
      case 'profile':
        return <ProfileView onBack={() => setActiveTab('home')} />;
      default:
        return (
          <HomeView
            onNavigateToDay={handleNavigateToDay}
            onNavigateTo={handleNavigateTo}
          />
        );
    }
  };

  return (
    <main className="min-h-screen bg-background safe-area-padding-bottom">
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedDay !== null ? `day-${selectedDay}` : activeTab}
          initial={{ opacity: 0, x: selectedDay !== null ? 20 : 0 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: selectedDay !== null ? -20 : 0 }}
          transition={{ duration: 0.2 }}
        >
          {renderContent()}
        </motion.div>
      </AnimatePresence>

      {/* Only show bottom nav when not viewing day detail */}
      {selectedDay === null && (
        <BottomNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      )}
    </main>
  );
}
