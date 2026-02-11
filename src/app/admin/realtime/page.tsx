'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Eye, Clock, Users, CalendarDays, TrendingUp,
    Activity, RefreshCw, Filter, Download, Bell, User,
    ChevronRight, Loader2, MapPin, Smartphone, BarChart3,
    MessageSquare, Heart, BookOpen, Wifi, WifiOff, Send
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { DayView } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from 'next/link';
import { toast } from 'sonner';

interface ViewWithUser extends DayView {
    profiles?: {
        full_name: string;
        avatar_url?: string;
        city?: string;
    };
}

interface OnlineUser {
    id: string;
    full_name: string;
    avatar_url?: string;
    is_online: boolean;
    last_seen?: string;
    city?: string;
}

interface ActivityEvent {
    id: string;
    type: 'prayer' | 'message' | 'group_join' | 'testimonial' | 'login' | 'view';
    user_name: string;
    user_avatar?: string;
    description: string;
    timestamp: string;
}

export default function RealtimeViewsPage() {
    const [views, setViews] = useState<ViewWithUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalViews: 0,
        activeUsers: 0,
        onlineNow: 0,
        mostViewedDay: 0,
        avgDuration: 0,
        totalPrayers: 0,
        totalMessages: 0,
        totalGroups: 0,
    });
    const [filterDay, setFilterDay] = useState<number | null>(null);
    const [realtimeEnabled, setRealtimeEnabled] = useState(true);
    const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
    const [activityFeed, setActivityFeed] = useState<ActivityEvent[]>([]);
    const [activeTab, setActiveTab] = useState<'activity' | 'users' | 'views'>('activity');

    // Load initial data
    useEffect(() => {
        loadViews();
        loadStats();
        loadOnlineUsers();
    }, [filterDay]);

    // Refresh online users periodically
    useEffect(() => {
        const interval = setInterval(loadOnlineUsers, 15000);
        return () => clearInterval(interval);
    }, []);

    // Setup realtime subscriptions
    useEffect(() => {
        if (!realtimeEnabled) return;

        const channels: any[] = [];

        // Day views subscription
        const viewsSub = supabase
            .channel('admin_day_views_realtime')
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'day_views' },
                async (payload) => {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('full_name, avatar_url, city')
                        .eq('id', payload.new.user_id)
                        .single();

                    const newView: ViewWithUser = {
                        id: payload.new.id,
                        userId: payload.new.user_id,
                        dayNumber: payload.new.day_number,
                        viewedAt: payload.new.viewed_at,
                        durationSeconds: payload.new.duration_seconds,
                        profiles: profile || undefined
                    };

                    setViews(prev => [newView, ...prev].slice(0, 50));
                    setStats(prev => ({ ...prev, totalViews: prev.totalViews + 1 }));

                    addActivity({
                        type: 'view',
                        user_name: profile?.full_name || 'Utilisateur',
                        user_avatar: profile?.avatar_url,
                        description: `A consulté le Jour ${payload.new.day_number}`,
                    });
                }
            )
            .subscribe();
        channels.push(viewsSub);

        // Prayer requests subscription
        const prayersSub = supabase
            .channel('admin_prayers_realtime')
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'prayer_requests' },
                async (payload) => {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('full_name, avatar_url')
                        .eq('id', payload.new.user_id)
                        .single();

                    setStats(prev => ({ ...prev, totalPrayers: prev.totalPrayers + 1 }));
                    addActivity({
                        type: 'prayer',
                        user_name: payload.new.is_anonymous ? 'Anonyme' : (profile?.full_name || 'Utilisateur'),
                        user_avatar: payload.new.is_anonymous ? undefined : profile?.avatar_url,
                        description: `Nouvelle demande de prière : "${(payload.new.content as string)?.slice(0, 60)}..."`,
                    });
                }
            )
            .subscribe();
        channels.push(prayersSub);

        // Direct messages subscription
        const dmSub = supabase
            .channel('admin_dm_realtime')
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'direct_messages' },
                async (payload) => {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('full_name, avatar_url')
                        .eq('id', payload.new.sender_id)
                        .single();

                    setStats(prev => ({ ...prev, totalMessages: prev.totalMessages + 1 }));
                    addActivity({
                        type: 'message',
                        user_name: profile?.full_name || 'Utilisateur',
                        user_avatar: profile?.avatar_url,
                        description: `A envoyé un message privé`,
                    });
                }
            )
            .subscribe();
        channels.push(dmSub);

        // Group messages subscription
        const groupMsgSub = supabase
            .channel('admin_group_msg_realtime')
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'prayer_group_messages' },
                async (payload) => {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('full_name, avatar_url')
                        .eq('id', payload.new.user_id)
                        .single();

                    setStats(prev => ({ ...prev, totalMessages: prev.totalMessages + 1 }));
                    addActivity({
                        type: 'message',
                        user_name: profile?.full_name || 'Utilisateur',
                        user_avatar: profile?.avatar_url,
                        description: `A envoyé un message dans un groupe de prière`,
                    });
                }
            )
            .subscribe();
        channels.push(groupMsgSub);

        // Testimonials subscription
        const testimonialSub = supabase
            .channel('admin_testimonial_realtime')
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'testimonials' },
                async (payload) => {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('full_name, avatar_url')
                        .eq('id', payload.new.user_id)
                        .single();

                    addActivity({
                        type: 'testimonial',
                        user_name: profile?.full_name || 'Utilisateur',
                        user_avatar: profile?.avatar_url,
                        description: `Nouveau témoignage soumis`,
                    });
                }
            )
            .subscribe();
        channels.push(testimonialSub);

        // Profile updates (login/online status)
        const profileSub = supabase
            .channel('admin_profiles_realtime')
            .on('postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'profiles' },
                async (payload) => {
                    const updated = payload.new as any;
                    if (updated.is_online === true) {
                        addActivity({
                            type: 'login',
                            user_name: updated.full_name || 'Utilisateur',
                            user_avatar: updated.avatar_url,
                            description: `S'est connecté`,
                        });
                        // Refresh online users list
                        loadOnlineUsers();
                    }
                }
            )
            .subscribe();
        channels.push(profileSub);

        return () => {
            channels.forEach(ch => ch.unsubscribe());
        };
    }, [realtimeEnabled]);

    const addActivity = (event: Omit<ActivityEvent, 'id' | 'timestamp'>) => {
        const newEvent: ActivityEvent = {
            ...event,
            id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            timestamp: new Date().toISOString(),
        };
        setActivityFeed(prev => [newEvent, ...prev].slice(0, 100));
    };

    const loadOnlineUsers = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, is_online, last_seen, city')
                .eq('is_online', true);

            if (!error && data) {
                setOnlineUsers(data);
                setStats(prev => ({ ...prev, onlineNow: data.length }));
            }
        } catch (e) {
            // is_online column might not exist
            console.log('Could not fetch online users:', e);
        }
    };

    const loadViews = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('day_views')
                .select(`
                    *,
                    profiles:user_id (full_name, avatar_url, city)
                `)
                .order('viewed_at', { ascending: false })
                .limit(50);

            if (filterDay !== null) {
                query = query.eq('day_number', filterDay);
            }

            const { data, error } = await query;
            if (error) throw error;

            const mappedViews: ViewWithUser[] = data?.map((v: any) => ({
                id: v.id,
                userId: v.user_id,
                dayNumber: v.day_number,
                viewedAt: v.viewed_at,
                durationSeconds: v.duration_seconds,
                profiles: v.profiles
            })) || [];

            setViews(mappedViews);
        } catch (e) {
            console.error('Error loading views:', e);
        }
        setLoading(false);
    };

    const loadStats = async () => {
        try {
            // Total views
            const { count: totalViews } = await supabase
                .from('day_views')
                .select('*', { count: 'exact', head: true });

            // Active users (viewed in last 24h)
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            const { data: activeData } = await supabase
                .from('day_views')
                .select('user_id')
                .gte('viewed_at', yesterday.toISOString());

            const uniqueActiveUsers = new Set(activeData?.map(d => d.user_id) || []).size;

            // Most viewed day
            const { data: dayData } = await supabase
                .from('day_views')
                .select('day_number');

            const dayCounts: Record<number, number> = {};
            dayData?.forEach(d => {
                dayCounts[d.day_number] = (dayCounts[d.day_number] || 0) + 1;
            });
            const mostViewedDay = Object.entries(dayCounts)
                .sort(([, a], [, b]) => b - a)[0]?.[0] || '0';

            // Average duration
            const { data: durationData } = await supabase
                .from('day_views')
                .select('duration_seconds')
                .not('duration_seconds', 'is', null);

            const avgDuration = durationData?.length
                ? Math.round(durationData.reduce((acc, d) => acc + (d.duration_seconds || 0), 0) / durationData.length)
                : 0;

            // Total prayers
            const { count: totalPrayers } = await supabase
                .from('prayer_requests')
                .select('*', { count: 'exact', head: true });

            // Total messages (DM + group)
            const { count: totalDMs } = await supabase
                .from('direct_messages')
                .select('*', { count: 'exact', head: true });

            const { count: totalGroupMsgs } = await supabase
                .from('prayer_group_messages')
                .select('*', { count: 'exact', head: true });

            // Total groups
            const { count: totalGroups } = await supabase
                .from('prayer_groups')
                .select('*', { count: 'exact', head: true });

            setStats({
                totalViews: totalViews || 0,
                activeUsers: uniqueActiveUsers,
                onlineNow: onlineUsers.length,
                mostViewedDay: parseInt(mostViewedDay),
                avgDuration,
                totalPrayers: totalPrayers || 0,
                totalMessages: (totalDMs || 0) + (totalGroupMsgs || 0),
                totalGroups: totalGroups || 0,
            });
        } catch (e) {
            console.error('Error loading stats:', e);
        }
    };

    const formatDuration = (seconds: number) => {
        if (seconds < 60) return `${seconds}s`;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    };

    const getActivityIcon = (type: string) => {
        switch (type) {
            case 'prayer': return <Heart className="h-4 w-4 text-pink-400" />;
            case 'message': return <Send className="h-4 w-4 text-blue-400" />;
            case 'group_join': return <Users className="h-4 w-4 text-emerald-400" />;
            case 'testimonial': return <BookOpen className="h-4 w-4 text-amber-400" />;
            case 'login': return <Wifi className="h-4 w-4 text-green-400" />;
            case 'view': return <Eye className="h-4 w-4 text-indigo-400" />;
            default: return <Activity className="h-4 w-4 text-slate-400" />;
        }
    };

    const getActivityColor = (type: string) => {
        switch (type) {
            case 'prayer': return 'from-pink-500/20 to-pink-500/5';
            case 'message': return 'from-blue-500/20 to-blue-500/5';
            case 'group_join': return 'from-emerald-500/20 to-emerald-500/5';
            case 'testimonial': return 'from-amber-500/20 to-amber-500/5';
            case 'login': return 'from-green-500/20 to-green-500/5';
            case 'view': return 'from-indigo-500/20 to-indigo-500/5';
            default: return 'from-slate-500/20 to-slate-500/5';
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#0B0E14] to-[#0F1219] text-white">
            {/* Header */}
            <header className="border-b border-white/5 bg-black/20 backdrop-blur-xl sticky top-0 z-40">
                <div className="max-w-6xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/admin">
                                <Button variant="ghost" size="icon">
                                    <ArrowLeft className="h-5 w-5" />
                                </Button>
                            </Link>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-xl font-bold">Suivi en Temps Réel</h1>
                                    {realtimeEnabled && (
                                        <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">
                                            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                                            Live
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-slate-500">Activité complète en temps réel</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="rounded-xl"
                                onClick={() => {
                                    loadViews();
                                    loadStats();
                                    loadOnlineUsers();
                                    toast.success('Données rafraîchies');
                                }}
                            >
                                <RefreshCw className="h-5 w-5" />
                            </Button>
                            <Button
                                variant="ghost"
                                className={cn(
                                    "rounded-xl gap-2",
                                    realtimeEnabled ? "bg-emerald-500/10 text-emerald-400" : "bg-white/5"
                                )}
                                onClick={() => setRealtimeEnabled(!realtimeEnabled)}
                            >
                                <Activity className="h-4 w-4" />
                                {realtimeEnabled ? 'Actif' : 'Pausé'}
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-8">
                {/* Stats Cards - Enhanced */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <Card className="bg-gradient-to-br from-green-600/20 to-green-600/5 border-green-500/10 rounded-2xl">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                                    <Wifi className="h-5 w-5 text-green-400" />
                                </div>
                                {stats.onlineNow > 0 && (
                                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                                )}
                            </div>
                            <p className="text-3xl font-black text-white">{stats.onlineNow}</p>
                            <p className="text-xs text-green-400/80 font-medium">En ligne maintenant</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-blue-600/20 to-blue-600/5 border-blue-500/10 rounded-2xl">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                    <Eye className="h-5 w-5 text-blue-400" />
                                </div>
                            </div>
                            <p className="text-3xl font-black text-white">{stats.totalViews}</p>
                            <p className="text-xs text-blue-400/80 font-medium">Vues totales</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-pink-600/20 to-pink-600/5 border-pink-500/10 rounded-2xl">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center">
                                    <Heart className="h-5 w-5 text-pink-400" />
                                </div>
                            </div>
                            <p className="text-3xl font-black text-white">{stats.totalPrayers}</p>
                            <p className="text-xs text-pink-400/80 font-medium">Prières</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-indigo-600/20 to-indigo-600/5 border-indigo-500/10 rounded-2xl">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                                    <MessageSquare className="h-5 w-5 text-indigo-400" />
                                </div>
                            </div>
                            <p className="text-3xl font-black text-white">{stats.totalMessages}</p>
                            <p className="text-xs text-indigo-400/80 font-medium">Messages</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Secondary Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <Card className="bg-gradient-to-br from-emerald-600/20 to-emerald-600/5 border-emerald-500/10 rounded-2xl">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                                    <Users className="h-5 w-5 text-emerald-400" />
                                </div>
                            </div>
                            <p className="text-3xl font-black text-white">{stats.activeUsers}</p>
                            <p className="text-xs text-emerald-400/80 font-medium">Actifs (24h)</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-purple-600/20 to-purple-600/5 border-purple-500/10 rounded-2xl">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                                    <TrendingUp className="h-5 w-5 text-purple-400" />
                                </div>
                            </div>
                            <p className="text-3xl font-black text-white">Jour {stats.mostViewedDay}</p>
                            <p className="text-xs text-purple-400/80 font-medium">Plus consulté</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-amber-600/20 to-amber-600/5 border-amber-500/10 rounded-2xl">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                                    <Clock className="h-5 w-5 text-amber-400" />
                                </div>
                            </div>
                            <p className="text-3xl font-black text-white">{formatDuration(stats.avgDuration)}</p>
                            <p className="text-xs text-amber-400/80 font-medium">Durée moyenne</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-teal-600/20 to-teal-600/5 border-teal-500/10 rounded-2xl">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center">
                                    <Users className="h-5 w-5 text-teal-400" />
                                </div>
                            </div>
                            <p className="text-3xl font-black text-white">{stats.totalGroups}</p>
                            <p className="text-xs text-teal-400/80 font-medium">Groupes</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Tabbed Content */}
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                    <TabsList className="bg-white/5 border border-white/10 rounded-xl mb-6">
                        <TabsTrigger value="activity" className="data-[state=active]:bg-indigo-600 rounded-lg gap-2">
                            <Activity className="h-4 w-4" />
                            Activité Live
                            {activityFeed.length > 0 && (
                                <Badge className="bg-red-500 text-white border-none text-[10px] h-5 min-w-5">
                                    {activityFeed.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="users" className="data-[state=active]:bg-emerald-600 rounded-lg gap-2">
                            <Wifi className="h-4 w-4" />
                            En ligne ({stats.onlineNow})
                        </TabsTrigger>
                        <TabsTrigger value="views" className="data-[state=active]:bg-blue-600 rounded-lg gap-2">
                            <Eye className="h-4 w-4" />
                            Vues
                        </TabsTrigger>
                    </TabsList>

                    {/* ===== ACTIVITY FEED TAB ===== */}
                    <TabsContent value="activity">
                        <Card className="bg-white/5 border-white/5 rounded-2xl overflow-hidden">
                            <CardHeader className="border-b border-white/5 flex flex-row items-center justify-between">
                                <CardTitle className="flex items-center gap-2">
                                    <Activity className="h-5 w-5 text-indigo-400" />
                                    Flux d'activité en temps réel
                                    {realtimeEnabled && (
                                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                                    )}
                                </CardTitle>
                                {activityFeed.length > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-slate-400 text-xs"
                                        onClick={() => setActivityFeed([])}
                                    >
                                        Effacer
                                    </Button>
                                )}
                            </CardHeader>

                            <CardContent className="p-0">
                                {activityFeed.length === 0 ? (
                                    <div className="text-center py-20">
                                        <Activity className="h-12 w-12 text-slate-700 mx-auto mb-4" />
                                        <p className="text-slate-500 mb-2">En attente d'activité...</p>
                                        <p className="text-xs text-slate-600">Les nouvelles actions apparaîtront ici en temps réel</p>
                                    </div>
                                ) : (
                                    <ScrollArea className="h-[500px]">
                                        <div className="divide-y divide-white/5">
                                            <AnimatePresence initial={false}>
                                                {activityFeed.map((event) => (
                                                    <motion.div
                                                        key={event.id}
                                                        initial={{ opacity: 0, x: -20, backgroundColor: 'rgba(99, 102, 241, 0.15)' }}
                                                        animate={{ opacity: 1, x: 0, backgroundColor: 'transparent' }}
                                                        exit={{ opacity: 0, x: 20 }}
                                                        transition={{ duration: 0.4 }}
                                                        className="flex items-center gap-4 p-4 hover:bg-white/5"
                                                    >
                                                        {/* Icon */}
                                                        <div className={cn(
                                                            "w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br",
                                                            getActivityColor(event.type)
                                                        )}>
                                                            {getActivityIcon(event.type)}
                                                        </div>

                                                        {/* User Avatar */}
                                                        <Avatar className="h-8 w-8 border border-white/10">
                                                            <AvatarImage src={event.user_avatar} />
                                                            <AvatarFallback className="bg-indigo-600/30 text-indigo-300 text-xs">
                                                                {event.user_name?.[0] || 'U'}
                                                            </AvatarFallback>
                                                        </Avatar>

                                                        {/* Info */}
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm text-white">
                                                                <span className="font-bold">{event.user_name}</span>
                                                                {' '}
                                                                <span className="text-slate-400">{event.description}</span>
                                                            </p>
                                                        </div>

                                                        {/* Time */}
                                                        <div className="text-right shrink-0">
                                                            <p className="text-xs text-slate-500">
                                                                {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true, locale: fr })}
                                                            </p>
                                                            <p className="text-[10px] text-slate-600">
                                                                {format(new Date(event.timestamp), 'HH:mm:ss', { locale: fr })}
                                                            </p>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </AnimatePresence>
                                        </div>
                                    </ScrollArea>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ===== ONLINE USERS TAB ===== */}
                    <TabsContent value="users">
                        <Card className="bg-white/5 border-white/5 rounded-2xl overflow-hidden">
                            <CardHeader className="border-b border-white/5">
                                <CardTitle className="flex items-center gap-2">
                                    <Wifi className="h-5 w-5 text-green-400" />
                                    Utilisateurs en ligne
                                    <Badge className="bg-green-500/20 text-green-400 border-none">
                                        {onlineUsers.length}
                                    </Badge>
                                </CardTitle>
                            </CardHeader>

                            <CardContent className="p-0">
                                {onlineUsers.length === 0 ? (
                                    <div className="text-center py-20">
                                        <WifiOff className="h-12 w-12 text-slate-700 mx-auto mb-4" />
                                        <p className="text-slate-500">Aucun utilisateur en ligne</p>
                                    </div>
                                ) : (
                                    <ScrollArea className="h-[400px]">
                                        <div className="divide-y divide-white/5">
                                            {onlineUsers.map((u) => (
                                                <div key={u.id} className="flex items-center gap-4 p-4 hover:bg-white/5">
                                                    <div className="relative">
                                                        <Avatar className="h-10 w-10 border border-white/10">
                                                            <AvatarImage src={u.avatar_url} />
                                                            <AvatarFallback className="bg-emerald-600/30 text-emerald-300">
                                                                {u.full_name?.[0] || 'U'}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0F1219]" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-sm text-white truncate">{u.full_name}</p>
                                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                                            <span className="text-green-400">● En ligne</span>
                                                            {u.city && (
                                                                <span className="flex items-center gap-0.5">
                                                                    <MapPin className="h-3 w-3" /> {u.city}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {u.last_seen && (
                                                        <p className="text-[10px] text-slate-600">
                                                            {format(new Date(u.last_seen), 'HH:mm', { locale: fr })}
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ===== VIEWS TAB ===== */}
                    <TabsContent value="views">
                        {/* Day Filter */}
                        <div className="mb-6">
                            <label className="text-xs font-bold text-slate-400 uppercase mb-3 block">Filtrer par jour</label>
                            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                                <Button
                                    variant="ghost"
                                    className={cn(
                                        "shrink-0 h-10 px-4 rounded-xl font-bold",
                                        filterDay === null ? "bg-indigo-600" : "bg-white/5"
                                    )}
                                    onClick={() => setFilterDay(null)}
                                >
                                    Tous
                                </Button>
                                {Array.from({ length: 40 }, (_, i) => i + 1).map(day => (
                                    <Button
                                        key={day}
                                        variant="ghost"
                                        className={cn(
                                            "shrink-0 h-10 w-10 rounded-xl font-bold",
                                            filterDay === day ? "bg-indigo-600" : "bg-white/5 text-slate-400"
                                        )}
                                        onClick={() => setFilterDay(day)}
                                    >
                                        {day}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Views List */}
                        <Card className="bg-white/5 border-white/5 rounded-2xl overflow-hidden">
                            <CardHeader className="border-b border-white/5">
                                <CardTitle className="flex items-center gap-2">
                                    <Eye className="h-5 w-5 text-indigo-400" />
                                    Vues des jours de prière
                                </CardTitle>
                            </CardHeader>

                            <CardContent className="p-0">
                                {loading ? (
                                    <div className="flex justify-center py-20">
                                        <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
                                    </div>
                                ) : views.length === 0 ? (
                                    <div className="text-center py-20">
                                        <Eye className="h-12 w-12 text-slate-700 mx-auto mb-4" />
                                        <p className="text-slate-500">Aucune activité</p>
                                    </div>
                                ) : (
                                    <ScrollArea className="h-[500px]">
                                        <div className="divide-y divide-white/5">
                                            <AnimatePresence initial={false}>
                                                {views.map((view) => (
                                                    <motion.div
                                                        key={view.id}
                                                        initial={{ opacity: 0, x: -20, backgroundColor: 'rgba(99, 102, 241, 0.2)' }}
                                                        animate={{ opacity: 1, x: 0, backgroundColor: 'transparent' }}
                                                        exit={{ opacity: 0, x: 20 }}
                                                        transition={{ duration: 0.3 }}
                                                        className="flex items-center gap-4 p-4 hover:bg-white/5"
                                                    >
                                                        <Avatar className="h-10 w-10 border border-white/10">
                                                            <AvatarImage src={view.profiles?.avatar_url} />
                                                            <AvatarFallback className="bg-indigo-600/30 text-indigo-300">
                                                                {view.profiles?.full_name?.[0] || 'U'}
                                                            </AvatarFallback>
                                                        </Avatar>

                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-0.5">
                                                                <p className="font-bold text-sm text-white truncate">
                                                                    {view.profiles?.full_name || 'Utilisateur'}
                                                                </p>
                                                                {view.profiles?.city && (
                                                                    <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                                                                        <MapPin className="h-3 w-3" />
                                                                        {view.profiles.city}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-slate-500">
                                                                A consulté le <span className="text-indigo-400 font-bold">Jour {view.dayNumber}</span>
                                                                {view.durationSeconds && view.durationSeconds > 0 && (
                                                                    <span className="ml-2">
                                                                        • {formatDuration(view.durationSeconds)}
                                                                    </span>
                                                                )}
                                                            </p>
                                                        </div>

                                                        <Badge className="bg-indigo-600/20 text-indigo-400 border-none shrink-0">
                                                            Jour {view.dayNumber}
                                                        </Badge>

                                                        <div className="text-right shrink-0">
                                                            <p className="text-xs text-slate-500">
                                                                {formatDistanceToNow(new Date(view.viewedAt), { addSuffix: true, locale: fr })}
                                                            </p>
                                                            <p className="text-[10px] text-slate-600">
                                                                {format(new Date(view.viewedAt), 'HH:mm', { locale: fr })}
                                                            </p>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </AnimatePresence>
                                        </div>
                                    </ScrollArea>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
}
