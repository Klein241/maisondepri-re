'use client';

import { motion } from 'framer-motion';
import { Home, BookOpen, MessageCircle, User, Compass, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TabType } from '@/lib/types';

interface BottomNavProps {
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
    const navItems = [
        { id: 'home', icon: Home, label: 'Accueil', highlight: false },
        { id: 'program', icon: Compass, label: 'Programme', highlight: false },
        { id: 'community', icon: MessageSquare, label: 'Messages', highlight: true },
        { id: 'bible', icon: BookOpen, label: 'Bible', highlight: false },
        { id: 'profile', icon: User, label: 'Profil', highlight: false },
    ] as const;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-[env(safe-area-inset-bottom,0px)] bg-gradient-to-t from-[#0B0E14] via-[#0B0E14]/95 to-transparent pt-3">
            <div className="glass-card flex items-center p-1.5 gap-0.5 bg-[#0F172A]/95 backdrop-blur-xl border-white/10 shadow-[0_-4px_24px_rgba(0,0,0,0.5)] rounded-2xl w-full max-w-sm mx-auto justify-between px-2">
                {navItems.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onTabChange(item.id)}
                            className={cn(
                                "relative flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all duration-300",
                                isActive ? "text-primary" : "text-slate-500 hover:text-slate-300",
                                item.highlight && !isActive && "text-indigo-400"
                            )}
                        >
                            {/* Highlight pulse for Messages tab */}
                            {item.highlight && !isActive && (
                                <div className="absolute top-1 right-1.5">
                                    <span className="relative flex h-2.5 w-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                                    </span>
                                </div>
                            )}
                            <div className={cn(
                                "p-1.5 rounded-full transition-all duration-300",
                                isActive ? "bg-primary/10 translate-y-[-2px]" : "",
                                item.highlight && isActive ? "bg-indigo-500/20" : ""
                            )}>
                                <item.icon
                                    className={cn(
                                        "w-5 h-5 transition-transform duration-300",
                                        isActive && ""
                                    )}
                                    strokeWidth={isActive ? 2.5 : 2}
                                />
                            </div>
                            <span className={cn(
                                "text-[10px] font-medium transition-all duration-300 mt-1",
                                isActive ? "opacity-100 font-semibold" : "opacity-70",
                                item.highlight && !isActive ? "text-indigo-400 font-semibold opacity-100" : ""
                            )}>
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
