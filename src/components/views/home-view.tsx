'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Play,
    Flame,
    Trophy,
    TrendingUp,
    Gamepad2,
    Radio,
    Share2,
    Youtube,
    Facebook,
    X,
    ExternalLink,
    CalendarDays
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { useAppStore } from '@/lib/store';
import { getDay } from '@/lib/program-data';
import { cn } from '@/lib/utils';
import { TabType } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { NotificationBell } from '@/components/notification-bell';

interface HomeViewProps {
    onNavigateToDay: (day: number) => void;
    onNavigateTo: (tab: TabType) => void;
}

interface SocialLink {
    id: string;
    platform: string;
    title: string;
    url: string;
    embed_code?: string;
}

export function HomeView({ onNavigateToDay, onNavigateTo }: HomeViewProps) {
    const { user, currentDay, streak, totalDaysCompleted, appSettings, setBibleViewTarget } = useAppStore();
    const todayData = getDay(currentDay);

    const [isLiveActive, setIsLiveActive] = useState(false);
    const [liveStreamUrl, setLiveStreamUrl] = useState('');
    const [showLiveDialog, setShowLiveDialog] = useState(false);
    const [showSocialDialog, setShowSocialDialog] = useState(false);
    const [showEventsDialog, setShowEventsDialog] = useState(false);
    const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);

    useEffect(() => {
        // Check if live is active from app settings
        if (appSettings) {
            setIsLiveActive(appSettings['live_stream_active'] === 'true');
            setLiveStreamUrl(appSettings['live_stream_url'] || '');
        }

        // Load social links
        loadSocialLinks();
    }, [appSettings]);

    const loadSocialLinks = async () => {
        try {
            const { data } = await supabase
                .from('social_links')
                .select('*')
                .eq('is_active', true)
                .order('sort_order');
            if (data) setSocialLinks(data);
        } catch (e) {
            // Table might not exist yet
        }
    };

    const getPlatformIcon = (platform: string) => {
        switch (platform.toLowerCase()) {
            case 'youtube': return <Youtube className="w-5 h-5" />;
            case 'facebook': return <Facebook className="w-5 h-5" />;
            case 'tiktok': return <span className="text-lg font-bold">TT</span>;
            default: return <ExternalLink className="w-5 h-5" />;
        }
    };

    const getPlatformColor = (platform: string) => {
        switch (platform.toLowerCase()) {
            case 'youtube': return 'bg-red-500/20 text-red-400 border-red-500/30';
            case 'facebook': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case 'tiktok': return 'bg-pink-500/20 text-pink-400 border-pink-500/30';
            default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };

    if (!todayData || !user) return null;

    return (
        <div className="min-h-screen bg-[#0F172A] text-slate-50 pb-28 overflow-x-hidden relative">
            {/* Ambient Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-20%] right-[-20%] w-[80%] h-[80%] bg-purple-900/20 blur-[150px] rounded-full opacity-50" />
                <div className="absolute bottom-[20%] left-[-20%] w-[60%] h-[60%] bg-blue-900/20 blur-[150px] rounded-full opacity-50" />
            </div>

            {/* Header */}
            <header className="relative z-10 px-6 pt-12 pb-6 flex items-center justify-between">
                <div>
                    <p className="text-slate-400 text-sm font-medium mb-1">Que la paix soit avec vous,</p>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                        {user.name.split(' ')[0]}
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <NotificationBell />
                    <Avatar onClick={() => onNavigateTo('profile')} className="w-12 h-12 border-2 border-white/10 cursor-pointer shadow-lg hover:border-purple-500/50 transition-colors">
                        <AvatarImage src={user.avatar} />
                        <AvatarFallback className="bg-purple-600/20 text-purple-400 font-bold">
                            {user.name.charAt(0)}
                        </AvatarFallback>
                    </Avatar>
                </div>
            </header>

            <main className="relative z-10 px-6 space-y-6">
                {/* Live Banner - Blinking Red */}
                {isLiveActive && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="cursor-pointer"
                        onClick={() => setShowLiveDialog(true)}
                    >
                        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-900/80 to-red-700/80 p-4 border border-red-500/30">
                            <div className="absolute inset-0 bg-gradient-to-r from-red-600/20 to-transparent animate-pulse" />
                            <div className="relative flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <div className="w-3 h-3 bg-red-500 rounded-full animate-ping absolute" />
                                        <div className="w-3 h-3 bg-red-500 rounded-full relative" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-white">🔴 NOUS SOMMES EN DIRECT</p>
                                        <p className="text-red-200 text-sm">Cliquez pour rejoindre le live</p>
                                    </div>
                                </div>
                                <Radio className="w-6 h-6 text-red-300 animate-pulse" />
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Main Progression Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="relative group cursor-pointer"
                    onClick={() => onNavigateToDay(currentDay)}
                >
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-blue-600 rounded-3xl blur opacity-30 group-hover:opacity-60 transition duration-500" />

                    <div className="relative glass-card p-6 h-[280px] flex flex-col justify-between overflow-hidden bg-slate-900/80">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-purple-500/10 to-transparent blur-3xl rounded-full translate-x-12 -translate-y-12 pointer-events-none" />

                        <div className="flex justify-between items-start">
                            <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-xs font-bold tracking-wider text-white">
                                JOUR {currentDay} / 40
                            </div>
                            <div className="bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full flex items-center gap-1.5 text-xs font-bold border border-orange-500/10">
                                <Flame className="w-3.5 h-3.5 fill-current" />
                                {streak} Jours
                            </div>
                        </div>

                        <div className="space-y-2 mt-4">
                            <p className="text-slate-400 text-sm font-medium tracking-wide uppercase">Thème du jour</p>
                            <h2 className="text-3xl font-bold leading-tight text-white font-heading">
                                {todayData.title}
                            </h2>
                            <p className="text-slate-300 line-clamp-2 text-sm max-w-[90%]">
                                {todayData.meditation}
                            </p>
                        </div>

                        <Button className="w-full mt-4 bg-white text-slate-900 hover:bg-slate-100 h-12 rounded-xl font-bold shadow-[0_0_20px_rgba(255,255,255,0.15)] group-hover:shadow-[0_0_30px_rgba(255,255,255,0.25)] transition-all duration-300">
                            <Play className="w-4 h-4 mr-2 fill-slate-900" />
                            Commencer le jour {currentDay}
                        </Button>
                    </div>
                </motion.div>

                {/* Stats + Actions Grid */}
                <div className="grid grid-cols-2 gap-4">
                    {/* Progression */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        className="glass-card p-4 bg-white/[0.03] space-y-3"
                    >
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 mb-2">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-slate-100">{Math.round((totalDaysCompleted / 40) * 100)}%</p>
                            <p className="text-xs text-slate-500 font-medium">Progression totale</p>
                        </div>
                    </motion.div>

                    {/* Bible Games Button */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                        className="glass-card p-4 bg-gradient-to-br from-green-900/30 to-emerald-900/20 border-green-500/20 cursor-pointer hover:border-green-500/40 transition-all"
                        onClick={() => {
                            setBibleViewTarget('games');
                            onNavigateTo('bible');
                        }}
                    >
                        <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center text-green-400 mb-2">
                            <Gamepad2 className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-lg font-bold text-slate-100">Jeux Bibliques</p>
                            <p className="text-xs text-slate-500 font-medium">Quiz, Mémoire, Mots</p>
                        </div>
                    </motion.div>

                    {/* Days Completed */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.35 }}
                        className="glass-card p-4 bg-white/[0.03] space-y-3"
                    >
                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 mb-2">
                            <Trophy className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-slate-100">{totalDaysCompleted}</p>
                            <p className="text-xs text-slate-500 font-medium">Jours terminés</p>
                        </div>
                    </motion.div>

                    {/* Social Networks Button */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 }}
                        className="glass-card p-4 bg-gradient-to-br from-indigo-900/30 to-purple-900/20 border-indigo-500/20 cursor-pointer hover:border-indigo-500/40 transition-all"
                        onClick={() => setShowSocialDialog(true)}
                    >
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 mb-2">
                            <Share2 className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-lg font-bold text-slate-100">Nos Réseaux</p>
                            <p className="text-xs text-slate-500 font-medium">YouTube, Facebook...</p>
                        </div>
                    </motion.div>

                    {/* ÉVÉNEMENTS Button */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.45 }}
                        className="col-span-2 glass-card p-4 bg-gradient-to-br from-amber-900/30 to-orange-900/20 border-amber-500/20 cursor-pointer hover:border-amber-500/40 transition-all flex items-center gap-4"
                        onClick={() => setShowEventsDialog(true)}
                    >
                        <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
                            <CalendarDays className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-lg font-bold text-slate-100">ÉVÉNEMENTS</p>
                            <p className="text-xs text-slate-500 font-medium">Prochains événements et activités</p>
                        </div>
                    </motion.div>
                </div>

                {/* Daily Verse */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="glass-card p-6 bg-gradient-to-br from-slate-900 to-slate-800 border-l-4 border-l-purple-500"
                >
                    <h3 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">Verset du jour</h3>
                    <blockquote className="font-scripture text-lg text-slate-200 italic leading-relaxed mb-4">
                        &ldquo;{todayData.bibleReading.passage}&rdquo;
                    </blockquote>
                    <p className="text-right text-purple-400 text-sm font-bold">
                        — {todayData.bibleReading.reference}
                    </p>
                </motion.div>
            </main>

            {/* Live Stream Dialog */}
            <Dialog open={showLiveDialog} onOpenChange={setShowLiveDialog}>
                <DialogContent className="max-w-3xl bg-slate-900 border-slate-800">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-white">
                            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                            En Direct
                        </DialogTitle>
                        <DialogDescription>
                            Regardez notre diffusion en direct et participez!
                        </DialogDescription>
                    </DialogHeader>
                    <div className="aspect-video bg-black rounded-lg overflow-hidden">
                        {liveStreamUrl ? (
                            <iframe
                                src={liveStreamUrl}
                                className="w-full h-full"
                                allowFullScreen
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-500">
                                <p>Aucun stream en cours</p>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2 mt-4">
                        <Button className="flex-1 bg-red-600 hover:bg-red-500">
                            <Youtube className="w-4 h-4 mr-2" />
                            Like
                        </Button>
                        <Button className="flex-1" variant="outline">
                            <Share2 className="w-4 h-4 mr-2" />
                            Partager
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Social Networks Dialog */}
            <Dialog open={showSocialDialog} onOpenChange={setShowSocialDialog}>
                <DialogContent className="max-w-md bg-slate-900 border-slate-800">
                    <DialogHeader>
                        <DialogTitle className="text-white">Nos Réseaux Sociaux</DialogTitle>
                        <DialogDescription>
                            Suivez-nous sur toutes les plateformes
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 mt-4">
                        {socialLinks.length > 0 ? (
                            socialLinks.map((link) => (
                                <a
                                    key={link.id}
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={cn(
                                        "flex items-center gap-4 p-4 rounded-xl border transition-all hover:scale-[1.02]",
                                        getPlatformColor(link.platform)
                                    )}
                                >
                                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                                        {getPlatformIcon(link.platform)}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold">{link.title}</p>
                                        <p className="text-sm opacity-70 capitalize">{link.platform}</p>
                                    </div>
                                    <ExternalLink className="w-4 h-4 opacity-50" />
                                </a>
                            ))
                        ) : (
                            <>
                                <a
                                    href="https://youtube.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-4 p-4 rounded-xl border bg-red-500/20 text-red-400 border-red-500/30 transition-all hover:scale-[1.02]"
                                >
                                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                                        <Youtube className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold">YouTube</p>
                                        <p className="text-sm opacity-70">Vidéos & Lives</p>
                                    </div>
                                    <ExternalLink className="w-4 h-4 opacity-50" />
                                </a>
                                <a
                                    href="https://facebook.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-4 p-4 rounded-xl border bg-blue-500/20 text-blue-400 border-blue-500/30 transition-all hover:scale-[1.02]"
                                >
                                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                                        <Facebook className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold">Facebook</p>
                                        <p className="text-sm opacity-70">Communauté</p>
                                    </div>
                                    <ExternalLink className="w-4 h-4 opacity-50" />
                                </a>
                                <a
                                    href="https://tiktok.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-4 p-4 rounded-xl border bg-pink-500/20 text-pink-400 border-pink-500/30 transition-all hover:scale-[1.02]"
                                >
                                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                                        <span className="text-xl font-bold">TT</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold">TikTok</p>
                                        <p className="text-sm opacity-70">Clips courts</p>
                                    </div>
                                    <ExternalLink className="w-4 h-4 opacity-50" />
                                </a>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Events Dialog (Google Calendar) */}
            <Dialog open={showEventsDialog} onOpenChange={setShowEventsDialog}>
                <DialogContent className="max-w-3xl bg-slate-900 border-slate-800 max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-white">
                            <CalendarDays className="w-5 h-5 text-amber-400" />
                            ÉVÉNEMENTS
                        </DialogTitle>
                        <DialogDescription>
                            Retrouvez tous nos prochains événements et activités
                        </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4 rounded-xl overflow-hidden border border-slate-700">
                        <iframe
                            src={`https://calendar.google.com/calendar/embed?src=${encodeURIComponent(appSettings?.['google_calendar_id'] || 'fr.french%23holiday%40group.v.calendar.google.com')}&ctz=Africa%2FDouala&mode=AGENDA&showTitle=0&showNav=1&showPrint=0&showCalendars=0&bgcolor=%230F172A&color=%236366F1`}
                            className="w-full border-0"
                            style={{ height: '500px' }}
                            title="Calendrier des événements"
                        />
                    </div>
                    <p className="text-xs text-slate-500 text-center mt-2">
                        💡 Configurez l'ID du calendrier dans les paramètres admin (clé: <code className="text-indigo-400">google_calendar_id</code>)
                    </p>
                </DialogContent>
            </Dialog>
        </div>
    );
}
