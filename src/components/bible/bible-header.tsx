'use client';

import { Button } from "@/components/ui/button";
import { Search, Star, BookOpen, Brain, CalendarDays, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export type BibleTab = 'home' | 'read' | 'search' | 'highlights' | 'plans' | 'memorize';

interface BibleHeaderProps {
    currentTab: BibleTab;
    onTabChange: (tab: BibleTab) => void;
    title?: string;
    subtitle?: string;
    showBack?: boolean;
}

const NAV_ITEMS: { id: BibleTab; label: string; icon: React.ReactNode; gradient: string }[] = [
    { id: 'home', label: 'Lecture', icon: <BookOpen className="h-4 w-4" />, gradient: 'from-indigo-500 to-violet-500' },
    { id: 'search', label: 'Recherche', icon: <Search className="h-4 w-4" />, gradient: 'from-amber-500 to-orange-500' },
    { id: 'highlights', label: 'Notes', icon: <Star className="h-4 w-4" />, gradient: 'from-emerald-500 to-teal-500' },
    { id: 'plans', label: 'Plans', icon: <CalendarDays className="h-4 w-4" />, gradient: 'from-rose-500 to-pink-500' },
    { id: 'memorize', label: 'Mémoriser', icon: <Brain className="h-4 w-4" />, gradient: 'from-purple-500 to-fuchsia-500' },
];

export function BibleHeader({ currentTab, onTabChange, title, subtitle, showBack }: BibleHeaderProps) {
    return (
        <header className="relative z-40">
            {/* Title bar */}
            <div className="px-5 pt-10 pb-3 flex items-center justify-between">
                {showBack ? (
                    <Button variant="ghost" size="icon" className="rounded-2xl text-slate-400 hover:text-white" onClick={() => onTabChange('home')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                ) : (
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                            <BookOpen className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-white">{title || 'Bible'}</h1>
                            {subtitle && <p className="text-[11px] text-slate-500 font-medium">{subtitle}</p>}
                        </div>
                    </div>
                )}
                {showBack && (
                    <h2 className="text-lg font-black text-white flex-1 text-center">{title}</h2>
                )}
                {showBack && <div className="w-10" />}
            </div>

            {/* Navigation pills */}
            {!showBack && (
                <div className="px-4 pb-3">
                    <div className="flex gap-1.5 bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-1.5">
                        {NAV_ITEMS.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => onTabChange(item.id)}
                                className={cn(
                                    "relative flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-[10px] font-bold transition-all duration-300",
                                    currentTab === item.id
                                        ? "text-white"
                                        : "text-slate-500 hover:text-slate-300"
                                )}
                            >
                                {currentTab === item.id && (
                                    <motion.div
                                        layoutId="bible-nav-pill"
                                        className={cn("absolute inset-0 rounded-xl bg-gradient-to-r opacity-90", item.gradient)}
                                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                    />
                                )}
                                <span className="relative z-10">{item.icon}</span>
                                <span className="relative z-10 tracking-wide">{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </header>
    );
}
