'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BarChart3, Plus, X, Check, Loader2, Calendar,
    Users, Clock, Send, Heart, BookOpen, MessageSquare,
    ChevronDown, Trash2, Crown, Sparkles, Target, Megaphone, FileText, PlusCircle
} from 'lucide-react';
import { programData } from '@/lib/program-data';
import { DailyProgram } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

// =====================================================
// 1. GROUP POLL SYSTEM
// =====================================================

interface PollOption {
    id: string;
    text: string;
    votes: number;
    voters: string[];
}

interface GroupPoll {
    id: string;
    group_id: string;
    question: string;
    options: PollOption[];
    created_by: string;
    creator_name: string;
    is_anonymous: boolean;
    is_multiple: boolean;
    expires_at: string | null;
    created_at: string;
    total_votes: number;
}

interface GroupPollWidgetProps {
    groupId: string;
    userId: string;
    userName: string;
    isCreator: boolean;
}

export function GroupPollWidget({ groupId, userId, userName, isCreator }: GroupPollWidgetProps) {
    const [polls, setPolls] = useState<GroupPoll[]>([]);
    const [showCreatePoll, setShowCreatePoll] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newQuestion, setNewQuestion] = useState('');
    const [newOptions, setNewOptions] = useState(['', '']);
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [isMultiple, setIsMultiple] = useState(false);

    const loadPolls = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('group_polls')
                .select('*')
                .eq('group_id', groupId)
                .order('created_at', { ascending: false })
                .limit(10);

            if (!error && data) {
                setPolls(data.map(p => ({
                    ...p,
                    options: typeof p.options === 'string' ? JSON.parse(p.options) : p.options || [],
                    total_votes: (typeof p.options === 'string' ? JSON.parse(p.options) : p.options || [])
                        .reduce((sum: number, opt: PollOption) => sum + (opt.votes || 0), 0)
                })));
            }
        } catch (e) {
            console.log('Polls table may not exist yet');
        }
    }, [groupId]);

    useEffect(() => {
        loadPolls();
    }, [loadPolls]);

    // Realtime subscription for poll updates (Point 3: admin sees votes in real-time)
    useEffect(() => {
        const channel = supabase
            .channel(`polls_${groupId}_${Date.now()}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'group_polls',
                filter: `group_id=eq.${groupId}`,
            }, () => {
                loadPolls();
            })
            .subscribe();

        return () => { channel.unsubscribe(); };
    }, [groupId, loadPolls]);

    const createPoll = async () => {
        const validOptions = newOptions.filter(o => o.trim());
        if (!newQuestion.trim() || validOptions.length < 2) {
            toast.error('Question et au moins 2 options requises');
            return;
        }

        setCreating(true);
        try {
            const pollOptions: PollOption[] = validOptions.map((text, i) => ({
                id: `opt_${i}_${Date.now()}`,
                text: text.trim(),
                votes: 0,
                voters: []
            }));

            const { error } = await supabase
                .from('group_polls')
                .insert({
                    group_id: groupId,
                    question: newQuestion.trim(),
                    options: pollOptions,
                    created_by: userId,
                    creator_name: userName,
                    is_anonymous: isAnonymous,
                    is_multiple: isMultiple,
                });

            if (error) throw error;

            toast.success('Sondage créé ! 📊');
            setNewQuestion('');
            setNewOptions(['', '']);
            setShowCreatePoll(false);
            loadPolls();
        } catch (e: any) {
            console.error('Error creating poll:', e);
            toast.error(e.message?.includes('does not exist')
                ? 'La table group_polls n\'existe pas encore. Exécutez la migration SQL.'
                : 'Erreur lors de la création du sondage');
        }
        setCreating(false);
    };

    const votePoll = async (pollId: string, optionId: string) => {
        try {
            const poll = polls.find(p => p.id === pollId);
            if (!poll) return;

            const updatedOptions = poll.options.map(opt => {
                if (opt.id === optionId) {
                    if (opt.voters.includes(userId)) {
                        return { ...opt, votes: opt.votes - 1, voters: opt.voters.filter(v => v !== userId) };
                    } else {
                        return { ...opt, votes: opt.votes + 1, voters: [...opt.voters, userId] };
                    }
                }
                if (!poll.is_multiple && opt.voters.includes(userId)) {
                    return { ...opt, votes: opt.votes - 1, voters: opt.voters.filter(v => v !== userId) };
                }
                return opt;
            });

            const { error } = await supabase
                .from('group_polls')
                .update({ options: updatedOptions })
                .eq('id', pollId);

            if (error) throw error;

            setPolls(prev => prev.map(p =>
                p.id === pollId ? {
                    ...p,
                    options: updatedOptions,
                    total_votes: updatedOptions.reduce((sum, opt) => sum + opt.votes, 0)
                } : p
            ));
        } catch (e) {
            console.error('Error voting:', e);
            toast.error('Erreur lors du vote');
        }
    };

    const deletePoll = async (pollId: string) => {
        try {
            await supabase.from('group_polls').delete().eq('id', pollId);
            setPolls(prev => prev.filter(p => p.id !== pollId));
            toast.success('Sondage supprimé');
        } catch (e) {
            console.error('Error deleting poll:', e);
        }
    };

    return (
        <div className="space-y-3">
            {/* Create Poll Button - only for creator */}
            {isCreator && (
                <Button
                    size="sm"
                    className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 gap-2 h-9"
                    onClick={() => setShowCreatePoll(true)}
                >
                    <BarChart3 className="h-4 w-4" />
                    Créer un sondage
                </Button>
            )}

            {/* Active Polls - visible by everyone */}
            {polls.length === 0 && (
                <div className="text-center py-4">
                    <BarChart3 className="h-8 w-8 text-slate-700 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">Aucun sondage actif</p>
                </div>
            )}

            {polls.map(poll => (
                <motion.div
                    key={poll.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-violet-500/5 border border-violet-500/20 rounded-2xl p-3 sm:p-4 space-y-3"
                >
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <BarChart3 className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                                <span className="text-[10px] text-violet-400 font-bold uppercase">Sondage</span>
                                {poll.is_anonymous && (
                                    <Badge className="bg-slate-500/20 text-slate-400 border-none text-[9px]">Anonyme</Badge>
                                )}
                            </div>
                            <p className="font-bold text-white text-sm">{poll.question}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                                par {poll.creator_name} • {formatDistanceToNow(new Date(poll.created_at), { addSuffix: true, locale: fr })}
                            </p>
                        </div>
                        {(poll.created_by === userId || isCreator) && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-slate-500 hover:text-red-400 shrink-0"
                                onClick={() => deletePoll(poll.id)}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        )}
                    </div>

                    <div className="space-y-2">
                        {poll.options.map(opt => {
                            const hasVoted = opt.voters.includes(userId);
                            const percentage = poll.total_votes > 0 ? Math.round((opt.votes / poll.total_votes) * 100) : 0;
                            return (
                                <motion.button
                                    key={opt.id}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => votePoll(poll.id, opt.id)}
                                    className={cn(
                                        "w-full rounded-xl p-2.5 sm:p-3 text-left relative overflow-hidden transition-all",
                                        hasVoted
                                            ? "border-2 border-violet-500/40 bg-violet-500/10"
                                            : "border border-white/10 bg-white/5 hover:bg-white/10"
                                    )}
                                >
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${percentage}%` }}
                                        transition={{ duration: 0.5, ease: 'easeOut' }}
                                        className="absolute inset-0 bg-violet-500/10 rounded-xl"
                                    />
                                    <div className="relative flex items-center justify-between">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            {hasVoted && <Check className="h-3.5 w-3.5 text-violet-400 shrink-0" />}
                                            <span className={cn("text-sm truncate", hasVoted ? "text-white font-bold" : "text-slate-300")}>
                                                {opt.text}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                            <span className="text-xs text-slate-400 font-mono">{percentage}%</span>
                                            <span className="text-[10px] text-slate-500">({opt.votes})</span>
                                        </div>
                                    </div>
                                </motion.button>
                            );
                        })}
                    </div>

                    <p className="text-[10px] text-slate-600 text-center">
                        {poll.total_votes} vote{poll.total_votes !== 1 ? 's' : ''} • {poll.is_multiple ? 'Choix multiples' : 'Choix unique'}
                    </p>
                </motion.div>
            ))}

            {/* Create Poll Dialog */}
            <Dialog open={showCreatePoll} onOpenChange={setShowCreatePoll}>
                <DialogContent className="bg-[#0F1219] border-white/10 text-white max-w-[95vw] sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
                                <BarChart3 className="h-4 w-4" />
                            </div>
                            Nouveau sondage
                        </DialogTitle>
                        <DialogDescription className="text-slate-400">
                            Posez une question au groupe
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 pt-2">
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Question *</label>
                            <Input
                                value={newQuestion}
                                onChange={e => setNewQuestion(e.target.value)}
                                placeholder="Quelle est votre question ?"
                                className="mt-1 bg-white/5 border-white/10 rounded-xl"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Options</label>
                            {newOptions.map((opt, i) => (
                                <div key={i} className="flex gap-2">
                                    <Input
                                        value={opt}
                                        onChange={e => {
                                            const updated = [...newOptions];
                                            updated[i] = e.target.value;
                                            setNewOptions(updated);
                                        }}
                                        placeholder={`Option ${i + 1}`}
                                        className="bg-white/5 border-white/10 rounded-xl"
                                    />
                                    {i >= 2 && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="shrink-0 text-red-400"
                                            onClick={() => setNewOptions(prev => prev.filter((_, idx) => idx !== i))}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                            {newOptions.length < 6 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full rounded-xl bg-white/5 text-slate-400 h-9"
                                    onClick={() => setNewOptions(prev => [...prev, ''])}
                                >
                                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                                    Ajouter une option
                                </Button>
                            )}
                        </div>

                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isMultiple}
                                    onChange={e => setIsMultiple(e.target.checked)}
                                    className="rounded"
                                />
                                Choix multiples
                            </label>
                            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isAnonymous}
                                    onChange={e => setIsAnonymous(e.target.checked)}
                                    className="rounded"
                                />
                                Votes anonymes
                            </label>
                        </div>

                        <Button
                            className="w-full h-11 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 font-bold"
                            onClick={createPoll}
                            disabled={creating || !newQuestion.trim() || newOptions.filter(o => o.trim()).length < 2}
                        >
                            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                                <>
                                    <BarChart3 className="h-4 w-4 mr-2" />
                                    Publier le sondage
                                </>
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}


// =====================================================
// 2. COLLECTIVE PRAYER COUNTER
// =====================================================

interface PrayerCounterProps {
    groupId: string;
    userId: string;
    userName: string;
}

export function CollectivePrayerCounter({ groupId, userId, userName }: PrayerCounterProps) {
    const [prayerCount, setPrayerCount] = useState(0);
    const [userHasPrayed, setUserHasPrayed] = useState(false);
    const [prayerGoal, setPrayerGoal] = useState(100);
    const [recentPrayers, setRecentPrayers] = useState<{ name: string; time: string }[]>([]);
    const [showAnimation, setShowAnimation] = useState(false);

    const loadPrayerData = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('group_prayer_counter')
                .select('*')
                .eq('group_id', groupId)
                .single();

            if (!error && data) {
                setPrayerCount(data.count || 0);
                setPrayerGoal(data.goal || 100);
                setRecentPrayers(data.recent_prayers || []);
                setUserHasPrayed(
                    (data.recent_prayers || []).some(
                        (p: any) => p.user_id === userId && isToday(new Date(p.time))
                    )
                );
            }
        } catch (e) {
            console.log('Prayer counter table may not exist');
        }
    }, [groupId, userId]);

    useEffect(() => {
        loadPrayerData();
    }, [loadPrayerData]);

    const isToday = (date: Date) => {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };

    const addPrayer = async () => {
        if (userHasPrayed) {
            toast.info('Vous avez déjà prié aujourd\'hui ! 🙏');
            return;
        }

        setShowAnimation(true);
        setTimeout(() => setShowAnimation(false), 2000);

        const newRecentPrayer = {
            user_id: userId,
            name: userName,
            time: new Date().toISOString()
        };

        const newCount = prayerCount + 1;

        try {
            const { error } = await supabase
                .from('group_prayer_counter')
                .upsert({
                    group_id: groupId,
                    count: newCount,
                    goal: prayerGoal,
                    recent_prayers: [newRecentPrayer, ...recentPrayers].slice(0, 20)
                }, { onConflict: 'group_id' });

            if (error) throw error;

            setPrayerCount(newCount);
            setUserHasPrayed(true);
            setRecentPrayers(prev => [newRecentPrayer, ...prev].slice(0, 20));
            toast.success('Prière ajoutée ! 🙏✨');
        } catch (e: any) {
            console.error('Error adding prayer:', e);
            if (e.message?.includes('does not exist')) {
                toast.error('Table group_prayer_counter pas encore créée');
            }
        }
    };

    const progress = Math.min((prayerCount / prayerGoal) * 100, 100);

    return (
        <motion.div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-3 sm:p-4 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                        <Heart className="h-4 w-4 text-white" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-white">Prières collectives</h4>
                        <p className="text-[10px] text-slate-400">Objectif : {prayerGoal} prières</p>
                    </div>
                </div>
                <div className="text-right">
                    <span className="text-2xl font-black text-amber-400">{prayerCount}</span>
                    <span className="text-xs text-slate-500">/{prayerGoal}</span>
                </div>
            </div>

            <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
                />
            </div>

            <motion.div whileTap={{ scale: 0.95 }}>
                <Button
                    className={cn(
                        "w-full h-11 rounded-xl font-bold relative overflow-hidden",
                        userHasPrayed
                            ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-gradient-to-r from-amber-500 to-orange-600 shadow-lg shadow-amber-500/20"
                    )}
                    onClick={addPrayer}
                    disabled={userHasPrayed}
                >
                    {userHasPrayed ? (
                        <><Check className="h-4 w-4 mr-2" /> J&apos;ai prié aujourd&apos;hui ✨</>
                    ) : (
                        <><Heart className="h-4 w-4 mr-2" /> Je prie maintenant 🙏</>
                    )}

                    <AnimatePresence>
                        {showAnimation && (
                            <motion.div
                                initial={{ opacity: 1, scale: 0.5 }}
                                animate={{ opacity: 0, scale: 2, y: -50 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                            >
                                <span className="text-3xl">🙏</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Button>
            </motion.div>

            {recentPrayers.length > 0 && (
                <div className="pt-2 border-t border-white/5">
                    <p className="text-[10px] text-slate-500 mb-1.5">Dernières prières :</p>
                    <div className="flex flex-wrap gap-1">
                        {recentPrayers.slice(0, 5).map((p, i) => (
                            <Badge key={i} className="bg-white/5 text-slate-400 border-none text-[9px]">
                                {p.name} • {formatDistanceToNow(new Date(p.time), { addSuffix: true, locale: fr })}
                            </Badge>
                        ))}
                    </div>
                </div>
            )}
        </motion.div>
    );
}


// =====================================================
// 3. GROUP EVENTS SYSTEM (NATIVE)
// =====================================================

interface GroupEvent {
    id: string;
    group_id: string;
    title: string;
    description: string;
    event_date: string;
    event_time: string;
    created_by: string;
    creator_name: string;
    attendees: string[];
    created_at: string;
}

interface GroupEventsWidgetProps {
    groupId: string;
    userId: string;
    userName: string;
    isCreator: boolean;
}

export function GroupEventsWidget({ groupId, userId, userName, isCreator }: GroupEventsWidgetProps) {
    const [events, setEvents] = useState<GroupEvent[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newDate, setNewDate] = useState('');
    const [newTime, setNewTime] = useState('18:00');

    const loadEvents = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('group_events')
                .select('*')
                .eq('group_id', groupId)
                .gte('event_date', new Date().toISOString().split('T')[0])
                .order('event_date', { ascending: true })
                .limit(10);

            if (!error && data) {
                setEvents(data);
            }
        } catch (e) {
            console.log('Events table may not exist');
        }
    }, [groupId]);

    useEffect(() => {
        loadEvents();
    }, [loadEvents]);

    const createEvent = async () => {
        if (!newTitle.trim() || !newDate) {
            toast.error('Titre et date requis');
            return;
        }

        setCreating(true);
        try {
            const { error } = await supabase
                .from('group_events')
                .insert({
                    group_id: groupId,
                    title: newTitle.trim(),
                    description: newDescription.trim(),
                    event_date: newDate,
                    event_time: newTime,
                    created_by: userId,
                    creator_name: userName,
                    attendees: [userId]
                });

            if (error) throw error;

            toast.success('Événement créé ! 📅');
            setNewTitle('');
            setNewDescription('');
            setShowCreate(false);
            loadEvents();
        } catch (e: any) {
            console.error('Error creating event:', e);
            toast.error(e.message?.includes('does not exist')
                ? 'Table group_events pas encore créée'
                : 'Erreur lors de la création');
        }
        setCreating(false);
    };

    const toggleAttendance = async (eventId: string) => {
        const event = events.find(e => e.id === eventId);
        if (!event) return;

        const isAttending = event.attendees?.includes(userId);
        const updatedAttendees = isAttending
            ? event.attendees.filter(a => a !== userId)
            : [...(event.attendees || []), userId];

        try {
            await supabase
                .from('group_events')
                .update({ attendees: updatedAttendees })
                .eq('id', eventId);

            setEvents(prev => prev.map(e =>
                e.id === eventId ? { ...e, attendees: updatedAttendees } : e
            ));

            toast.success(isAttending ? 'Participation annulée' : 'Participation confirmée ! 🎉');
        } catch (e) {
            console.error('Error toggling attendance:', e);
        }
    };

    const formatEventDate = (date: string) => {
        const d = new Date(date + 'T00:00:00');
        return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
    };

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDate = tomorrow.toISOString().split('T')[0];

    return (
        <div className="space-y-3">
            {/* Creator only */}
            {isCreator && (
                <Button
                    size="sm"
                    className="w-full rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 gap-2 h-9"
                    onClick={() => setShowCreate(true)}
                >
                    <Calendar className="h-4 w-4" />
                    Créer un événement
                </Button>
            )}

            {events.map(event => {
                const isAttending = event.attendees?.includes(userId);
                return (
                    <motion.div
                        key={event.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-teal-500/5 border border-teal-500/20 rounded-2xl p-3 sm:p-4"
                    >
                        <div className="flex items-start gap-3">
                            <div className="w-11 h-13 rounded-xl bg-gradient-to-br from-teal-500/20 to-cyan-500/20 flex flex-col items-center justify-center shrink-0 p-1">
                                <span className="text-[9px] text-teal-300 font-bold uppercase">
                                    {new Date(event.event_date + 'T00:00:00').toLocaleDateString('fr-FR', { month: 'short' })}
                                </span>
                                <span className="text-lg font-black text-white leading-none">
                                    {new Date(event.event_date + 'T00:00:00').getDate()}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-white text-sm truncate">{event.title}</h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <Clock className="h-3 w-3 text-slate-500 shrink-0" />
                                    <span className="text-xs text-slate-400 truncate">
                                        {formatEventDate(event.event_date)} à {event.event_time}
                                    </span>
                                </div>
                                {event.description && (
                                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{event.description}</p>
                                )}
                                <div className="flex items-center justify-between mt-2">
                                    <span className="text-[10px] text-slate-500">
                                        {event.attendees?.length || 0} participant(s)
                                    </span>
                                    <Button
                                        size="sm"
                                        className={cn(
                                            "h-7 px-3 rounded-lg text-[10px] font-bold",
                                            isAttending
                                                ? "bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30"
                                                : "bg-teal-600 hover:bg-teal-500"
                                        )}
                                        onClick={() => toggleAttendance(event.id)}
                                    >
                                        {isAttending ? (
                                            <><Check className="h-3 w-3 mr-1" /> Inscrit</>
                                        ) : (
                                            <><Plus className="h-3 w-3 mr-1" /> Participer</>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                );
            })}

            {events.length === 0 && (
                <div className="text-center py-4">
                    <Calendar className="h-8 w-8 text-slate-700 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">Aucun événement à venir</p>
                </div>
            )}

            {/* Create Event Dialog */}
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent className="bg-[#0F1219] border-white/10 text-white max-w-[95vw] sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center">
                                <Calendar className="h-4 w-4" />
                            </div>
                            Nouvel événement
                        </DialogTitle>
                        <DialogDescription className="text-slate-400">
                            Planifiez un moment de prière en groupe
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 pt-2">
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Titre *</label>
                            <Input
                                value={newTitle}
                                onChange={e => setNewTitle(e.target.value)}
                                placeholder="Ex: Prière de jeûne du mardi"
                                className="mt-1 bg-white/5 border-white/10 rounded-xl"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Description</label>
                            <Textarea
                                value={newDescription}
                                onChange={e => setNewDescription(e.target.value)}
                                placeholder="Détails de l'événement..."
                                className="mt-1 bg-white/5 border-white/10 rounded-xl min-h-[80px] resize-none"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Date *</label>
                                <Input
                                    type="date"
                                    value={newDate}
                                    onChange={e => setNewDate(e.target.value)}
                                    min={minDate}
                                    className="mt-1 bg-white/5 border-white/10 rounded-xl"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Heure</label>
                                <Input
                                    type="time"
                                    value={newTime}
                                    onChange={e => setNewTime(e.target.value)}
                                    className="mt-1 bg-white/5 border-white/10 rounded-xl"
                                />
                            </div>
                        </div>
                        <Button
                            className="w-full h-11 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 font-bold"
                            onClick={createEvent}
                            disabled={creating || !newTitle.trim() || !newDate}
                        >
                            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                                <>
                                    <Calendar className="h-4 w-4 mr-2" />
                                    Créer l&apos;événement
                                </>
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}


// =====================================================
// 4. GROUP TOOLS PANEL (5 tools - creator publishes, members interact)
// =====================================================

interface GroupToolsPanelProps {
    groupId: string;
    userId: string;
    userName: string;
    isCreator: boolean;
    onClose: () => void;
    isOpen: boolean;
}

export function GroupToolsPanel({ groupId, userId, userName, isCreator, onClose, isOpen }: GroupToolsPanelProps) {
    const [activeSection, setActiveSection] = useState<'polls' | 'prayer' | 'events' | 'verse' | 'announcement' | 'program' | null>(null);
    const [dailyVerse, setDailyVerse] = useState('');
    const [announcement, setAnnouncement] = useState('');
    const [savedVerse, setSavedVerse] = useState<string | null>(null);
    const [savedAnnouncement, setSavedAnnouncement] = useState<string | null>(null);

    // Program state
    const [publishedDay, setPublishedDay] = useState<number | null>(null);
    const [customDays, setCustomDays] = useState<DailyProgram[]>([]);
    const [showAddDay, setShowAddDay] = useState(false);
    const [newDayTitle, setNewDayTitle] = useState('');
    const [newDayTheme, setNewDayTheme] = useState('');
    const [newDayReading, setNewDayReading] = useState('');
    const [newDayPassage, setNewDayPassage] = useState('');
    const [newDayPrayers, setNewDayPrayers] = useState('');
    const [newDayMeditation, setNewDayMeditation] = useState('');
    const [newDayAction, setNewDayAction] = useState('');

    // Load saved verse and announcement from localStorage
    useEffect(() => {
        if (isOpen) {
            const verse = localStorage.getItem(`group_verse_${groupId}`);
            const ann = localStorage.getItem(`group_announcement_${groupId}`);
            const pubDay = localStorage.getItem(`group_program_day_${groupId}`);
            const cDays = localStorage.getItem(`group_custom_days_${groupId}`);
            if (verse) setSavedVerse(verse);
            if (ann) setSavedAnnouncement(ann);
            if (pubDay) setPublishedDay(parseInt(pubDay));
            if (cDays) try { setCustomDays(JSON.parse(cDays)); } catch { }
        }
    }, [isOpen, groupId]);

    const allProgramDays = [...programData, ...customDays];

    const publishProgram = (dayNum: number) => {
        localStorage.setItem(`group_program_day_${groupId}`, String(dayNum));
        setPublishedDay(dayNum);
        toast.success(`Programme du Jour ${dayNum} publié ! 📋`);
    };

    const addCustomDay = () => {
        if (!newDayTitle.trim() || !newDayTheme.trim()) return;
        const nextDay = allProgramDays.length + 1;
        const newDay: DailyProgram = {
            day: nextDay,
            title: newDayTitle.trim(),
            theme: newDayTheme.trim(),
            bibleReading: {
                reference: newDayReading.trim() || 'À définir',
                passage: newDayPassage.trim() || '',
            },
            prayerFocus: newDayPrayers.split('\n').filter(l => l.trim()),
            meditation: newDayMeditation.trim() || '',
            practicalAction: newDayAction.trim() || '',
        };
        const updated = [...customDays, newDay];
        setCustomDays(updated);
        localStorage.setItem(`group_custom_days_${groupId}`, JSON.stringify(updated));
        setNewDayTitle(''); setNewDayTheme(''); setNewDayReading(''); setNewDayPassage('');
        setNewDayPrayers(''); setNewDayMeditation(''); setNewDayAction('');
        setShowAddDay(false);
        toast.success(`Jour ${nextDay} ajouté au programme ! 🎉`);
    };

    const saveVerse = () => {
        if (!dailyVerse.trim()) return;
        localStorage.setItem(`group_verse_${groupId}`, dailyVerse.trim());
        setSavedVerse(dailyVerse.trim());
        setDailyVerse('');
        toast.success('Verset du jour épinglé ! 📖');
    };

    const saveAnnouncement = () => {
        if (!announcement.trim()) return;
        localStorage.setItem(`group_announcement_${groupId}`, announcement.trim());
        setSavedAnnouncement(announcement.trim());
        setAnnouncement('');
        toast.success('Annonce publiée ! 📢');
    };

    const tools = [
        {
            id: 'polls' as const,
            icon: BarChart3,
            label: 'Sondages',
            gradient: 'from-violet-600 to-purple-600',
            description: 'Voter & créer'
        },
        {
            id: 'prayer' as const,
            icon: Heart,
            label: 'Prières',
            gradient: 'from-amber-500 to-orange-600',
            description: 'Compteur collectif'
        },
        {
            id: 'events' as const,
            icon: Calendar,
            label: 'Événements',
            gradient: 'from-teal-600 to-cyan-600',
            description: 'Rendez-vous'
        },
        {
            id: 'verse' as const,
            icon: BookOpen,
            label: 'Verset du jour',
            gradient: 'from-sky-500 to-blue-600',
            description: 'Méditation'
        },
        {
            id: 'announcement' as const,
            icon: Megaphone,
            label: 'Annonces',
            gradient: 'from-rose-500 to-pink-600',
            description: 'Communiqués'
        },
        {
            id: 'program' as const,
            icon: FileText,
            label: 'Programme',
            gradient: 'from-lime-500 to-green-600',
            description: 'Jeûne & Prière'
        }
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                >
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3 sm:p-4 space-y-3 mt-3">
                        {/* Tool grid */}
                        {activeSection === null ? (
                            <>
                                {/* Pinned Content visible by all */}
                                {savedVerse && (
                                    <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-3 space-y-1">
                                        <div className="flex items-center gap-1.5">
                                            <BookOpen className="h-3.5 w-3.5 text-sky-400" />
                                            <span className="text-[10px] font-bold text-sky-400 uppercase">Verset du jour</span>
                                        </div>
                                        <p className="text-sm text-slate-200 italic">{savedVerse}</p>
                                    </div>
                                )}
                                {savedAnnouncement && (
                                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 space-y-1">
                                        <div className="flex items-center gap-1.5">
                                            <Megaphone className="h-3.5 w-3.5 text-rose-400" />
                                            <span className="text-[10px] font-bold text-rose-400 uppercase">Annonce</span>
                                        </div>
                                        <p className="text-sm text-slate-200">{savedAnnouncement}</p>
                                    </div>
                                )}

                                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                    {tools.map(tool => (
                                        <motion.button
                                            key={tool.id}
                                            whileHover={{ scale: 1.03 }}
                                            whileTap={{ scale: 0.97 }}
                                            onClick={() => setActiveSection(tool.id)}
                                            className="p-2.5 sm:p-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all text-center space-y-1"
                                        >
                                            <div className={cn(
                                                "w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-br mx-auto flex items-center justify-center",
                                                tool.gradient
                                            )}>
                                                <tool.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                                            </div>
                                            <p className="text-[10px] sm:text-xs font-bold text-white leading-tight">{tool.label}</p>
                                            <p className="text-[8px] sm:text-[9px] text-slate-500 leading-tight hidden sm:block">{tool.description}</p>
                                        </motion.button>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex items-center gap-2 mb-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 rounded-lg text-slate-400"
                                        onClick={() => setActiveSection(null)}
                                    >
                                        <ChevronDown className="h-3.5 w-3.5 mr-1 rotate-90" />
                                        Retour
                                    </Button>
                                    <span className="text-xs font-bold text-white">
                                        {tools.find(t => t.id === activeSection)?.label}
                                    </span>
                                </div>

                                {activeSection === 'polls' && (
                                    <GroupPollWidget groupId={groupId} userId={userId} userName={userName} isCreator={isCreator} />
                                )}
                                {activeSection === 'prayer' && (
                                    <CollectivePrayerCounter groupId={groupId} userId={userId} userName={userName} />
                                )}
                                {activeSection === 'events' && (
                                    <GroupEventsWidget groupId={groupId} userId={userId} userName={userName} isCreator={isCreator} />
                                )}
                                {activeSection === 'verse' && (
                                    <div className="space-y-3">
                                        {savedVerse && (
                                            <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-3">
                                                <p className="text-sm text-slate-200 italic">📖 {savedVerse}</p>
                                                {isCreator && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="mt-2 h-7 text-[10px] text-red-400"
                                                        onClick={() => {
                                                            localStorage.removeItem(`group_verse_${groupId}`);
                                                            setSavedVerse(null);
                                                        }}
                                                    >
                                                        <X className="h-3 w-3 mr-1" /> Retirer
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                        {isCreator ? (
                                            <div className="space-y-2">
                                                <Textarea
                                                    value={dailyVerse}
                                                    onChange={e => setDailyVerse(e.target.value)}
                                                    placeholder="Collez un verset biblique pour le groupe..."
                                                    className="bg-white/5 border-white/10 rounded-xl min-h-[80px] resize-none text-sm"
                                                />
                                                <Button
                                                    className="w-full h-9 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 font-bold text-xs"
                                                    onClick={saveVerse}
                                                    disabled={!dailyVerse.trim()}
                                                >
                                                    <BookOpen className="h-3.5 w-3.5 mr-1.5" />
                                                    Épingler le verset
                                                </Button>
                                            </div>
                                        ) : !savedVerse && (
                                            <div className="text-center py-4">
                                                <BookOpen className="h-8 w-8 text-slate-700 mx-auto mb-2" />
                                                <p className="text-xs text-slate-500">Aucun verset épinglé par le créateur</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {activeSection === 'announcement' && (
                                    <div className="space-y-3">
                                        {savedAnnouncement && (
                                            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
                                                <p className="text-sm text-slate-200">📢 {savedAnnouncement}</p>
                                                {isCreator && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="mt-2 h-7 text-[10px] text-red-400"
                                                        onClick={() => {
                                                            localStorage.removeItem(`group_announcement_${groupId}`);
                                                            setSavedAnnouncement(null);
                                                        }}
                                                    >
                                                        <X className="h-3 w-3 mr-1" /> Retirer
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                        {isCreator ? (
                                            <div className="space-y-2">
                                                <Textarea
                                                    value={announcement}
                                                    onChange={e => setAnnouncement(e.target.value)}
                                                    placeholder="Écrivez une annonce pour le groupe..."
                                                    className="bg-white/5 border-white/10 rounded-xl min-h-[80px] resize-none text-sm"
                                                />
                                                <Button
                                                    className="w-full h-9 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 font-bold text-xs"
                                                    onClick={saveAnnouncement}
                                                    disabled={!announcement.trim()}
                                                >
                                                    <Megaphone className="h-3.5 w-3.5 mr-1.5" />
                                                    Publier l&apos;annonce
                                                </Button>
                                            </div>
                                        ) : !savedAnnouncement && (
                                            <div className="text-center py-4">
                                                <Megaphone className="h-8 w-8 text-slate-700 mx-auto mb-2" />
                                                <p className="text-xs text-slate-500">Aucune annonce du créateur</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {activeSection === 'program' && (
                                    <div className="space-y-3">
                                        {/* Published day display */}
                                        {publishedDay && (() => {
                                            const day = allProgramDays.find(d => d.day === publishedDay);
                                            if (!day) return null;
                                            return (
                                                <div className="bg-lime-500/10 border border-lime-500/20 rounded-xl p-4 space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-1.5">
                                                            <FileText className="h-4 w-4 text-lime-400" />
                                                            <span className="text-xs font-bold text-lime-400 uppercase">Jour {day.day}</span>
                                                        </div>
                                                        {isCreator && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 text-[10px] text-red-400"
                                                                onClick={() => {
                                                                    localStorage.removeItem(`group_program_day_${groupId}`);
                                                                    setPublishedDay(null);
                                                                }}
                                                            >
                                                                <X className="h-3 w-3 mr-0.5" /> Retirer
                                                            </Button>
                                                        )}
                                                    </div>
                                                    <h3 className="text-sm font-bold text-white">{day.title}</h3>
                                                    <p className="text-xs text-slate-400 italic">{day.theme}</p>
                                                    <div className="bg-black/20 rounded-lg p-2 mt-2">
                                                        <p className="text-[10px] font-bold text-sky-400 uppercase">📖 Lecture</p>
                                                        <p className="text-xs text-slate-300">{day.bibleReading.reference}</p>
                                                        {day.bibleReading.passage && (
                                                            <p className="text-xs text-slate-400 italic mt-1">{day.bibleReading.passage}</p>
                                                        )}
                                                    </div>
                                                    {day.prayerFocus.length > 0 && (
                                                        <div className="bg-black/20 rounded-lg p-2">
                                                            <p className="text-[10px] font-bold text-amber-400 uppercase mb-1">🙏 Sujets de prière</p>
                                                            {day.prayerFocus.map((f, i) => (
                                                                <p key={i} className="text-xs text-slate-300">• {f}</p>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {day.meditation && (
                                                        <div className="bg-black/20 rounded-lg p-2">
                                                            <p className="text-[10px] font-bold text-purple-400 uppercase">💭 Méditation</p>
                                                            <p className="text-xs text-slate-300 italic">{day.meditation}</p>
                                                        </div>
                                                    )}
                                                    {day.practicalAction && (
                                                        <div className="bg-black/20 rounded-lg p-2">
                                                            <p className="text-[10px] font-bold text-emerald-400 uppercase">✅ Action pratique</p>
                                                            <p className="text-xs text-slate-300">{day.practicalAction}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}

                                        {/* Creator: publish a day */}
                                        {isCreator ? (
                                            <div className="space-y-3">
                                                <p className="text-xs text-slate-400">Sélectionnez un jour du programme à publier dans le groupe :</p>
                                                <div className="max-h-[300px] overflow-y-auto space-y-1.5 pr-1">
                                                    {allProgramDays.map(day => (
                                                        <div
                                                            key={day.day}
                                                            className={cn(
                                                                "flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all",
                                                                publishedDay === day.day
                                                                    ? "bg-lime-500/20 border-lime-500/40"
                                                                    : "bg-white/5 border-white/10 hover:bg-white/10"
                                                            )}
                                                            onClick={() => publishProgram(day.day)}
                                                        >
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={cn(
                                                                        "text-xs font-bold shrink-0 w-8 h-8 rounded-lg flex items-center justify-center",
                                                                        day.day > programData.length
                                                                            ? "bg-gradient-to-br from-orange-500 to-red-600 text-white"
                                                                            : "bg-gradient-to-br from-lime-500 to-green-600 text-white"
                                                                    )}>
                                                                        J{day.day}
                                                                    </span>
                                                                    <div className="min-w-0">
                                                                        <p className="text-xs font-bold text-white truncate">{day.title}</p>
                                                                        <p className="text-[10px] text-slate-500 truncate">{day.theme}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            {publishedDay === day.day && (
                                                                <Badge className="bg-lime-500/20 text-lime-400 border-none text-[8px] shrink-0 ml-2">
                                                                    <Check className="h-2.5 w-2.5 mr-0.5" /> Publié
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Add custom day button */}
                                                {!showAddDay ? (
                                                    <Button
                                                        className="w-full h-9 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 font-bold text-xs"
                                                        onClick={() => setShowAddDay(true)}
                                                    >
                                                        <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
                                                        Ajouter un jour (Jour {allProgramDays.length + 1})
                                                    </Button>
                                                ) : (
                                                    <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <h4 className="text-xs font-bold text-orange-400">Nouveau Jour {allProgramDays.length + 1}</h4>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 px-2 text-slate-400"
                                                                onClick={() => setShowAddDay(false)}
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                        <Input
                                                            value={newDayTitle}
                                                            onChange={e => setNewDayTitle(e.target.value)}
                                                            placeholder="Titre du jour *"
                                                            className="bg-white/5 border-white/10 rounded-lg h-8 text-xs"
                                                        />
                                                        <Input
                                                            value={newDayTheme}
                                                            onChange={e => setNewDayTheme(e.target.value)}
                                                            placeholder="Thème du jour *"
                                                            className="bg-white/5 border-white/10 rounded-lg h-8 text-xs"
                                                        />
                                                        <Input
                                                            value={newDayReading}
                                                            onChange={e => setNewDayReading(e.target.value)}
                                                            placeholder="Référence biblique (ex: Jean 3:16)"
                                                            className="bg-white/5 border-white/10 rounded-lg h-8 text-xs"
                                                        />
                                                        <Textarea
                                                            value={newDayPassage}
                                                            onChange={e => setNewDayPassage(e.target.value)}
                                                            placeholder="Passage / texte de lecture..."
                                                            className="bg-white/5 border-white/10 rounded-lg min-h-[60px] resize-none text-xs"
                                                        />
                                                        <Textarea
                                                            value={newDayPrayers}
                                                            onChange={e => setNewDayPrayers(e.target.value)}
                                                            placeholder="Sujets de prière (un par ligne)"
                                                            className="bg-white/5 border-white/10 rounded-lg min-h-[60px] resize-none text-xs"
                                                        />
                                                        <Textarea
                                                            value={newDayMeditation}
                                                            onChange={e => setNewDayMeditation(e.target.value)}
                                                            placeholder="Méditation..."
                                                            className="bg-white/5 border-white/10 rounded-lg min-h-[50px] resize-none text-xs"
                                                        />
                                                        <Input
                                                            value={newDayAction}
                                                            onChange={e => setNewDayAction(e.target.value)}
                                                            placeholder="Action pratique"
                                                            className="bg-white/5 border-white/10 rounded-lg h-8 text-xs"
                                                        />
                                                        <Button
                                                            className="w-full h-9 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 font-bold text-xs"
                                                            onClick={addCustomDay}
                                                            disabled={!newDayTitle.trim() || !newDayTheme.trim()}
                                                        >
                                                            <Check className="h-3.5 w-3.5 mr-1.5" />
                                                            Ajouter le Jour {allProgramDays.length + 1}
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        ) : !publishedDay && (
                                            <div className="text-center py-4">
                                                <FileText className="h-8 w-8 text-slate-700 mx-auto mb-2" />
                                                <p className="text-xs text-slate-500">Le créateur n&apos;a pas encore publié le programme du jour</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
