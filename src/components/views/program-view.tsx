'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, ChevronDown, CheckCircle2, Flame, BookOpen, Calendar, Trophy, Target, Sparkles, TrendingUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DayCard } from '@/components/day-card';
import { programData } from '@/lib/program-data';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface ProgramViewProps {
    onSelectDay: (day: number) => void;
}

export function ProgramView({ onSelectDay }: ProgramViewProps) {
    const { currentDay, dayProgress, streak } = useAppStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<'all' | 'completed' | 'pending'>('all');
    const [expandedWeek, setExpandedWeek] = useState<number | null>(
        Math.ceil(currentDay / 7) // Auto-expand current week
    );

    // Stats
    const completedCount = dayProgress.filter(p => p.completed).length;
    const totalDays = programData.length;
    const progressPercent = Math.round((completedCount / totalDays) * 100);

    const filteredProgram = useMemo(() => programData.filter(day => {
        const progress = dayProgress.find(p => p.dayNumber === day.day);
        const matchesSearch =
            day.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            day.theme.toLowerCase().includes(searchQuery.toLowerCase());

        if (!matchesSearch) return false;

        if (filter === 'completed') return progress?.completed;
        if (filter === 'pending') return !progress?.completed;
        return true;
    }), [searchQuery, filter, dayProgress]);

    // Group days by week
    const weeks = useMemo(() => Array.from({ length: 6 }, (_, i) => ({
        week: i + 1,
        days: filteredProgram.filter(d => Math.ceil(d.day / 7) === i + 1),
        completedInWeek: filteredProgram
            .filter(d => Math.ceil(d.day / 7) === i + 1)
            .filter(d => dayProgress.find(p => p.dayNumber === d.day)?.completed).length,
        totalInWeek: programData.filter(d => Math.ceil(d.day / 7) === i + 1).length,
    })).filter(w => w.days.length > 0), [filteredProgram, dayProgress]);

    const weekNames = [
        'Fondation & Préparation',
        'Croissance Spirituelle',
        'Persévérance',
        'Approfondissement',
        'Transformation',
        'Accomplissement & Récolte'
    ];

    return (
        <div className="relative min-h-screen pb-28 bg-gradient-to-b from-[#0B0E14] to-[#0F1219] text-white">
            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] bg-indigo-600/5 blur-[150px] rounded-full" />
                <div className="absolute bottom-[-20%] left-[-20%] w-[50%] h-[50%] bg-purple-600/5 blur-[150px] rounded-full" />
            </div>
            <div className="relative z-10 max-w-4xl mx-auto w-full">
                {/* Hero Header */}
                <div className="relative overflow-hidden">
                    {/* Background glow */}
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-[-30%] left-[-20%] w-[60%] h-[80%] bg-indigo-600/15 blur-[100px] rounded-full" />
                        <div className="absolute top-[-10%] right-[-20%] w-[50%] h-[70%] bg-purple-600/10 blur-[100px] rounded-full" />
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="relative z-10 px-5 pt-12 pb-6"
                    >
                        <div className="flex items-center justify-between mb-1">
                            <div>
                                <h1 className="text-3xl font-black text-white tracking-tight">
                                    Programme
                                </h1>
                                <p className="text-slate-400 text-sm mt-1 font-medium">
                                    40 jours de jeûne et prière
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {streak > 0 && (
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="flex items-center gap-1.5 bg-orange-500/15 border border-orange-500/30 px-3 py-1.5 rounded-xl"
                                    >
                                        <Flame className="w-4 h-4 text-orange-400" />
                                        <span className="text-sm font-bold text-orange-300">{streak}</span>
                                    </motion.div>
                                )}
                            </div>
                        </div>

                        {/* Progress Overview Card */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="mt-5 bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/10 rounded-2xl p-5 backdrop-blur-sm"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 flex items-center justify-center border border-indigo-500/20">
                                        <Target className="w-6 h-6 text-indigo-400" />
                                    </div>
                                    <div>
                                        <p className="text-white font-bold text-lg leading-none">{completedCount}/{totalDays}</p>
                                        <p className="text-slate-500 text-xs mt-0.5">jours accomplis</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-3xl font-black bg-gradient-to-r from-indigo-300 to-purple-300 bg-clip-text text-transparent">
                                        {progressPercent}%
                                    </span>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progressPercent}%` }}
                                    transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
                                />
                            </div>

                            {/* Mini Stats */}
                            <div className="grid grid-cols-3 gap-3 mt-4">
                                <div className="text-center">
                                    <div className="text-white font-bold">{currentDay}</div>
                                    <div className="text-[10px] text-slate-500 uppercase font-medium">Jour actuel</div>
                                </div>
                                <div className="text-center border-x border-white/5">
                                    <div className="text-white font-bold">{totalDays - completedCount}</div>
                                    <div className="text-[10px] text-slate-500 uppercase font-medium">Restants</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-white font-bold">{streak}</div>
                                    <div className="text-[10px] text-slate-500 uppercase font-medium">Série</div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                </div>

                {/* Search and Filter */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="px-5 mb-4"
                >
                    <div className="relative mb-3">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <Input
                            placeholder="Rechercher un jour, un thème..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-11 bg-white/5 border-white/10 text-white placeholder:text-slate-600 rounded-xl h-11 focus:border-indigo-500/50 focus:ring-indigo-500/20"
                        />
                    </div>
                    <div className="flex gap-2">
                        {([
                            { key: 'all', label: 'Tous', icon: BookOpen },
                            { key: 'completed', label: 'Terminés', icon: CheckCircle2 },
                            { key: 'pending', label: 'En attente', icon: Calendar },
                        ] as const).map(({ key, label, icon: Icon }) => (
                            <Button
                                key={key}
                                variant="ghost"
                                size="sm"
                                onClick={() => setFilter(key)}
                                className={cn(
                                    "flex-1 rounded-xl h-9 text-xs font-bold transition-all",
                                    filter === key
                                        ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                                        : "bg-white/5 text-slate-500 border border-white/5 hover:bg-white/10"
                                )}
                            >
                                <Icon className="w-3.5 h-3.5 mr-1.5" />
                                {label}
                            </Button>
                        ))}
                    </div>
                </motion.div>

                {/* Current Day Quick Action */}
                {filter === 'all' && !searchQuery && (
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                        className="px-5 mb-5"
                    >
                        <button
                            onClick={() => onSelectDay(currentDay)}
                            className="w-full bg-gradient-to-r from-indigo-600/30 to-purple-600/30 border border-indigo-500/30 rounded-2xl p-4 flex items-center gap-4 group hover:border-indigo-500/50 transition-all active:scale-[0.98]"
                        >
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-600/30">
                                <span className="text-xl font-black text-white">{currentDay}</span>
                            </div>
                            <div className="flex-1 text-left">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400">Aujourd'hui</span>
                                    <Sparkles className="w-3 h-3 text-indigo-400" />
                                </div>
                                <p className="text-white font-bold text-sm mt-0.5 line-clamp-1">
                                    {programData.find(d => d.day === currentDay)?.title || `Jour ${currentDay}`}
                                </p>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                                <TrendingUp className="w-5 h-5 text-indigo-400" />
                            </div>
                        </button>
                    </motion.div>
                )}

                {/* Days Grid by Week (Accordion Style) */}
                <div className="px-5 space-y-3">
                    {weeks.map((week, weekIndex) => {
                        const isExpanded = expandedWeek === week.week;
                        const weekProgress = week.totalInWeek > 0 ? Math.round((week.completedInWeek / week.totalInWeek) * 100) : 0;
                        const isCurrentWeek = Math.ceil(currentDay / 7) === week.week;

                        return (
                            <motion.div
                                key={week.week}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 + weekIndex * 0.05 }}
                            >
                                {/* Week Header (clickable) */}
                                <button
                                    onClick={() => setExpandedWeek(isExpanded ? null : week.week)}
                                    className={cn(
                                        "w-full flex items-center justify-between p-4 rounded-2xl transition-all",
                                        isExpanded
                                            ? "bg-white/[0.06] border border-white/10"
                                            : "bg-white/[0.03] border border-white/5 hover:bg-white/[0.05]",
                                        isCurrentWeek && !isExpanded && "border-indigo-500/30"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black",
                                            weekProgress === 100
                                                ? "bg-green-500/20 text-green-400"
                                                : isCurrentWeek
                                                    ? "bg-indigo-500/20 text-indigo-400"
                                                    : "bg-white/5 text-slate-500"
                                        )}>
                                            {weekProgress === 100 ? (
                                                <Trophy className="w-5 h-5" />
                                            ) : (
                                                <span>S{week.week}</span>
                                            )}
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-bold text-white">
                                                Semaine {week.week}
                                            </p>
                                            <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                                                {weekNames[week.week - 1] || ''} • {week.completedInWeek}/{week.totalInWeek}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {/* Mini progress */}
                                        <div className="w-12 h-1.5 bg-white/5 rounded-full overflow-hidden hidden sm:block">
                                            <div
                                                className={cn(
                                                    "h-full rounded-full transition-all",
                                                    weekProgress === 100 ? "bg-green-500" : "bg-indigo-500"
                                                )}
                                                style={{ width: `${weekProgress}%` }}
                                            />
                                        </div>
                                        <motion.div
                                            animate={{ rotate: isExpanded ? 180 : 0 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            <ChevronDown className="w-5 h-5 text-slate-500" />
                                        </motion.div>
                                    </div>
                                </button>

                                {/* Week Content */}
                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                                            className="overflow-hidden"
                                        >
                                            <div className="grid grid-cols-2 gap-3 pt-3">
                                                {week.days.map((day) => {
                                                    const progress = dayProgress.find(p => p.dayNumber === day.day);
                                                    const isUnlocked = day.day <= currentDay || (progress?.completed ?? false);
                                                    const isCurrent = day.day === currentDay;
                                                    const isStreak = progress?.completed && streak > 1;

                                                    return (
                                                        <DayCard
                                                            key={day.day}
                                                            day={day.day}
                                                            title={day.title}
                                                            isCompleted={progress?.completed ?? false}
                                                            isUnlocked={isUnlocked}
                                                            isCurrent={isCurrent}
                                                            isStreak={isStreak || false}
                                                            onClick={() => onSelectDay(day.day)}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Empty State */}
                {filteredProgram.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center py-16 px-6"
                    >
                        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                            <Search className="w-8 h-8 text-slate-600" />
                        </div>
                        <p className="text-slate-500 text-center font-medium">
                            Aucun jour ne correspond à votre recherche.
                        </p>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setSearchQuery(''); setFilter('all'); }}
                            className="mt-3 text-indigo-400 hover:text-indigo-300"
                        >
                            Réinitialiser les filtres
                        </Button>
                    </motion.div>
                )}
        </div>
        </div>
    );
}
