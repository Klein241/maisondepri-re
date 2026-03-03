'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Radio, Share2, Loader2, MessageSquare, Send, X, Trash2, Users, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

// ── Global Live Comments ─────────────────────────────────
export function GlobalLiveComments({ userId, userName }: {
    userId: string; userName: string;
}) {
    const [comments, setComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState('');
    const [replyTo, setReplyTo] = useState<any | null>(null);
    const commentsEndRef = useRef<HTMLDivElement>(null);
    const { user } = useAppStore();
    const isAdmin = user?.role === 'admin';

    const loadComments = useCallback(async () => {
        try {
            const { data } = await supabase
                .from('livestream_comments')
                .select('*')
                .eq('livestream_id', 'global-live')
                .order('created_at', { ascending: true })
                .limit(200);
            if (!data) return;

            const userIds = [...new Set(data.map((c: any) => c.user_id))];
            const { data: profiles } = userIds.length > 0
                ? await supabase.from('profiles').select('id, full_name, avatar_url').in('id', userIds)
                : { data: [] };

            const pMap = new Map((profiles || []).map((p: any) => [p.id, p]));

            const topLevel: any[] = [];
            const repliesMap = new Map<string, any[]>();
            data.forEach((c: any) => {
                const enriched = { ...c, profile: pMap.get(c.user_id) || { full_name: null }, replies: [] };
                if (c.parent_id) {
                    const arr = repliesMap.get(c.parent_id) || [];
                    arr.push(enriched);
                    repliesMap.set(c.parent_id, arr);
                } else {
                    topLevel.push(enriched);
                }
            });
            topLevel.forEach((c: any) => { c.replies = repliesMap.get(c.id) || []; });
            setComments(topLevel);
        } catch (e) { /* table might not exist */ }
    }, []);

    // Subscribe to realtime changes
    useEffect(() => {
        loadComments();
        let channel: any = null;
        try {
            channel = supabase
                .channel('global-live-comments-salon')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'livestream_comments',
                    filter: 'livestream_id=eq.global-live'
                }, () => loadComments())
                .subscribe((status: string) => {
                    console.log('Live comments subscription:', status);
                });
        } catch (e) { console.error('Subscription error:', e); }
        return () => { if (channel) supabase.removeChannel(channel); };
    }, [loadComments]);

    useEffect(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [comments]);

    const handleSend = async () => {
        if (!newComment.trim()) return;
        try {
            const { error } = await supabase.from('livestream_comments').insert({
                livestream_id: 'global-live',
                user_id: userId,
                content: newComment.trim(),
                parent_id: replyTo?.id || null,
            });
            if (error) {
                console.error('Comment insert error:', error);
                toast.error("Impossible d'envoyer: " + error.message);
                return;
            }
            setNewComment('');
            setReplyTo(null);
        } catch (e: any) {
            toast.error("Impossible d'envoyer");
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await supabase.from('livestream_comments').delete().eq('id', id);
        } catch (e) { toast.error('Erreur'); }
    };

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <ScrollArea className="flex-1 px-3 sm:px-4">
                <div className="py-2 space-y-2.5">
                    {comments.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                            <p className="text-sm">Soyez le premier à commenter !</p>
                        </div>
                    ) : comments.map((c: any) => (
                        <div key={c.id} className="group">
                            <div className="flex items-start gap-2">
                                <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                                    <AvatarFallback className="bg-indigo-500/20 text-indigo-300 text-[10px]">
                                        {(c.profile?.full_name || '?')[0]}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <div className={cn("inline-block rounded-2xl px-3 py-2 max-w-full", c.is_pinned ? "bg-amber-500/10 border border-amber-500/20" : "bg-white/5")}>
                                        <span className="font-bold text-xs text-white">{c.profile?.full_name || 'Utilisateur'}</span>
                                        <p className="text-sm text-slate-200 break-words">{c.content}</p>
                                    </div>
                                    <div className="flex items-center gap-3 mt-0.5 px-1">
                                        <span className="text-[10px] text-slate-600">
                                            {c.created_at ? formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: fr }) : ''}
                                        </span>
                                        <button onClick={() => setReplyTo(c)} className="text-[10px] font-bold text-slate-500 hover:text-indigo-400">Répondre</button>
                                        {(c.user_id === userId || isAdmin) && (
                                            <button onClick={() => handleDelete(c.id)} className="text-[10px] text-red-500/50 hover:text-red-400 opacity-0 group-hover:opacity-100">Supprimer</button>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {c.replies?.length > 0 && (
                                <div className="ml-9 mt-1.5 space-y-1.5 border-l-2 border-white/5 pl-3">
                                    {c.replies.map((r: any) => (
                                        <div key={r.id} className="group/r flex items-start gap-2">
                                            <Avatar className="h-6 w-6 shrink-0"><AvatarFallback className="bg-purple-500/20 text-purple-300 text-[9px]">{(r.profile?.full_name || '?')[0]}</AvatarFallback></Avatar>
                                            <div className="flex-1 min-w-0">
                                                <div className="inline-block rounded-2xl px-3 py-1.5 bg-white/3">
                                                    <span className="font-bold text-[11px] text-white">{r.profile?.full_name || 'Utilisateur'}</span>
                                                    <p className="text-xs text-slate-300 break-words">{r.content}</p>
                                                </div>
                                                {(r.user_id === userId || isAdmin) && (
                                                    <button onClick={() => handleDelete(r.id)} className="text-[9px] text-red-500/60 hover:text-red-400 opacity-0 group-hover/r:opacity-100 ml-2">Supprimer</button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                    <div ref={commentsEndRef} />
                </div>
            </ScrollArea>

            {replyTo && (
                <div className="px-3 py-1.5 bg-indigo-500/10 border-t border-indigo-500/20 flex items-center gap-2 shrink-0">
                    <span className="text-xs text-indigo-300">Répondre à <b>{replyTo.profile?.full_name || 'Utilisateur'}</b></span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto" onClick={() => setReplyTo(null)}><X className="h-3 w-3" /></Button>
                </div>
            )}

            <div className="px-3 sm:px-4 py-3 border-t border-white/5 flex items-center gap-2 bg-[#0a0d14]/90 backdrop-blur shrink-0 pb-safe" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
                <Avatar className="h-8 w-8 shrink-0"><AvatarFallback className="bg-indigo-500/20 text-indigo-300 text-xs">{userName[0] || '?'}</AvatarFallback></Avatar>
                <Input
                    placeholder="Commentez en direct..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    className="flex-1 h-10 rounded-full bg-white/5 border-white/10 text-sm px-4"
                />
                <Button
                    size="icon"
                    className="h-10 w-10 rounded-full bg-gradient-to-r from-red-600 to-pink-600 shrink-0"
                    onClick={handleSend}
                    disabled={!newComment.trim()}
                >
                    <Send className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

// ── FLOATING REACTIONS ──────────────────────────────────
function FloatingReaction({ emoji, x }: { emoji: string; x: number }) {
    return (
        <motion.div
            initial={{ opacity: 1, y: 0, scale: 1 }}
            animate={{ opacity: 0, y: -120, scale: 1.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, ease: 'easeOut' }}
            className="absolute bottom-2 text-2xl pointer-events-none"
            style={{ left: `${x}%` }}
        >
            {emoji}
        </motion.div>
    );
}

// ── MAIN: Global Live Salon ─────────────────────────────
export function GlobalLiveSalon({ platform, isPortrait, primaryUrl, backupUrl, user, onClose }: {
    platform: string;
    isPortrait: boolean;
    primaryUrl: string;
    backupUrl: string;
    user: { id: string; name?: string | null; role?: string };
    onClose: () => void;
}) {
    const [useBackup, setUseBackup] = useState(false);
    const [iframeLoaded, setIframeLoaded] = useState(false);
    const [showBlockedMsg, setShowBlockedMsg] = useState(false);
    const [floatingReactions, setFloatingReactions] = useState<{ id: string; emoji: string; x: number }[]>([]);

    const iframeUrl = useBackup ? backupUrl : primaryUrl;

    // Auto-detect blocked platform
    useEffect(() => {
        setIframeLoaded(false);
        setShowBlockedMsg(false);
        const timer = setTimeout(() => {
            if (!iframeLoaded) {
                setShowBlockedMsg(true);
                if (backupUrl && !useBackup) {
                    setUseBackup(true);
                    toast.info('🔄 Basculement vers le lien de secours');
                }
            }
        }, 6000);
        return () => clearTimeout(timer);
    }, [iframeUrl]);

    // Send reaction
    const sendReaction = async (emoji: string) => {
        setFloatingReactions(prev => [
            ...prev.slice(-15),
            { id: `${Date.now()}-${Math.random()}`, emoji, x: 10 + Math.random() * 80 }
        ]);

        try {
            const { error } = await supabase.from('livestream_reactions').insert({
                livestream_id: 'global-live',
                user_id: user.id,
                emoji,
            });
            if (error) {
                console.error('Reaction error:', error);
                toast.error('Réaction impossible');
            }
        } catch (e) {
            toast.error('Réaction impossible');
        }
    };

    // Subscribe to Supabase realtime reactions
    useEffect(() => {
        let channel: any = null;
        try {
            channel = supabase
                .channel('global-live-reactions-salon')
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'livestream_reactions',
                    filter: 'livestream_id=eq.global-live'
                }, (payload: any) => {
                    if (payload.new && payload.new.user_id !== user.id) {
                        setFloatingReactions(prev => [
                            ...prev.slice(-15),
                            { id: `${Date.now()}-${Math.random()}`, emoji: payload.new.emoji, x: 10 + Math.random() * 80 }
                        ]);
                    }
                })
                .subscribe((status: string) => {
                    console.log('Reactions subscription:', status);
                });
        } catch (e) { console.error('Reaction subscription error:', e); }
        return () => { if (channel) supabase.removeChannel(channel); };
    }, [user.id]);

    // Clean up old floating reactions
    useEffect(() => {
        const interval = setInterval(() => {
            setFloatingReactions(prev => prev.slice(-10));
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    return (
        <motion.div
            key="global-live"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col bg-gradient-to-b from-[#050709] to-[#0a0d14]"
        >
            {/* Header */}
            <header className="flex items-center gap-2 px-3 pt-10 pb-2 border-b border-white/5 shrink-0">
                <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 h-9 w-9">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <h1 className="font-black text-sm truncate">Diffusion en Direct</h1>
                    </div>
                </div>
                <Badge className="bg-red-600/20 text-red-400 gap-1 text-[9px] px-2 py-0.5 shrink-0">
                    <Radio className="h-2.5 w-2.5" />
                    LIVE
                </Badge>
                <Button variant="ghost" size="sm" className="text-slate-400 h-7 text-[9px] px-2 shrink-0"
                    onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/?live=1`); toast.success('🔗 Lien copié !'); }}>
                    <Share2 className="h-3 w-3" />
                </Button>
            </header>

            {/* Video Player — iframe only */}
            <div className={cn("shrink-0 bg-black flex items-center justify-center relative", 'w-full')}>
                {iframeUrl ? (
                    <div className={cn(
                        "bg-black overflow-hidden mx-auto",
                        isPortrait && !useBackup ? "w-full max-w-[280px] sm:max-w-[340px]" : "w-full"
                    )}
                        style={{
                            aspectRatio: isPortrait && !useBackup ? '9/16' : '16/9',
                            maxHeight: isPortrait && !useBackup ? '45vh' : '35vh'
                        }}
                    >
                        <iframe
                            src={iframeUrl}
                            className="w-full h-full"
                            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                            allowFullScreen
                            frameBorder="0"
                            scrolling="no"
                            onLoad={() => { setIframeLoaded(true); setShowBlockedMsg(false); }}
                        />
                    </div>
                ) : (
                    <div className="w-full flex items-center justify-center text-slate-500" style={{ height: '35vh' }}>
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                )}

                {/* Floating Reactions */}
                <AnimatePresence>
                    {floatingReactions.map(r => (
                        <FloatingReaction key={r.id} emoji={r.emoji} x={r.x} />
                    ))}
                </AnimatePresence>
            </div>

            {/* Source switch bar */}
            {(showBlockedMsg || backupUrl) && (
                <div className="px-3 py-1.5 flex items-center gap-2 shrink-0 border-b border-white/5 flex-wrap">
                    {backupUrl && (
                        <button
                            onClick={() => { setUseBackup(!useBackup); setIframeLoaded(false); setShowBlockedMsg(false); }}
                            className="text-[10px] font-bold text-blue-400 hover:text-blue-300"
                        >
                            {useBackup ? '⬅️ Lien principal' : '🔄 Lien alternatif'}
                        </button>
                    )}
                    {showBlockedMsg && !backupUrl && (
                        <p className="text-[10px] text-amber-400">⚠️ Vidéo inaccessible. Activez un VPN.</p>
                    )}
                </div>
            )}

            {/* Quick reactions */}
            <div className="px-3 py-1 flex items-center gap-0.5 border-b border-white/5 shrink-0">
                {['❤️', '🙏', '🔥', '👏', '😍', '✝️'].map(emoji => (
                    <button key={emoji}
                        onClick={() => sendReaction(emoji)}
                        className="text-lg p-1.5 rounded-xl hover:bg-white/10 transition-all active:scale-150"
                    >{emoji}</button>
                ))}
            </div>

            {/* Comments */}
            <GlobalLiveComments
                userId={user.id}
                userName={user.name || 'Utilisateur'}
            />
        </motion.div>
    );
}

export default GlobalLiveSalon;
