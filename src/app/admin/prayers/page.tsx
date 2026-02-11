'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, CheckCircle2, Lock, Unlock, Search, Filter,
    Heart, MessageSquare, User, Calendar, Sparkles,
    ChevronRight, Loader2, X, Check, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { PrayerRequest, PRAYER_CATEGORIES, PrayerCategory } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import Link from 'next/link';
import confetti from 'canvas-confetti';

interface ExtendedPrayerRequest {
    id: string;
    user_id: string;
    content: string;
    created_at: string;
    prayer_count: number;
    prayed_by: string[];
    is_anonymous?: boolean;
    category?: PrayerCategory;
    photos?: string[];
    is_answered?: boolean;
    answered_at?: string;
    is_locked?: boolean;
    group_id?: string;
    profiles?: {
        full_name: string;
        avatar_url?: string;
        email?: string;
    };
}

export default function PrayersManagementPage() {
    const [prayers, setPrayers] = useState<ExtendedPrayerRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'answered'>('all');
    const [filterCategory, setFilterCategory] = useState<PrayerCategory | 'all'>('all');
    const [selectedPrayer, setSelectedPrayer] = useState<ExtendedPrayerRequest | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [answerNote, setAnswerNote] = useState('');
    const [processing, setProcessing] = useState(false);

    // Stats
    const [stats, setStats] = useState({
        total: 0,
        pending: 0,
        answered: 0,
        locked: 0
    });

    useEffect(() => {
        loadPrayers();
    }, [filterStatus, filterCategory]);

    const loadPrayers = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('prayer_requests')
                .select(`
                    *,
                    profiles:user_id (full_name, avatar_url, email)
                `)
                .order('created_at', { ascending: false });

            if (filterStatus === 'answered') {
                query = query.eq('is_answered', true);
            } else if (filterStatus === 'pending') {
                query = query.eq('is_answered', false);
            }

            if (filterCategory !== 'all') {
                query = query.eq('category', filterCategory);
            }

            const { data, error } = await query;
            if (error) throw error;

            setPrayers(data || []);

            // Calculate stats
            const allPrayers = data || [];
            setStats({
                total: allPrayers.length,
                pending: allPrayers.filter(p => !p.is_answered).length,
                answered: allPrayers.filter(p => p.is_answered).length,
                locked: allPrayers.filter(p => p.is_locked).length
            });
        } catch (e) {
            console.error('Error loading prayers:', e);
            toast.error('Erreur de chargement');
        }
        setLoading(false);
    };

    const markAsAnswered = async (prayerId: string) => {
        setProcessing(true);
        try {
            const { error } = await supabase.rpc('mark_prayer_answered', {
                prayer_id: prayerId
            });

            if (error) {
                // Fallback if RPC doesn't exist
                await supabase
                    .from('prayer_requests')
                    .update({
                        is_answered: true,
                        answered_at: new Date().toISOString(),
                        is_locked: true
                    })
                    .eq('id', prayerId);
            }

            toast.success('🙌 Prière marquée comme exaucée!');
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#10B981', '#34D399', '#059669', '#FFD700']
            });
            setIsDialogOpen(false);
            setSelectedPrayer(null);
            loadPrayers();
        } catch (e) {
            console.error('Error marking prayer:', e);
            toast.error('Erreur lors de la mise à jour');
        }
        setProcessing(false);
    };

    const toggleLock = async (prayerId: string, currentLock: boolean) => {
        try {
            await supabase
                .from('prayer_requests')
                .update({ is_locked: !currentLock })
                .eq('id', prayerId);

            toast.success(currentLock ? 'Prière déverrouillée' : 'Prière verrouillée');
            loadPrayers();
        } catch (e) {
            toast.error('Erreur');
        }
    };

    const getCategoryInfo = (catId: PrayerCategory | undefined) => {
        return PRAYER_CATEGORIES.find(c => c.id === (catId || 'other'));
    };

    // Filter by search
    const filteredPrayers = prayers.filter(p => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            p.content.toLowerCase().includes(query) ||
            p.profiles?.full_name?.toLowerCase().includes(query) ||
            p.profiles?.email?.toLowerCase().includes(query)
        );
    });

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
                                <h1 className="text-xl font-bold">Gestion des Prières</h1>
                                <p className="text-sm text-slate-500">Marquer les prières exaucées</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-8">
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <Card className="bg-white/5 border-white/5 rounded-2xl">
                        <CardContent className="p-5 text-center">
                            <p className="text-3xl font-black text-white">{stats.total}</p>
                            <p className="text-xs text-slate-500 font-medium">Total</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-amber-500/10 border-amber-500/20 rounded-2xl">
                        <CardContent className="p-5 text-center">
                            <p className="text-3xl font-black text-amber-400">{stats.pending}</p>
                            <p className="text-xs text-amber-400/60 font-medium">En attente</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-emerald-500/10 border-emerald-500/20 rounded-2xl">
                        <CardContent className="p-5 text-center">
                            <p className="text-3xl font-black text-emerald-400">{stats.answered}</p>
                            <p className="text-xs text-emerald-400/60 font-medium">Exaucées</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-indigo-500/10 border-indigo-500/20 rounded-2xl">
                        <CardContent className="p-5 text-center">
                            <p className="text-3xl font-black text-indigo-400">{stats.locked}</p>
                            <p className="text-xs text-indigo-400/60 font-medium">Verrouillées</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-4 mb-6">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <Input
                            placeholder="Rechercher..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 bg-white/5 border-white/10 rounded-xl"
                        />
                    </div>

                    {/* Status Filter */}
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            className={cn(
                                "rounded-xl h-10",
                                filterStatus === 'all' ? "bg-white/10" : "bg-white/5"
                            )}
                            onClick={() => setFilterStatus('all')}
                        >
                            Toutes
                        </Button>
                        <Button
                            variant="ghost"
                            className={cn(
                                "rounded-xl h-10",
                                filterStatus === 'pending' ? "bg-amber-500/20 text-amber-400" : "bg-white/5"
                            )}
                            onClick={() => setFilterStatus('pending')}
                        >
                            En attente
                        </Button>
                        <Button
                            variant="ghost"
                            className={cn(
                                "rounded-xl h-10",
                                filterStatus === 'answered' ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5"
                            )}
                            onClick={() => setFilterStatus('answered')}
                        >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Exaucées
                        </Button>
                    </div>
                </div>

                {/* Category Filter */}
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-4 mb-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                            "shrink-0 rounded-xl",
                            filterCategory === 'all' ? "bg-indigo-600" : "bg-white/5"
                        )}
                        onClick={() => setFilterCategory('all')}
                    >
                        Toutes catégories
                    </Button>
                    {PRAYER_CATEGORIES.map(cat => (
                        <Button
                            key={cat.id}
                            variant="ghost"
                            size="sm"
                            className={cn(
                                "shrink-0 rounded-xl gap-1.5",
                                filterCategory === cat.id ? "text-white" : "bg-white/5 text-slate-400"
                            )}
                            style={{
                                backgroundColor: filterCategory === cat.id ? `${cat.color}cc` : undefined
                            }}
                            onClick={() => setFilterCategory(cat.id)}
                        >
                            <span>{cat.icon}</span>
                            {cat.nameFr}
                        </Button>
                    ))}
                </div>

                {/* Prayers List */}
                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
                    </div>
                ) : filteredPrayers.length === 0 ? (
                    <div className="text-center py-20">
                        <MessageSquare className="h-12 w-12 text-slate-700 mx-auto mb-4" />
                        <p className="text-slate-500">Aucune prière trouvée</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredPrayers.map((prayer) => {
                            const category = getCategoryInfo(prayer.category);

                            return (
                                <Card
                                    key={prayer.id}
                                    className={cn(
                                        "border-white/5 rounded-2xl overflow-hidden transition-all",
                                        prayer.is_answered
                                            ? "bg-emerald-500/5 border-emerald-500/10"
                                            : "bg-white/5",
                                        prayer.is_locked && "opacity-60"
                                    )}
                                >
                                    <CardContent className="p-5">
                                        <div className="flex items-start gap-4">
                                            {/* User Avatar */}
                                            <Avatar className="h-12 w-12 border border-white/10 shrink-0">
                                                <AvatarImage src={prayer.profiles?.avatar_url} />
                                                <AvatarFallback className="bg-indigo-600/30 text-indigo-300">
                                                    {prayer.is_anonymous ? '?' : prayer.profiles?.full_name?.[0] || 'U'}
                                                </AvatarFallback>
                                            </Avatar>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap mb-2">
                                                    <p className="font-bold text-white">
                                                        {prayer.is_anonymous ? 'Anonyme' : prayer.profiles?.full_name}
                                                    </p>
                                                    {!prayer.is_anonymous && prayer.profiles?.email && (
                                                        <span className="text-xs text-slate-500">{prayer.profiles.email}</span>
                                                    )}
                                                    {category && (
                                                        <Badge
                                                            variant="outline"
                                                            className="border-none text-[10px]"
                                                            style={{ backgroundColor: `${category.color}30`, color: category.color }}
                                                        >
                                                            {category.icon} {category.nameFr}
                                                        </Badge>
                                                    )}
                                                    {prayer.is_answered && (
                                                        <Badge className="bg-emerald-500/20 text-emerald-400 border-none gap-1">
                                                            <CheckCircle2 className="h-3 w-3" />
                                                            Exaucée
                                                        </Badge>
                                                    )}
                                                    {prayer.is_locked && (
                                                        <Badge className="bg-slate-500/20 text-slate-400 border-none gap-1">
                                                            <Lock className="h-3 w-3" />
                                                            Verrouillée
                                                        </Badge>
                                                    )}
                                                </div>

                                                <p className="text-slate-300 leading-relaxed line-clamp-3 mb-3">
                                                    {prayer.content}
                                                </p>

                                                <div className="flex items-center gap-4 text-xs text-slate-500">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="h-3 w-3" />
                                                        {format(new Date(prayer.created_at), 'dd MMM yyyy', { locale: fr })}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Heart className="h-3 w-3" />
                                                        {prayer.prayer_count} priants
                                                    </span>
                                                    {prayer.answered_at && (
                                                        <span className="flex items-center gap-1 text-emerald-400">
                                                            <Sparkles className="h-3 w-3" />
                                                            Exaucée le {format(new Date(prayer.answered_at), 'dd MMM yyyy', { locale: fr })}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex flex-col gap-2 shrink-0">
                                                {!prayer.is_answered ? (
                                                    <Button
                                                        className="bg-emerald-600 hover:bg-emerald-500 rounded-xl gap-2"
                                                        onClick={() => {
                                                            setSelectedPrayer(prayer);
                                                            setIsDialogOpen(true);
                                                        }}
                                                    >
                                                        <CheckCircle2 className="h-4 w-4" />
                                                        Exaucée
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        variant="ghost"
                                                        className="rounded-xl gap-2 bg-white/5"
                                                        onClick={() => toggleLock(prayer.id, prayer.is_locked || false)}
                                                    >
                                                        {prayer.is_locked ? (
                                                            <>
                                                                <Unlock className="h-4 w-4" />
                                                                Déverrouiller
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Lock className="h-4 w-4" />
                                                                Verrouiller
                                                            </>
                                                        )}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* Confirmation Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="bg-[#0F1219] border-white/10 text-white max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-amber-400" />
                            Marquer comme exaucée
                        </DialogTitle>
                        <DialogDescription className="text-slate-400">
                            Cette action indiquera que Dieu a répondu à cette prière et enverra une notification à l'auteur.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedPrayer && (
                        <div className="space-y-4 pt-4">
                            {/* Prayer Preview */}
                            <div className="p-4 bg-white/5 rounded-xl">
                                <p className="text-sm text-slate-300 line-clamp-4">
                                    "{selectedPrayer.content}"
                                </p>
                                <p className="text-xs text-slate-500 mt-2">
                                    — {selectedPrayer.is_anonymous ? 'Anonyme' : selectedPrayer.profiles?.full_name}
                                </p>
                            </div>

                            {/* Note (optional) */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase">
                                    Note (optionnel)
                                </label>
                                <Textarea
                                    placeholder="Message d'encouragement..."
                                    value={answerNote}
                                    onChange={(e) => setAnswerNote(e.target.value)}
                                    className="bg-white/5 border-white/10 rounded-xl min-h-[80px]"
                                />
                            </div>

                            {/* Warning */}
                            <div className="flex items-start gap-3 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                                <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-300/80">
                                    La prière sera verrouillée et un badge "Prière exaucée" sera affiché publiquement.
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <Button
                                    variant="ghost"
                                    className="flex-1 rounded-xl"
                                    onClick={() => {
                                        setIsDialogOpen(false);
                                        setSelectedPrayer(null);
                                        setAnswerNote('');
                                    }}
                                >
                                    Annuler
                                </Button>
                                <Button
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 rounded-xl gap-2"
                                    onClick={() => markAsAnswered(selectedPrayer.id)}
                                    disabled={processing}
                                >
                                    {processing ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <>
                                            <Check className="h-4 w-4" />
                                            Confirmer
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
