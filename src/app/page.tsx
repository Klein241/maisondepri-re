'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { BottomNav } from '@/components/bottom-nav';
import { useAppStore } from '@/lib/store';
import { TabType } from '@/lib/types';

// Dynamic imports to prevent TDZ errors in production bundles
// Each view loads in its own chunk, preventing circular dependency issues
const HomeView = dynamic(() => import('@/components/views/home-view').then(m => ({ default: m.HomeView })), { ssr: false });
const ProgramView = dynamic(() => import('@/components/views/program-view').then(m => ({ default: m.ProgramView })), { ssr: false });
const DayDetailView = dynamic(() => import('@/components/views/day-detail-view').then(m => ({ default: m.DayDetailView })), { ssr: false });
const BibleView = dynamic(() => import('@/components/views/bible-view').then(m => ({ default: m.BibleView })), { ssr: false });
const JournalView = dynamic(() => import('@/components/views/journal-view').then(m => ({ default: m.JournalView })), { ssr: false });
const CommunityView = dynamic(() => import('@/components/views/community-view').then(m => ({ default: m.CommunityView })), { ssr: false });
const ProfileView = dynamic(() => import('@/components/views/profile-view').then(m => ({ default: m.ProfileView })), { ssr: false });
const AuthView = dynamic(() => import('@/components/views/auth-view').then(m => ({ default: m.AuthView })), { ssr: false });

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
        <h1 className="text-3xl font-bold mb-2" suppressHydrationWarning>MAISON DE PRIERE</h1>
        <p className="text-white/80">Priez les uns pour les autres</p>
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
  const [hideNav, setHideNav] = useState(false);

  const handleHideNav = useCallback((hide: boolean) => {
    setHideNav(hide);
  }, []);

  // Force community view on load (Feed first)
  useEffect(() => {
    setActiveTab('community');
  }, []);

  // Reset hideNav when switching to non-community tab
  useEffect(() => {
    if (activeTab !== 'community') {
      setHideNav(false);
    }
  }, [activeTab]);

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
  // Guest mode allowed
  // if (!user) { return <AuthView />; }

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
        return <CommunityView onHideNav={handleHideNav} />;
      case 'profile':
        return <ProfileView />;
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
    <main className="min-h-screen bg-[#0B0E14] pb-safe overflow-y-auto overflow-x-hidden">
      <div className="min-h-screen">
        {renderContent()}
      </div>

      {/* Only show bottom nav when not viewing day detail and not in full-screen chat */}
      {selectedDay === null && !hideNav && (
        <BottomNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      )}
    </main>
  );
}
