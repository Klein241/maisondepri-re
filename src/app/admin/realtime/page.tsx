'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Eye, Clock, Users, CalendarDays, TrendingUp,
    Activity, RefreshCw, Filter, Download, Bell, User,
    ChevronRight, Loader2, MapPin, Smartphone, BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/supabase';
import { DayView } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from 'next/link';

interface ViewWithUser extends DayView {
    profiles?: {
        full_name: string;
        avatar_url?: string;
        city?: string;
    };
}

export default function RealtimeViewsPage() {
    const [views, setViews] = useState<ViewWithUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalViews: 0,
        activeUsers: 0,
        mostViewedDay: 0,
        avgDuration: 0
    });
    const [filterDay, setFilterDay] = useState<number | null>(null);
    const [realtimeEnabled, setRealtimeEnabled] = useState(true);

    // Load initial data
    useEffect(() => {
        loadViews();
        loadStats();
    }, [filterDay]);

    // Setup realtime subscription
    useEffect(() => {
        if (!realtimeEnabled) return;

        const subscription = supabase
            .channel('day_views_realtime')
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'day_views' },
                async (payload) => {
                    // Fetch user info for new view
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
                        profiles: profile
                    };

                    setViews(prev => [newView, ...prev].slice(0, 50));
                    setStats(prev => ({
                        ...prev,
                        totalViews: prev.totalViews + 1
                    }));

                    // Flash notification effect
                    // Could trigger a toast or sound here
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [realtimeEnabled]);

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

            setStats({
                totalViews: totalViews || 0,
                activeUsers: uniqueActiveUsers,
                mostViewedDay: parseInt(mostViewedDay),
                avgDuration
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
                                <p className="text-sm text-slate-500">Visualisez l'activité des utilisateurs</p>
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
                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
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
                </div>

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

                {/* Live Activity Feed */}
                <Card className="bg-white/5 border-white/5 rounded-2xl overflow-hidden">
                    <CardHeader className="border-b border-white/5">
                        <CardTitle className="flex items-center gap-2">
                            <Activity className="h-5 w-5 text-indigo-400" />
                            Flux d'activité
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
                                        {views.map((view, i) => (
                                            <motion.div
                                                key={view.id}
                                                initial={{ opacity: 0, x: -20, backgroundColor: 'rgba(99, 102, 241, 0.2)' }}
                                                animate={{ opacity: 1, x: 0, backgroundColor: 'transparent' }}
                                                exit={{ opacity: 0, x: 20 }}
                                                transition={{ duration: 0.3 }}
                                                className="flex items-center gap-4 p-4 hover:bg-white/5"
                                            >
                                                {/* User Avatar */}
                                                <Avatar className="h-10 w-10 border border-white/10">
                                                    <AvatarImage src={view.profiles?.avatar_url} />
                                                    <AvatarFallback className="bg-indigo-600/30 text-indigo-300">
                                                        {view.profiles?.full_name?.[0] || 'U'}
                                                    </AvatarFallback>
                                                </Avatar>

                                                {/* View Info */}
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

                                                {/* Day Badge */}
                                                <Badge className="bg-indigo-600/20 text-indigo-400 border-none shrink-0">
                                                    Jour {view.dayNumber}
                                                </Badge>

                                                {/* Timestamp */}
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
            </main>
        </div>
    );
}
