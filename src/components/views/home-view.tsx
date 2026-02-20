'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
    CalendarDays,
    UserPlus,
    Users,
    Heart,
    MessageSquare,
    Sparkles,
    BookOpen,
    ArrowLeft,
    Send,
    Smile,
    Lock,
    ChevronRight,
    Loader2,
    Trash2,
    UserX,
    MoreVertical,
    Pin,
    Eye,
    AlertTriangle,
    MapPin,
    Phone,
    User,
    KeyRound,
    Instagram,
    Tv,
    Monitor
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAppStore } from '@/lib/store';
import { getDay } from '@/lib/program-data';
import { cn } from '@/lib/utils';
import { TabType } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { NotificationBell } from '@/components/notification-bell';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

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

interface LiveComment {
    id: string;
    livestream_id: string;
    user_id: string;
    content: string;
    parent_id: string | null;
    is_pinned: boolean;
    created_at: string;
    profile?: {
        full_name: string | null;
        avatar_url: string | null;
    };
    replies?: LiveComment[];
}

const EMOJI_LIST = ['❤️', '🙏', '🔥', '👏', '😍', '✝️', '💪', '🙌', '😭', '💯', '⭐', '🕊️'];

// ===== LIVE REGISTRATION FLOW (step-by-step for guests) =====
function LiveRegistrationFlow({
    onComplete,
    onClose,
}: {
    onComplete: (userData: { name: string; country: string; phone: string }) => void;
    onClose: () => void;
}) {
    const [step, setStep] = useState(1);
    const [name, setName] = useState('');
    const [country, setCountry] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!name.trim() || !country.trim() || !phone.trim() || !password.trim()) return;

        setIsSubmitting(true);
        try {
            // Create user account with phone-based email (phone@maison.app)
            const fakeEmail = `${phone.replace(/[^0-9]/g, '')}@maisondepriere.app`;

            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                email: fakeEmail,
                password: password,
                options: {
                    data: {
                        full_name: name.trim(),
                        phone: phone.trim(),
                        country: country.trim(),
                    }
                }
            });

            if (signUpError) {
                // User might already exist — try sign in
                const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                    email: fakeEmail,
                    password: password,
                });
                if (signInError) {
                    toast.error("Erreur: " + signInError.message);
                    setIsSubmitting(false);
                    return;
                }
            }

            // Update profile
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (authUser) {
                await supabase.from('profiles').upsert({
                    id: authUser.id,
                    full_name: name.trim(),
                    phone: phone.trim(),
                    country: country.trim(),
                }, { onConflict: 'id' });
            }

            toast.success('🎉 Bienvenue ' + name.trim() + ' !');
            onComplete({ name: name.trim(), country: country.trim(), phone: phone.trim() });
        } catch (e: any) {
            toast.error("Erreur: " + (e.message || "Inscription échouée"));
        }
        setIsSubmitting(false);
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-gradient-to-b from-[#0F1219] to-[#1a1f2e] border border-white/10 rounded-3xl p-6 max-w-sm w-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Progress dots */}
                <div className="flex items-center justify-center gap-2 mb-6">
                    {[1, 2, 3, 4].map(s => (
                        <motion.div
                            key={s}
                            className={cn(
                                "w-2.5 h-2.5 rounded-full transition-all",
                                s <= step ? "bg-red-500" : "bg-white/20"
                            )}
                            animate={s === step ? { scale: [1, 1.3, 1] } : {}}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                        />
                    ))}
                </div>

                {/* Live indicator */}
                <div className="flex items-center justify-center gap-2 mb-4">
                    <div className="relative">
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-ping absolute" />
                        <div className="w-3 h-3 bg-red-500 rounded-full" />
                    </div>
                    <span className="text-red-400 font-bold text-sm">EN DIRECT</span>
                </div>

                <AnimatePresence mode="wait">
                    {/* Step 1: Name */}
                    {step === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-4"
                        >
                            <div className="text-center">
                                <User className="h-10 w-10 mx-auto text-indigo-400 mb-2" />
                                <h3 className="text-lg font-black text-white">Inscrivez votre nom</h3>
                                <p className="text-xs text-slate-400 mt-1">Pour rejoindre le live</p>
                            </div>
                            <Input
                                placeholder="Votre nom complet"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="h-12 rounded-xl bg-white/5 border-white/10 text-center text-lg"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && name.trim() && setStep(2)}
                            />
                            <Button
                                className="w-full h-12 rounded-xl bg-gradient-to-r from-red-600 to-pink-600 font-bold"
                                onClick={() => name.trim() && setStep(2)}
                                disabled={!name.trim()}
                            >
                                Continuer <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </motion.div>
                    )}

                    {/* Step 2: Country */}
                    {step === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-4"
                        >
                            <div className="text-center">
                                <MapPin className="h-10 w-10 mx-auto text-emerald-400 mb-2" />
                                <h3 className="text-lg font-black text-white">Votre pays</h3>
                                <p className="text-xs text-slate-400 mt-1">D'où nous rejoignez-vous ?</p>
                            </div>
                            <Input
                                placeholder="Ex: Cameroun, France, Congo..."
                                value={country}
                                onChange={(e) => setCountry(e.target.value)}
                                className="h-12 rounded-xl bg-white/5 border-white/10 text-center text-lg"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && country.trim() && setStep(3)}
                            />
                            <Button
                                className="w-full h-12 rounded-xl bg-gradient-to-r from-red-600 to-pink-600 font-bold"
                                onClick={() => country.trim() && setStep(3)}
                                disabled={!country.trim()}
                            >
                                Continuer <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </motion.div>
                    )}

                    {/* Step 3: Phone */}
                    {step === 3 && (
                        <motion.div
                            key="step3"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-4"
                        >
                            <div className="text-center">
                                <Phone className="h-10 w-10 mx-auto text-blue-400 mb-2" />
                                <h3 className="text-lg font-black text-white">Numéro de téléphone</h3>
                                <p className="text-xs text-slate-400 mt-1">Pour vous identifier lors de votre prochaine visite</p>
                            </div>
                            <Input
                                placeholder="+237 6XX XXX XXX"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="h-12 rounded-xl bg-white/5 border-white/10 text-center text-lg"
                                autoFocus
                                type="tel"
                                onKeyDown={(e) => e.key === 'Enter' && phone.trim() && setStep(4)}
                            />
                            <Button
                                className="w-full h-12 rounded-xl bg-gradient-to-r from-red-600 to-pink-600 font-bold"
                                onClick={() => phone.trim() && setStep(4)}
                                disabled={!phone.trim()}
                            >
                                Continuer <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </motion.div>
                    )}

                    {/* Step 4: Password */}
                    {step === 4 && (
                        <motion.div
                            key="step4"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-4"
                        >
                            <div className="text-center">
                                <KeyRound className="h-10 w-10 mx-auto text-amber-400 mb-2" />
                                <h3 className="text-lg font-black text-white">Mot de passe</h3>
                                <p className="text-xs text-slate-400 mt-1">Pour votre prochaine connexion</p>
                            </div>
                            <Input
                                placeholder="Créez un mot de passe"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="h-12 rounded-xl bg-white/5 border-white/10 text-center text-lg"
                                autoFocus
                                type="password"
                                onKeyDown={(e) => e.key === 'Enter' && password.trim().length >= 6 && handleSubmit()}
                            />
                            <p className="text-[10px] text-slate-500 text-center">Minimum 6 caractères</p>
                            <Button
                                className="w-full h-12 rounded-xl bg-gradient-to-r from-red-600 to-pink-600 font-bold"
                                onClick={handleSubmit}
                                disabled={isSubmitting || password.trim().length < 6}
                            >
                                {isSubmitting ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <>
                                        <Radio className="h-4 w-4 mr-2" />
                                        Rejoindre le Live
                                    </>
                                )}
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </motion.div>
    );
}

// ===== LIVE SALON (full-screen with video + comments) =====
function LiveSalon({
    streamUrl,
    userId,
    userName,
    onClose,
}: {
    streamUrl: string;
    userId: string;
    userName: string;
    onClose: () => void;
}) {
    const [comments, setComments] = useState<LiveComment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [replyTo, setReplyTo] = useState<LiveComment | null>(null);
    const [floatingReactions, setFloatingReactions] = useState<{ id: string; emoji: string; x: number }[]>([]);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const commentsEndRef = useRef<HTMLDivElement>(null);

    // Check if admin
    const { user } = useAppStore();
    const isAdmin = user?.role === 'admin';

    // Load comments (from app_settings live stream — use a special livestream_id = 'global-live')
    const GLOBAL_LIVE_ID = 'global-live';

    const loadComments = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('livestream_comments')
                .select('*')
                .eq('livestream_id', GLOBAL_LIVE_ID)
                .order('created_at', { ascending: true })
                .limit(200);

            if (error || !data) return;

            // Load profiles
            const userIds = [...new Set(data.map(c => c.user_id))];
            if (userIds.length === 0) {
                setComments([]);
                return;
            }
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url')
                .in('id', userIds);

            const profileMap = new Map((profiles || []).map(p => [p.id, p]));

            // Thread comments
            const topLevel: LiveComment[] = [];
            const repliesMap = new Map<string, LiveComment[]>();

            data.forEach(c => {
                const enriched: LiveComment = {
                    ...c,
                    profile: profileMap.get(c.user_id) || { full_name: null, avatar_url: null },
                    replies: [],
                };
                if (c.parent_id) {
                    const existing = repliesMap.get(c.parent_id) || [];
                    existing.push(enriched);
                    repliesMap.set(c.parent_id, existing);
                } else {
                    topLevel.push(enriched);
                }
            });

            topLevel.forEach(c => {
                c.replies = repliesMap.get(c.id) || [];
            });

            setComments(topLevel);
        } catch (e) {
            console.log('Comments not available');
        }
    }, []);

    // Real-time subscription
    useEffect(() => {
        loadComments();

        let channel: any = null;
        try {
            channel = supabase
                .channel('global-live-comments')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'livestream_comments',
                    filter: `livestream_id=eq.${GLOBAL_LIVE_ID}`
                }, () => loadComments())
                .subscribe();
        } catch (e) { /* table might not exist */ }

        return () => { if (channel) supabase.removeChannel(channel); };
    }, [loadComments]);

    // Auto-scroll
    useEffect(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [comments]);

    // Send comment
    const handleSendComment = async () => {
        if (!newComment.trim() || !userId) return;
        try {
            await supabase.from('livestream_comments').insert({
                livestream_id: GLOBAL_LIVE_ID,
                user_id: userId,
                content: newComment.trim(),
                parent_id: replyTo?.id || null,
            });
            setNewComment('');
            setReplyTo(null);
        } catch (e: any) {
            toast.error("Erreur: " + (e.message || "Impossible d'envoyer"));
        }
    };

    // Send reaction
    const handleReaction = async (emoji: string) => {
        const id = Date.now().toString();
        const x = 20 + Math.random() * 60;
        setFloatingReactions(prev => [...prev, { id, emoji, x }]);
        setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== id)), 3000);
        setShowEmojiPicker(false);

        try {
            await supabase.from('livestream_reactions').insert({
                livestream_id: GLOBAL_LIVE_ID,
                user_id: userId,
                emoji,
            });
        } catch (e) { /* silent */ }
    };

    // Delete comment
    const handleDeleteComment = async (commentId: string) => {
        try {
            await supabase.from('livestream_comments').delete().eq('id', commentId);
            toast.success('Commentaire supprimé');
        } catch (e: any) {
            toast.error("Erreur");
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-[#050709] to-[#0a0d14]"
        >
            {/* Header */}
            <header className="flex items-center gap-3 px-3 sm:px-4 pt-10 pb-3 border-b border-white/5">
                <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                            className="w-2.5 h-2.5 rounded-full bg-red-500"
                        />
                        <h1 className="font-black text-base sm:text-lg truncate">Diffusion en Direct</h1>
                    </div>
                    <p className="text-[10px] text-slate-500">Maison de Prière</p>
                </div>
                <Badge className="bg-red-600/20 text-red-400 gap-1 text-[10px]">
                    <Eye className="h-3 w-3" />
                    EN DIRECT
                </Badge>
            </header>

            {/* Video */}
            <div className="px-2 sm:px-4 py-2 relative">
                <div className="w-full aspect-video bg-black rounded-xl overflow-hidden">
                    {streamUrl ? (
                        <iframe
                            src={streamUrl}
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                            allowFullScreen
                            frameBorder="0"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-500">
                            <p>Chargement du stream...</p>
                        </div>
                    )}
                </div>

                {/* Floating Reactions */}
                <AnimatePresence>
                    {floatingReactions.map(r => (
                        <motion.div
                            key={r.id}
                            initial={{ opacity: 1, y: 0 }}
                            animate={{ opacity: 0, y: -150 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 2.5, ease: 'easeOut' }}
                            className="absolute bottom-4 text-2xl pointer-events-none"
                            style={{ left: `${r.x}%` }}
                        >
                            {r.emoji}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Quick reactions */}
            <div className="px-3 sm:px-4 py-2 flex items-center gap-1 border-b border-white/5 overflow-x-auto">
                {EMOJI_LIST.slice(0, 6).map(emoji => (
                    <motion.button
                        key={emoji}
                        whileTap={{ scale: 1.4 }}
                        onClick={() => handleReaction(emoji)}
                        className="text-lg sm:text-xl p-1.5 rounded-xl hover:bg-white/10 transition-colors shrink-0"
                    >
                        {emoji}
                    </motion.button>
                ))}
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-400 h-8 shrink-0"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                >
                    <Smile className="h-4 w-4" />
                </Button>

                <AnimatePresence>
                    {showEmojiPicker && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="absolute bottom-16 right-4 bg-[#1a1f2e] border border-white/10 rounded-2xl p-3 shadow-2xl z-50"
                        >
                            <div className="grid grid-cols-6 gap-2">
                                {EMOJI_LIST.map(emoji => (
                                    <motion.button
                                        key={emoji}
                                        whileTap={{ scale: 1.3 }}
                                        onClick={() => handleReaction(emoji)}
                                        className="text-xl p-2 rounded-xl hover:bg-white/10 transition-colors"
                                    >
                                        {emoji}
                                    </motion.button>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Comments */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                <ScrollArea className="flex-1 px-3 sm:px-4">
                    <div className="py-3 space-y-3">
                        {comments.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                <p className="text-sm">Soyez le premier à commenter le live !</p>
                            </div>
                        ) : (
                            comments.map(comment => (
                                <div key={comment.id} className="group">
                                    <div className="flex items-start gap-2">
                                        <Avatar className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 mt-0.5">
                                            <AvatarFallback className="bg-indigo-500/20 text-indigo-300 text-[10px]">
                                                {(comment.profile?.full_name || '?')[0]}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <div className={cn(
                                                "inline-block rounded-2xl px-3 py-2 max-w-full",
                                                comment.is_pinned
                                                    ? "bg-amber-500/10 border border-amber-500/20"
                                                    : "bg-white/5"
                                            )}>
                                                <span className="font-bold text-xs text-white">
                                                    {comment.profile?.full_name || 'Utilisateur'}
                                                </span>
                                                {comment.is_pinned && <Pin className="h-2.5 w-2.5 text-amber-400 inline ml-1" />}
                                                <p className="text-sm text-slate-200 break-words">{comment.content}</p>
                                            </div>
                                            <div className="flex items-center gap-3 mt-1 px-1">
                                                <span className="text-[10px] text-slate-600">
                                                    {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: fr })}
                                                </span>
                                                <button
                                                    onClick={() => setReplyTo(comment)}
                                                    className="text-[10px] font-bold text-slate-500 hover:text-indigo-400"
                                                >
                                                    Répondre
                                                </button>
                                                {(comment.user_id === userId || isAdmin) && (
                                                    <button
                                                        onClick={() => handleDeleteComment(comment.id)}
                                                        className="text-[10px] text-red-500/50 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        Supprimer
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Replies */}
                                    {comment.replies && comment.replies.length > 0 && (
                                        <div className="ml-9 sm:ml-10 mt-2 space-y-2 border-l-2 border-white/5 pl-3">
                                            {comment.replies.map(reply => (
                                                <div key={reply.id} className="group/reply flex items-start gap-2">
                                                    <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                                                        <AvatarFallback className="bg-purple-500/20 text-purple-300 text-[9px]">
                                                            {(reply.profile?.full_name || '?')[0]}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="inline-block rounded-2xl px-3 py-1.5 bg-white/3">
                                                            <span className="font-bold text-[11px] text-white">
                                                                {reply.profile?.full_name || 'Utilisateur'}
                                                            </span>
                                                            <p className="text-xs text-slate-300 break-words">{reply.content}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-0.5 px-1">
                                                            <span className="text-[9px] text-slate-600">
                                                                {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true, locale: fr })}
                                                            </span>
                                                            {(reply.user_id === userId || isAdmin) && (
                                                                <button
                                                                    onClick={() => handleDeleteComment(reply.id)}
                                                                    className="text-[9px] text-red-500/60 hover:text-red-400 opacity-0 group-hover/reply:opacity-100"
                                                                >
                                                                    Supprimer
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                        <div ref={commentsEndRef} />
                    </div>
                </ScrollArea>

                {/* Reply indicator */}
                {replyTo && (
                    <div className="px-3 py-2 bg-indigo-500/10 border-t border-indigo-500/20 flex items-center gap-2">
                        <span className="text-xs text-indigo-300">
                            Répondre à <b>{replyTo.profile?.full_name || 'Utilisateur'}</b>
                        </span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto" onClick={() => setReplyTo(null)}>
                            <X className="h-3 w-3" />
                        </Button>
                    </div>
                )}

                {/* Comment input */}
                <div className="px-3 sm:px-4 py-3 border-t border-white/5 flex items-center gap-2 bg-[#0a0d14]/80 backdrop-blur">
                    <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="bg-indigo-500/20 text-indigo-300 text-xs">
                            {userName[0] || '?'}
                        </AvatarFallback>
                    </Avatar>
                    <Input
                        placeholder="Commentez en direct..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendComment();
                            }
                        }}
                        className="flex-1 h-10 rounded-full bg-white/5 border-white/10 text-sm px-4"
                    />
                    <motion.div whileTap={{ scale: 0.9 }}>
                        <Button
                            size="icon"
                            className="h-10 w-10 rounded-full bg-gradient-to-r from-red-600 to-pink-600 shrink-0"
                            onClick={handleSendComment}
                            disabled={!newComment.trim()}
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </motion.div>
                </div>
            </div>
        </motion.div>
    );
}

// ===== MAIN HOME VIEW =====
export function HomeView({ onNavigateToDay, onNavigateTo }: HomeViewProps) {
    const { user, currentDay, streak, totalDaysCompleted, appSettings, setBibleViewTarget } = useAppStore();
    const todayData = getDay(currentDay);

    const [isLiveActive, setIsLiveActive] = useState(false);
    const [liveStreamUrl, setLiveStreamUrl] = useState('');
    const [showLiveRegistration, setShowLiveRegistration] = useState(false);
    const [showLiveSalon, setShowLiveSalon] = useState(false);
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

    const handleLiveClick = () => {
        if (!user) {
            // Guest — show registration flow
            setShowLiveRegistration(true);
        } else {
            // Logged in — open salon directly
            setShowLiveSalon(true);
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

    if (!todayData) return null;

    return (
        <div className="relative min-h-screen bg-gradient-to-b from-[#0B0E14] to-[#0F1219] text-white pb-28 overflow-x-hidden">
            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] bg-pink-600/5 blur-[150px] rounded-full" />
                <div className="absolute bottom-[-20%] left-[-20%] w-[50%] h-[50%] bg-purple-600/5 blur-[150px] rounded-full" />
            </div>

            <div className="relative z-10 max-w-4xl mx-auto w-full">
                {/* Header */}
                <header className="relative z-10 px-6 pt-12 pb-6 flex items-center justify-between">
                    <div>
                        <p className="text-slate-400 text-sm font-medium mb-1">Que la paix soit avec vous,</p>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                            {user ? user.name.split(' ')[0] : 'Visiteur'}
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        {user && <NotificationBell />}
                        <Avatar onClick={() => onNavigateTo('profile')} className="w-12 h-12 border-2 border-white/10 cursor-pointer shadow-lg hover:border-purple-500/50 transition-colors">
                            <AvatarImage src={user?.avatar} />
                            <AvatarFallback className="bg-purple-600/20 text-purple-400 font-bold">
                                {user ? user.name.charAt(0) : '?'}
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
                            onClick={handleLiveClick}
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
                                            <p className="text-red-200 text-sm">Cliquez pour accéder au salon live</p>
                                        </div>
                                    </div>
                                    <motion.div
                                        animate={{ scale: [1, 1.2, 1] }}
                                        transition={{ repeat: Infinity, duration: 1.5 }}
                                    >
                                        <Radio className="w-6 h-6 text-red-300" />
                                    </motion.div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Main Progression Card */}
                    {user && (
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
                    )}

                    {/* Stats Section - only for logged in */}
                    {user && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="grid grid-cols-3 gap-3"
                        >
                            <div className="glass-card p-4 text-center bg-slate-900/80">
                                <div className="bg-blue-500/20 w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 border border-blue-500/10">
                                    <TrendingUp className="w-5 h-5 text-blue-400" />
                                </div>
                                <p className="text-2xl font-black">{totalDaysCompleted}</p>
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Jours</p>
                            </div>
                            <div className="glass-card p-4 text-center bg-slate-900/80">
                                <div className="bg-orange-500/20 w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 border border-orange-500/10">
                                    <Flame className="w-5 h-5 text-orange-400" />
                                </div>
                                <p className="text-2xl font-black">{streak}</p>
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Série</p>
                            </div>
                            <div className="glass-card p-4 text-center bg-slate-900/80">
                                <div className="bg-purple-500/20 w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 border border-purple-500/10">
                                    <Trophy className="w-5 h-5 text-purple-400" />
                                </div>
                                <p className="text-2xl font-black">{Math.round((totalDaysCompleted / 40) * 100)}%</p>
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Progrès</p>
                            </div>
                        </motion.div>
                    )}

                    {/* Quick Actions */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="space-y-3"
                    >
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Actions rapides</h3>
                        <div className="grid grid-cols-4 gap-2">
                            {[
                                { icon: <Gamepad2 className="w-5 h-5" />, label: 'Jeux Bibliques', color: 'from-emerald-600 to-teal-600' },
                                { icon: <Heart className="w-5 h-5" />, label: 'Prière', color: 'from-pink-600 to-rose-600' },
                                { icon: <BookOpen className="w-5 h-5" />, label: 'Bible', color: 'from-amber-600 to-orange-600' },
                                { icon: <MessageSquare className="w-5 h-5" />, label: 'Chat', color: 'from-sky-600 to-cyan-600' },
                            ].map((item, i) => (
                                <motion.button
                                    key={item.label}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.65 + i * 0.05 }}
                                    className={cn(
                                        "flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-gradient-to-br text-white border border-white/10 hover:scale-105 transition-transform",
                                        item.color
                                    )}
                                    onClick={() => {
                                        if (item.label === 'Jeux Bibliques') {
                                            setBibleViewTarget('games');
                                            onNavigateTo('bible');
                                        } else {
                                            onNavigateTo('community');
                                        }
                                    }}
                                >
                                    {item.icon}
                                    <span className="text-[10px] font-bold leading-tight text-center">{item.label}</span>
                                </motion.button>
                            ))}
                        </div>
                    </motion.div>
                </main>

                {/* Live Registration Flow (for guests) */}
                <AnimatePresence>
                    {showLiveRegistration && (
                        <LiveRegistrationFlow
                            onClose={() => setShowLiveRegistration(false)}
                            onComplete={() => {
                                setShowLiveRegistration(false);
                                // After registration, open the salon
                                setTimeout(() => setShowLiveSalon(true), 500);
                            }}
                        />
                    )}
                </AnimatePresence>

                {/* Live Salon (full screen) */}
                <AnimatePresence>
                    {showLiveSalon && (
                        <LiveSalon
                            streamUrl={liveStreamUrl}
                            userId={user?.id || ''}
                            userName={user?.name || 'Visiteur'}
                            onClose={() => setShowLiveSalon(false)}
                        />
                    )}
                </AnimatePresence>

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
                                    <a href="https://youtube.com" target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-4 p-4 rounded-xl border bg-red-500/20 text-red-400 border-red-500/30 transition-all hover:scale-[1.02]">
                                        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center"><Youtube className="w-6 h-6" /></div>
                                        <div className="flex-1"><p className="font-bold">YouTube</p><p className="text-sm opacity-70">Vidéos & Lives</p></div>
                                        <ExternalLink className="w-4 h-4 opacity-50" />
                                    </a>
                                    <a href="https://facebook.com" target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-4 p-4 rounded-xl border bg-blue-500/20 text-blue-400 border-blue-500/30 transition-all hover:scale-[1.02]">
                                        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center"><Facebook className="w-6 h-6" /></div>
                                        <div className="flex-1"><p className="font-bold">Facebook</p><p className="text-sm opacity-70">Communauté</p></div>
                                        <ExternalLink className="w-4 h-4 opacity-50" />
                                    </a>
                                    <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-4 p-4 rounded-xl border bg-pink-500/20 text-pink-400 border-pink-500/30 transition-all hover:scale-[1.02]">
                                        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center"><span className="text-xl font-bold">TT</span></div>
                                        <div className="flex-1"><p className="font-bold">TikTok</p><p className="text-sm opacity-70">Clips courts</p></div>
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
        </div>
    );
}
