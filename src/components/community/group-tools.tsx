'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BarChart3, Plus, X, Check, Loader2, Pin, Calendar,
    Vote, Users, FileText, Clock, Sparkles, Send, Heart,
    ChevronDown, ChevronUp, Trash2, Crown, Bell
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
}

export function GroupPollWidget({ groupId, userId, userName }: GroupPollWidgetProps) {
    const [polls, setPolls] = useState<GroupPoll[]>([]);
    const [showCreatePoll, setShowCreatePoll] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newQuestion, setNewQuestion] = useState('');
    const [newOptions, setNewOptions] = useState(['', '']);
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [isMultiple, setIsMultiple] = useState(false);
    const [expandedPoll, setExpandedPoll] = useState<string | null>(null);

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
                    // Toggle vote
                    if (opt.voters.includes(userId)) {
                        return { ...opt, votes: opt.votes - 1, voters: opt.voters.filter(v => v !== userId) };
                    } else {
                        return { ...opt, votes: opt.votes + 1, voters: [...opt.voters, userId] };
                    }
                }
                // If not multiple choice, remove vote from other options
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
            {/* Create Poll Button */}
            <Button
                size="sm"
                className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 gap-2 h-9"
                onClick={() => setShowCreatePoll(true)}
            >
                <BarChart3 className="h-4 w-4" />
                Créer un sondage
            </Button>

            {/* Active Polls */}
            {polls.map(poll => (
                <motion.div
                    key={poll.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-violet-500/5 border border-violet-500/20 rounded-2xl p-4 space-y-3"
                >
                    <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <BarChart3 className="h-4 w-4 text-violet-400 shrink-0" />
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
                        {poll.created_by === userId && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-slate-500 hover:text-red-400"
                                onClick={() => deletePoll(poll.id)}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        )}
                    </div>

                    {/* Poll Options */}
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
                                        "w-full rounded-xl p-3 text-left relative overflow-hidden transition-all",
                                        hasVoted
                                            ? "border-2 border-violet-500/40 bg-violet-500/10"
                                            : "border border-white/10 bg-white/5 hover:bg-white/10"
                                    )}
                                >
                                    {/* Background progress bar */}
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${percentage}%` }}
                                        transition={{ duration: 0.5, ease: 'easeOut' }}
                                        className="absolute inset-0 bg-violet-500/10 rounded-xl"
                                    />
                                    <div className="relative flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {hasVoted && <Check className="h-3.5 w-3.5 text-violet-400" />}
                                            <span className={cn("text-sm", hasVoted ? "text-white font-bold" : "text-slate-300")}>
                                                {opt.text}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
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
            // Upsert - create or update
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
        <motion.div
            className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-4 space-y-3"
        >
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

            {/* Progress bar */}
            <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
                />
            </div>

            {/* Pray button */}
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
                        <>
                            <Check className="h-4 w-4 mr-2" />
                            J'ai prié aujourd'hui ✨
                        </>
                    ) : (
                        <>
                            <Heart className="h-4 w-4 mr-2" />
                            Je prie maintenant 🙏
                        </>
                    )}

                    {/* Animation */}
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

            {/* Recent prayers */}
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
}

export function GroupEventsWidget({ groupId, userId, userName }: GroupEventsWidgetProps) {
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
            <Button
                size="sm"
                className="w-full rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 gap-2 h-9"
                onClick={() => setShowCreate(true)}
            >
                <Calendar className="h-4 w-4" />
                Créer un événement
            </Button>

            {/* Events list */}
            {events.map(event => {
                const isAttending = event.attendees?.includes(userId);
                const isExpired = new Date(event.event_date) < new Date();

                return (
                    <motion.div
                        key={event.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                            "border rounded-2xl p-4",
                            isExpired
                                ? "bg-slate-500/5 border-slate-500/10 opacity-60"
                                : "bg-teal-500/5 border-teal-500/20"
                        )}
                    >
                        <div className="flex items-start gap-3">
                            <div className="w-12 h-14 rounded-xl bg-gradient-to-br from-teal-500/20 to-cyan-500/20 flex flex-col items-center justify-center shrink-0">
                                <span className="text-[10px] text-teal-300 font-bold uppercase">
                                    {new Date(event.event_date + 'T00:00:00').toLocaleDateString('fr-FR', { month: 'short' })}
                                </span>
                                <span className="text-lg font-black text-white">
                                    {new Date(event.event_date + 'T00:00:00').getDate()}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-white text-sm truncate">{event.title}</h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <Clock className="h-3 w-3 text-slate-500" />
                                    <span className="text-xs text-slate-400">
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
                                    {!isExpired && (
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
                                    )}
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
                                className="mt-1 bg-white/5 border-white/10 rounded-xl min-h-[60px] resize-none"
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
                                    Créer l'événement
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
// 4. GROUP TOOLS PANEL (combines all features)
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
    const [activeSection, setActiveSection] = useState<'polls' | 'prayer' | 'events' | null>(null);

    const tools = [
        {
            id: 'polls' as const,
            icon: BarChart3,
            label: 'Sondages',
            gradient: 'from-violet-600 to-purple-600',
            description: 'Créer des sondages'
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
            description: 'Planifier des rencontres'
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
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-3 mt-3">
                        {/* Tool buttons */}
                        {activeSection === null ? (
                            <div className="grid grid-cols-3 gap-2">
                                {tools.map(tool => (
                                    <motion.button
                                        key={tool.id}
                                        whileHover={{ scale: 1.03 }}
                                        whileTap={{ scale: 0.97 }}
                                        onClick={() => setActiveSection(tool.id)}
                                        className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all text-center space-y-1.5"
                                    >
                                        <div className={cn(
                                            "w-9 h-9 rounded-lg bg-gradient-to-br mx-auto flex items-center justify-center",
                                            tool.gradient
                                        )}>
                                            <tool.icon className="h-4 w-4 text-white" />
                                        </div>
                                        <p className="text-xs font-bold text-white">{tool.label}</p>
                                        <p className="text-[9px] text-slate-500">{tool.description}</p>
                                    </motion.button>
                                ))}
                            </div>
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
                                    <GroupPollWidget groupId={groupId} userId={userId} userName={userName} />
                                )}
                                {activeSection === 'prayer' && (
                                    <CollectivePrayerCounter groupId={groupId} userId={userId} userName={userName} />
                                )}
                                {activeSection === 'events' && (
                                    <GroupEventsWidget groupId={groupId} userId={userId} userName={userName} />
                                )}
                            </>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
