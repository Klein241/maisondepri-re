'use client';

import { Home, BookOpen, User, MessageSquare, BookMarked } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TabType } from '@/lib/types';

interface BottomNavProps {
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
    const navItems: { id: TabType; icon: any; label: string; color?: string }[] = [
        { id: 'home', icon: Home, label: 'Accueil' },
        { id: 'community', icon: MessageSquare, label: 'Messages', color: 'indigo' },
        { id: 'library', icon: BookMarked, label: 'Livres', color: 'emerald' },
        { id: 'bible', icon: BookOpen, label: 'Bible' },
        { id: 'profile', icon: User, label: 'Profil' },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-[env(safe-area-inset-bottom,0px)] bg-linear-to-t from-[#0B0E14] via-[#0B0E14]/95 to-transparent pt-3">
            <div className="glass-card flex items-center p-1.5 gap-0.5 bg-[#0F172A]/95 backdrop-blur-xl border-white/10 shadow-[0_-4px_24px_rgba(0,0,0,0.5)] rounded-2xl w-full max-w-sm mx-auto justify-between px-2">
                {navItems.map((item) => {
                    const isActive = activeTab === item.id;
                    const isGames = item.color === 'emerald';
                    const isMessages = item.color === 'indigo';
                    const hasHighlight = !!item.color;

                    return (
                        <button
                            key={item.id}
                            onClick={() => onTabChange(item.id)}
                            className={cn(
                                "relative flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all duration-300",
                                isActive ? "text-primary" : "text-slate-500 hover:text-slate-300",
                                isMessages && !isActive && "text-indigo-400",
                                isGames && !isActive && "text-emerald-400",
                            )}
                        >
                            {/* Pulsing dot for highlighted tabs */}
                            {hasHighlight && !isActive && (
                                <div className="absolute top-1 right-1.5">
                                    <span className="relative flex h-2.5 w-2.5">
                                        <span className={cn(
                                            "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                                            isGames ? "bg-emerald-400" : "bg-indigo-400"
                                        )} />
                                        <span className={cn(
                                            "relative inline-flex rounded-full h-2.5 w-2.5",
                                            isGames ? "bg-emerald-500" : "bg-indigo-500"
                                        )} />
                                    </span>
                                </div>
                            )}
                            <div className={cn(
                                "p-1.5 rounded-full transition-all duration-300",
                                isActive && "translate-y-[-2px]",
                                isActive && isGames && "bg-emerald-500/20",
                                isActive && isMessages && "bg-indigo-500/20",
                                isActive && !item.color && "bg-primary/10",
                            )}>
                                <item.icon
                                    className="w-5 h-5 transition-transform duration-300"
                                    strokeWidth={isActive ? 2.5 : 2}
                                />
                            </div>
                            <span className={cn(
                                "text-[10px] font-medium transition-all duration-300 mt-1",
                                isActive ? "opacity-100 font-semibold" : "opacity-70",
                                isMessages && !isActive && "text-indigo-400 font-semibold opacity-100",
                                isGames && !isActive && "text-emerald-400 font-semibold opacity-100",
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
