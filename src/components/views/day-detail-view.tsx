'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronLeft,
    ChevronRight,
    BookOpen,
    CheckCircle2,
    Share2,
    Bookmark,
    MessageSquare,
    ArrowLeft,
    FileText,
    Video,
    Play,
    Image as ImageIcon,
    Music,
    File,
    ExternalLink,
    Loader2,
    Download,
    Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { getDay, getTotalDays } from '@/lib/program-data';
import { bibleApi } from '@/lib/unified-bible-api';
import { supabase } from '@/lib/supabase';
import { DayResource } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DayDetailViewProps {
    dayNumber: number;
    onBack: () => void;
}

export function DayDetailView({ dayNumber: initialDay, onBack }: DayDetailViewProps) {
    const [currentDayNum, setCurrentDayNum] = useState(initialDay);
    const { dayProgress, updateDayProgress, completeDay, streak, user } = useAppStore();
    const viewStartTime = useRef<Date | null>(null);

    // Resources state
    const [resources, setResources] = useState<DayResource[]>([]);
    const [loadingResources, setLoadingResources] = useState(true);

    const dayData = getDay(currentDayNum);
    const progress = dayProgress.find(p => p.dayNumber === currentDayNum);
    const totalDays = getTotalDays();

    // Load resources for the current day
    useEffect(() => {
        const loadResources = async () => {
            setLoadingResources(true);
            try {
                const { data, error } = await supabase
                    .from('day_resources')
                    .select('*')
                    .eq('day_number', currentDayNum)
                    .eq('is_active', true)
                    .order('sort_order', { ascending: true });

                if (!error && data) {
                    setResources(data.map((r: any) => ({
                        id: r.id,
                        dayNumber: r.day_number,
                        resourceType: r.resource_type,
                        title: r.title,
                        description: r.description,
                        url: r.url,
                        content: r.content,
                        sortOrder: r.sort_order,
                        isActive: r.is_active,
                        createdAt: r.created_at
                    })));
                }
            } catch (e) {
                console.error('Error loading resources:', e);
            }
            setLoadingResources(false);
        };

        loadResources();
    }, [currentDayNum]);

    // Track day view for realtime admin monitoring
    // Note: day_views table may not exist yet - silently ignore errors
    useEffect(() => {
        if (!user) return;

        viewStartTime.current = new Date();

        // Insert initial view record - silently fail if table doesn't exist
        const insertView = async () => {
            try {
                const { error } = await supabase.from('day_views').insert({
                    user_id: user.id,
                    day_number: currentDayNum,
                    viewed_at: new Date().toISOString(),
                    duration_seconds: 0
                });
                // Silently ignore 404 (table not found) and 406 errors
                if (error && error.code !== '42P01' && !error.message?.includes('404')) {
                    // Only log unexpected errors
                }
            } catch (e) {
                // Silently ignore - table may not exist
            }
        };

        insertView();

        // Update duration on unmount or day change
        return () => {
            if (viewStartTime.current && user) {
                const durationSeconds = Math.floor(
                    (new Date().getTime() - viewStartTime.current.getTime()) / 1000
                );

                // Update the view with duration (fire and forget)
                supabase.from('day_views')
                    .update({ duration_seconds: durationSeconds })
                    .eq('user_id', user.id)
                    .eq('day_number', currentDayNum)
                    .order('viewed_at', { ascending: false })
                    .limit(1)
                    .then(() => { })
                    .catch(() => { }); // Silently ignore
            }
        };
    }, [currentDayNum, user]);

    const handleNext = () => {
        if (currentDayNum < totalDays) setCurrentDayNum(prev => prev + 1);
    };

    const handlePrev = () => {
        if (currentDayNum > 1) setCurrentDayNum(prev => prev - 1);
    };

    const toggleTask = (task: 'prayer' | 'bible' | 'fasting') => {
        const field = task === 'prayer' ? 'prayerCompleted' :
            task === 'bible' ? 'bibleReadingCompleted' : 'fastingCompleted';
        updateDayProgress(currentDayNum, { [field]: !progress?.[field] });
    };

    // Helper to get resource icon
    const getResourceIcon = (type: string) => {
        switch (type) {
            case 'video': return <Video className="w-5 h-5" />;
            case 'pdf': return <FileText className="w-5 h-5" />;
            case 'audio': return <Music className="w-5 h-5" />;
            case 'image': return <ImageIcon className="w-5 h-5" />;
            case 'text': return <File className="w-5 h-5" />;
            default: return <File className="w-5 h-5" />;
        }
    };

    if (!dayData) return null;

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#0B0E14] to-[#0F1219] text-white pb-12 overflow-x-hidden">
            {/* Dynamic Background Glows */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600/20 blur-[120px] rounded-full" />
                <div className="absolute bottom-[10%] right-[-10%] w-[60%] h-[60%] bg-blue-600/10 blur-[120px] rounded-full" />
            </div>

            {/* Top Header */}
            <header className="relative z-10 px-6 pt-12 pb-6 flex items-center justify-between">
                <Button variant="ghost" size="icon" onClick={onBack} className="text-slate-400 hover:text-white">
                    <ArrowLeft className="w-6 h-6" />
                </Button>
                <div className="flex gap-2">
                    <Button variant="ghost" size="icon" className="text-slate-400">
                        <Bookmark className="w-5 h-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-slate-400">
                        <Share2 className="w-5 h-5" />
                    </Button>
                </div>
            </header>

            <main className="relative z-10 px-6 max-w-lg mx-auto">
                {/* Day Counter & Date */}
                <div className="mb-8 flex items-baseline justify-between">
                    <div>
                        <h1 className="text-5xl font-bold font-inter">
                            Jour <span className="text-slate-400 text-3xl font-medium">/ 40</span>
                        </h1>
                        <h2 className="text-6xl font-bold mt-[-8px] text-white">{currentDayNum}</h2>
                    </div>
                    <div className="text-right">
                        <p className="text-slate-400 text-sm uppercase tracking-widest font-medium">
                            {format(new Date(), 'dd MMMM', { locale: fr })}
                        </p>
                    </div>
                </div>

                {/* Swipe Control Area */}
                <div className="relative group">
                    {/* Navigation Arrows (Visible on Desktop, simulated swipe indicators on Mobile) */}
                    <button
                        onClick={handlePrev}
                        className={cn(
                            "absolute left-[-40px] top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-white transition-colors hidden md:block",
                            currentDayNum === 1 && "opacity-0 pointer-events-none"
                        )}
                    >
                        <ChevronLeft className="w-8 h-8" />
                    </button>

                    <button
                        onClick={handleNext}
                        className={cn(
                            "absolute right-[-40px] top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-white transition-colors hidden md:block",
                            currentDayNum === totalDays && "opacity-0 pointer-events-none"
                        )}
                    >
                        <ChevronRight className="w-8 h-8" />
                    </button>

                    {/* Main Content Card (Glassmorphism) */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentDayNum}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                            className="glass-card p-8 mb-8"
                        >
                            <Badge variant="outline" className="border-white/20 text-slate-400 mb-4 font-normal">
                                {dayData.bibleReading.reference}
                            </Badge>

                            <h3 className="text-3xl font-bold mb-6 text-white leading-tight">
                                {dayData.title}
                            </h3>

                            <div className="space-y-6">
                                {/* Bible Passage */}
                                <div className="space-y-4">
                                    <h4 className="text-sm font-semibold text-purple-400 uppercase tracking-wider">Lecture Biblique</h4>
                                    <blockquote className="font-scripture text-xl text-slate-200 italic leading-relaxed pl-4 border-l-4 border-purple-500/30">
                                        &ldquo;{dayData.bibleReading.passage}&rdquo;
                                    </blockquote>
                                </div>

                                {/* Link to Full Bible */}
                                <Button
                                    onClick={() => {
                                        const ref = bibleApi.parseReference(dayData.bibleReading.reference);
                                        if (ref) {
                                            const { setBibleNavigation } = useAppStore.getState();
                                            setBibleNavigation({ bookId: ref.bookId, chapterId: `${ref.bookId}.${ref.chapter}` });
                                        }
                                        // Always navigate, even if parse fails (fallback)
                                        const { setSelectedDay, setActiveTab } = useAppStore.getState();
                                        setSelectedDay(null); // Close detail view
                                        setActiveTab('bible'); // Switch to Bible tab
                                    }}
                                    className="w-full h-12 bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-xl font-medium flex items-center justify-center gap-2 group"
                                >
                                    <BookOpen className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
                                    Lire {dayData.bibleReading.reference} dans la Bible
                                    <ChevronRight className="w-4 h-4 opacity-50" />
                                </Button>

                                {/* Meditation */}
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold text-blue-400 uppercase tracking-wider">Méditation</h4>
                                    <p className="text-slate-300 leading-relaxed text-lg">
                                        {dayData.meditation}
                                    </p>
                                </div>

                                {/* Practical Action */}
                                <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
                                    <h4 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4" />
                                        Action Pratique
                                    </h4>
                                    <p className="text-emerald-100/90 leading-relaxed">
                                        {dayData.practicalAction}
                                    </p>
                                </div>

                                {/* Day Resources Section */}
                                {resources.length > 0 && (
                                    <div className="space-y-4 pt-4 border-t border-white/10">
                                        <h4 className="text-sm font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                                            <Download className="w-4 h-4" />
                                            Ressources du jour
                                        </h4>
                                        <div className="grid gap-3">
                                            {resources.map((resource) => (
                                                <motion.div
                                                    key={resource.id}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="group"
                                                >
                                                    {resource.resourceType === 'text' ? (
                                                        // Text content displayed inline
                                                        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                                            <div className="flex items-center gap-2 mb-2 text-amber-400">
                                                                {getResourceIcon(resource.resourceType)}
                                                                <span className="font-medium text-sm">{resource.title}</span>
                                                            </div>
                                                            <p className="text-slate-300 text-sm leading-relaxed">
                                                                {resource.content}
                                                            </p>
                                                        </div>
                                                    ) : resource.resourceType === 'image' && resource.url ? (
                                                        // Image displayed inline
                                                        <div className="rounded-xl overflow-hidden border border-white/10">
                                                            <img
                                                                src={resource.url}
                                                                alt={resource.title}
                                                                className="w-full h-48 object-cover"
                                                            />
                                                            <div className="p-3 bg-white/5">
                                                                <span className="text-sm font-medium text-slate-200">{resource.title}</span>
                                                                {resource.description && (
                                                                    <p className="text-xs text-slate-400 mt-1">{resource.description}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : resource.resourceType === 'video' && resource.url ? (
                                                        // Video player
                                                        <div className="rounded-xl overflow-hidden border border-white/10">
                                                            <video
                                                                src={resource.url}
                                                                controls
                                                                className="w-full"
                                                                poster={resource.url.replace(/\.\w+$/, '_thumb.jpg')}
                                                            />
                                                            <div className="p-3 bg-white/5">
                                                                <span className="text-sm font-medium text-slate-200">{resource.title}</span>
                                                            </div>
                                                        </div>
                                                    ) : resource.resourceType === 'audio' && resource.url ? (
                                                        // Audio player
                                                        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                                            <div className="flex items-center gap-3 mb-3">
                                                                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
                                                                    <Music className="w-5 h-5" />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <span className="font-medium text-sm text-slate-200">{resource.title}</span>
                                                                    {resource.description && (
                                                                        <p className="text-xs text-slate-400">{resource.description}</p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <audio src={resource.url} controls className="w-full h-10" />
                                                        </div>
                                                    ) : resource.url ? (
                                                        // PDF or other downloadable file
                                                        <a
                                                            href={resource.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-amber-500/30 transition-all"
                                                        >
                                                            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 group-hover:scale-110 transition-transform">
                                                                {getResourceIcon(resource.resourceType)}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-medium text-slate-200 truncate">{resource.title}</p>
                                                                {resource.description && (
                                                                    <p className="text-xs text-slate-400 truncate">{resource.description}</p>
                                                                )}
                                                            </div>
                                                            <ExternalLink className="w-4 h-4 text-slate-500" />
                                                        </a>
                                                    ) : null}
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {loadingResources && (
                                    <div className="flex justify-center py-4">
                                        <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Social Swipe Indicators for Mobile */}
                <div className="flex justify-center gap-6 mb-8 text-slate-600 md:hidden">
                    <ChevronLeft className={cn("w-6 h-6", currentDayNum === 1 && "opacity-10")} onClick={handlePrev} />
                    <div className="flex gap-1 items-center">
                        {Array.from({ length: Math.min(5, totalDays) }).map((_, i) => (
                            <div key={i} className={cn("h-1 rounded-full transition-all", i === 2 ? "w-4 bg-white" : "w-1 bg-slate-700")} />
                        ))}
                    </div>
                    <ChevronRight className={cn("w-6 h-6", currentDayNum === totalDays && "opacity-10")} onClick={handleNext} />
                </div>

                {/* Personal Action Area */}
                <div className="space-y-6">
                    <div className="glass-card p-6 bg-white/5 border-white/5">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
                                <MessageSquare className="w-5 h-5" />
                            </div>
                            <p className="font-semibold">Mes réflexions du jour...</p>
                        </div>
                        <Textarea
                            placeholder="Qu'est-ce que Dieu vous dit aujourd'hui ?"
                            className="bg-transparent border-none focus-visible:ring-0 resize-none min-h-[100px] p-0 placeholder:text-slate-600 text-slate-200"
                            value={progress?.journalEntry || ''}
                            onChange={(e) => updateDayProgress(currentDayNum, { journalEntry: e.target.value })}
                        />
                        <div className="flex justify-end gap-2 mt-2">
                            <Button
                                size="sm"
                                variant="ghost"
                                className="text-slate-400 hover:text-white"
                                onClick={() => {
                                    if (navigator.share) {
                                        navigator.share({
                                            title: `Réflexion Jour ${currentDayNum}`,
                                            text: progress?.journalEntry
                                        }).catch(console.error);
                                    } else {
                                        navigator.clipboard.writeText(progress?.journalEntry || '');
                                        toast.success('Texte copié !');
                                    }
                                }}
                            >
                                <Share2 className="w-4 h-4 mr-2" />
                                Partager
                            </Button>
                            <Button
                                size="sm"
                                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                                onClick={() => toast.success('Réflexion enregistrée !')}
                            >
                                <Save className="w-4 h-4 mr-2" />
                                Enregistrer
                            </Button>
                        </div>
                    </div>

                    {/* Completion Checkbox */}
                    <div
                        className={cn(
                            "flex items-center justify-between p-6 rounded-2xl border transition-all cursor-pointer",
                            progress?.completed
                                ? "bg-emerald-500/10 border-emerald-500/30"
                                : "bg-white/5 border-white/10"
                        )}
                        onClick={() => completeDay(currentDayNum)}
                    >
                        <div className="flex items-center gap-4">
                            <Checkbox
                                id="complete"
                                checked={progress?.completed}
                                className="w-6 h-6 rounded-lg border-slate-500 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-none"
                            />
                            <label htmlFor="complete" className="font-medium text-lg pointer-events-none">
                                Marquer comme accompli
                            </label>
                        </div>
                        {progress?.completed && (
                            <CheckCircle2 className="w-6 h-6 text-emerald-500 animate-in zoom-in duration-300" />
                        )}
                    </div>
                </div>
            </main >
        </div >
    );
}
