'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Share2, Heart, HandMetal, ThumbsUp, Flame, Cross,
    Send, Loader2, MessageSquare, SmilePlus, Trash2, Copy, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Replay {
    id: string;
    title: string;
    platform: string;
    embed_url: string;
    original_url: string | null;
    description: string | null;
    thumbnail_url: string | null;
    recorded_at: string;
    view_count: number;
}

interface Comment {
    id: string;
    replay_id: string;
    user_id: string;
    content: string;
    parent_id: string | null;
    created_at: string;
    profile?: { full_name: string | null; avatar_url: string | null };
    replies?: Comment[];
}

interface Reaction {
    reaction: string;
    count: number;
}

const EMOJIS = [
    { emoji: '❤️', label: 'Amour' },
    { emoji: '🙏', label: 'Prière' },
    { emoji: '🔥', label: 'Feu' },
    { emoji: '👐', label: 'Louange' },
    { emoji: '😭', label: 'Ému' },
    { emoji: '✝️', label: 'Foi' },
    { emoji: '🎉', label: 'Célébration' },
    { emoji: '💪', label: 'Force' },
];

function convertToEmbed(url: string, platform: string): string {
    if (!url) return url;
    try {
        const u = new URL(url);
        if (platform === 'youtube') {
            let videoId = u.searchParams.get('v');
            if (!videoId && u.hostname === 'youtu.be') videoId = u.pathname.slice(1);
            if (videoId) return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
        }
        if (platform === 'facebook') {
            if (u.pathname.includes('/plugins/video.php')) {
                const href = u.searchParams.get('href');
                if (href) return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(href)}&show_text=false&autoplay=false&allowfullscreen=true`;
            }
            return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=false&allowfullscreen=true`;
        }
    } catch (e) { }
    return url;
}

export default function ReplayPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAppStore();
    const id = params.id as string;

    const [replay, setReplay] = useState<Replay | null>(null);
    const [loading, setLoading] = useState(true);
    const [comments, setComments] = useState<Comment[]>([]);
    const [reactions, setReactions] = useState<Reaction[]>([]);
    const [newComment, setNewComment] = useState('');
    const [replyTo, setReplyTo] = useState<Comment | null>(null);
    const [sendingComment, setSendingComment] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [copied, setCopied] = useState(false);
    const [floatingEmojis, setFloatingEmojis] = useState<{ id: string; emoji: string; x: number }[]>([]);
    const commentsEndRef = useRef<HTMLDivElement>(null);

    const isPortrait = replay && ['facebook', 'tiktok', 'instagram'].includes(replay.platform);

    // Load replay
    useEffect(() => {
        if (!id) return;
        const fetch = async () => {
            setLoading(true);
            const { data } = await supabase.from('live_replays').select('*').eq('id', id).single();
            if (data) {
                setReplay(data);
                // Increment view count
                await supabase.from('live_replays').update({ view_count: (data.view_count || 0) + 1 }).eq('id', id);
            }
            setLoading(false);
        };
        fetch();
    }, [id]);

    // Load comments
    const loadComments = useCallback(async () => {
        if (!id) return;
        const { data } = await supabase
            .from('replay_comments')
            .select('*')
            .eq('replay_id', id)
            .order('created_at', { ascending: true });
        if (!data) return;

        const userIds = [...new Set(data.map(c => c.user_id))];
        const { data: profiles } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', userIds);
        const profileMap = new Map((profiles || []).map(p => [p.id, p]));

        const topLevel: Comment[] = [];
        const repliesMap = new Map<string, Comment[]>();
        data.forEach(c => {
            const enriched = { ...c, profile: profileMap.get(c.user_id) || null, replies: [] };
            if (c.parent_id) {
                const arr = repliesMap.get(c.parent_id) || [];
                arr.push(enriched);
                repliesMap.set(c.parent_id, arr);
            } else {
                topLevel.push(enriched);
            }
        });
        topLevel.forEach(c => { c.replies = repliesMap.get(c.id) || []; });
        setComments(topLevel);
    }, [id]);

    // Load reactions
    const loadReactions = useCallback(async () => {
        if (!id) return;
        const { data } = await supabase.from('replay_reactions').select('reaction').eq('replay_id', id);
        if (!data) return;
        const counts: Record<string, number> = {};
        data.forEach(r => { counts[r.reaction] = (counts[r.reaction] || 0) + 1; });
        setReactions(Object.entries(counts).map(([reaction, count]) => ({ reaction, count })));
    }, [id]);

    useEffect(() => { loadComments(); loadReactions(); }, [loadComments, loadReactions]);

    // Realtime subscriptions
    useEffect(() => {
        if (!id) return;
        const commentSub = supabase.channel(`replay-comments-${id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'replay_comments', filter: `replay_id=eq.${id}` }, () => loadComments())
            .subscribe();
        const reactionSub = supabase.channel(`replay-reactions-${id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'replay_reactions', filter: `replay_id=eq.${id}` }, () => loadReactions())
            .subscribe();
        return () => { commentSub.unsubscribe(); reactionSub.unsubscribe(); };
    }, [id, loadComments, loadReactions]);

    // Auto-scroll on new comment
    useEffect(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [comments]);

    const handleSendComment = async () => {
        if (!user) { toast.error('Connectez-vous pour commenter'); return; }
        if (!newComment.trim()) return;
        setSendingComment(true);
        const { error } = await supabase.from('replay_comments').insert({
            replay_id: id,
            user_id: user.id,
            content: newComment.trim(),
            parent_id: replyTo?.id || null,
        });
        if (error) { toast.error('Erreur lors de l\'envoi'); }
        else { setNewComment(''); setReplyTo(null); }
        setSendingComment(false);
    };

    const handleReact = async (emoji: string) => {
        if (!user) { toast.error('Connectez-vous pour réagir'); return; }
        const { error } = await supabase.from('replay_reactions').insert({
            replay_id: id,
            user_id: user.id,
            reaction: emoji,
        });
        if (!error) {
            // Show floating emoji animation
            const floatId = Math.random().toString(36).slice(2);
            const x = 20 + Math.random() * 60;
            setFloatingEmojis(prev => [...prev, { id: floatId, emoji, x }]);
            setTimeout(() => setFloatingEmojis(prev => prev.filter(e => e.id !== floatId)), 2500);
        }
        setShowEmojiPicker(false);
    };

    const handleShare = async () => {
        const url = window.location.href;
        if (navigator.share && replay) {
            try {
                await navigator.share({ title: replay.title, text: `Regardez ce replay: ${replay.title}`, url });
                return;
            } catch (e) { }
        }
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(url);
        setCopied(true);
        toast.success('Lien copié !');
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDeleteComment = async (commentId: string) => {
        await supabase.from('replay_comments').delete().eq('id', commentId);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#050709] flex items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-purple-400" />
            </div>
        );
    }

    if (!replay) {
        return (
            <div className="min-h-screen bg-[#050709] flex flex-col items-center justify-center gap-4 text-slate-400">
                <p>Replay introuvable</p>
                <Button variant="ghost" onClick={() => router.push('/')}>Retour à l'accueil</Button>
            </div>
        );
    }

    const embedSrc = replay.embed_url || convertToEmbed(replay.original_url || '', replay.platform);
    const totalReactions = reactions.reduce((acc, r) => acc + r.count, 0);

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#050709] to-[#0a0d14] flex flex-col">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 flex items-center gap-3 px-4 pt-10 pb-3 bg-gradient-to-b from-[#050709]/95 to-transparent backdrop-blur-sm">
                <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-9 w-9 shrink-0">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1 min-w-0">
                    <h1 className="font-black text-sm text-white truncate">{replay.title}</h1>
                    <p className="text-[10px] text-slate-500">
                        {new Date(replay.recorded_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        {' · '}
                        <Badge className="text-[8px] bg-purple-600/20 text-purple-300 px-1 py-0 ml-0.5">REPLAY</Badge>
                    </p>
                </div>
                <Button variant="ghost" size="icon" onClick={handleShare} className="h-9 w-9 shrink-0">
                    {copied ? <Check className="h-5 w-5 text-green-400" /> : <Share2 className="h-5 w-5" />}
                </Button>
            </header>

            {/* Video player */}
            <div className="pt-20 px-0">
                <div
                    className={cn("bg-black mx-auto overflow-hidden", isPortrait ? "max-w-[340px]" : "w-full")}
                    style={{ aspectRatio: isPortrait ? '9/16' : '16/9', maxHeight: '60vh' }}
                >
                    <iframe
                        src={embedSrc}
                        className="w-full h-full"
                        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                        allowFullScreen
                        frameBorder="0"
                    />
                </div>
            </div>

            {/* Reactions bar */}
            <div className="relative px-4 py-3 flex items-center gap-3 border-b border-white/5">
                {/* Floating emojis */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <AnimatePresence>
                        {floatingEmojis.map(fe => (
                            <motion.div
                                key={fe.id}
                                initial={{ opacity: 1, y: 0, scale: 1 }}
                                animate={{ opacity: 0, y: -120, scale: 1.6 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 2.4, ease: 'easeOut' }}
                                className="absolute bottom-4 text-3xl"
                                style={{ left: `${fe.x}%` }}
                            >
                                {fe.emoji}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                {/* Reaction counts */}
                <div className="flex gap-1.5 flex-wrap flex-1">
                    {reactions.sort((a, b) => b.count - a.count).slice(0, 5).map(r => (
                        <button
                            key={r.reaction}
                            onClick={() => handleReact(r.reaction)}
                            className="flex items-center gap-1 bg-slate-800/60 rounded-full px-2 py-1 text-xs hover:bg-slate-700/60 transition-all"
                        >
                            <span>{r.reaction}</span>
                            <span className="text-slate-400 text-[10px]">{r.count}</span>
                        </button>
                    ))}
                    {totalReactions === 0 && (
                        <span className="text-[11px] text-slate-500">Soyez le premier à réagir !</span>
                    )}
                </div>

                {/* Emoji picker toggle */}
                <div className="relative">
                    <Button
                        variant="ghost" size="icon" className="h-9 w-9"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    >
                        <SmilePlus className="h-5 w-5 text-slate-400" />
                    </Button>
                    <AnimatePresence>
                        {showEmojiPicker && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 8 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="absolute bottom-12 right-0 bg-slate-800 border border-slate-700 rounded-2xl p-2 grid grid-cols-4 gap-1 shadow-2xl z-50"
                            >
                                {EMOJIS.map(e => (
                                    <button
                                        key={e.emoji}
                                        onClick={() => handleReact(e.emoji)}
                                        className="text-2xl p-2 rounded-xl hover:bg-slate-700 transition-all hover:scale-125"
                                        title={e.label}
                                    >
                                        {e.emoji}
                                    </button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Share button */}
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleShare}>
                    {copied ? <Check className="h-4 w-4 text-green-400" /> : <Share2 className="h-4 w-4 text-slate-400" />}
                </Button>
            </div>

            {/* Description */}
            {replay.description && (
                <div className="px-4 py-2 border-b border-white/5">
                    <p className="text-sm text-slate-400">{replay.description}</p>
                </div>
            )}

            {/* Comments header */}
            <div className="px-4 py-2 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-bold text-slate-300">
                    {comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0)} commentaire(s)
                </span>
            </div>

            {/* Comments list */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3 pb-28">
                {comments.length === 0 ? (
                    <div className="text-center py-10 text-slate-500">
                        <MessageSquare className="h-10 w-10 mx-auto opacity-30 mb-2" />
                        <p className="text-sm">Soyez le premier à commenter !</p>
                    </div>
                ) : (
                    comments.map(comment => (
                        <div key={comment.id} className="space-y-2">
                            <CommentBubble
                                comment={comment}
                                userId={user?.id}
                                onReply={() => setReplyTo(comment)}
                                onDelete={handleDeleteComment}
                            />
                            {/* Replies */}
                            {comment.replies && comment.replies.map(reply => (
                                <div key={reply.id} className="pl-10">
                                    <CommentBubble
                                        comment={reply}
                                        userId={user?.id}
                                        onReply={() => setReplyTo(comment)}
                                        onDelete={handleDeleteComment}
                                        isReply
                                    />
                                </div>
                            ))}
                        </div>
                    ))
                )}
                <div ref={commentsEndRef} />
            </div>

            {/* Comment input - fixed at bottom */}
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0d14]/95 backdrop-blur-sm border-t border-white/5 px-3 py-3 pb-safe">
                {replyTo && (
                    <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-slate-800/60 rounded-xl">
                        <span className="text-[10px] text-purple-400 flex-1 truncate">
                            ↩ Répondre à {replyTo.profile?.full_name || 'quelqu\'un'}
                        </span>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setReplyTo(null)}>
                            <span className="text-slate-400 text-xs">×</span>
                        </Button>
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={user?.avatar_url || ''} />
                        <AvatarFallback className="bg-purple-600 text-white text-xs">
                            {user ? (user.full_name?.[0] || user.email?.[0] || '?').toUpperCase() : '?'}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 flex items-center gap-2 bg-slate-800/70 rounded-full px-4 py-2 border border-slate-700/50">
                        <input
                            type="text"
                            value={newComment}
                            onChange={e => setNewComment(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendComment()}
                            placeholder={user ? 'Votre commentaire...' : 'Connectez-vous pour commenter'}
                            disabled={!user}
                            className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 outline-none min-w-0"
                        />
                        <button
                            onClick={handleSendComment}
                            disabled={!newComment.trim() || sendingComment || !user}
                            className="shrink-0 text-purple-400 disabled:text-slate-600 hover:text-purple-300 transition-colors"
                        >
                            {sendingComment
                                ? <Loader2 className="h-5 w-5 animate-spin" />
                                : <Send className="h-5 w-5" />
                            }
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function CommentBubble({
    comment,
    userId,
    onReply,
    onDelete,
    isReply = false,
}: {
    comment: Comment;
    userId?: string;
    onReply: () => void;
    onDelete: (id: string) => void;
    isReply?: boolean;
}) {
    const isOwn = userId === comment.user_id;
    const name = comment.profile?.full_name || 'Utilisateur';
    return (
        <div className="flex gap-2 items-start group">
            <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={comment.profile?.avatar_url || ''} />
                <AvatarFallback className="bg-indigo-700 text-white text-xs">{name[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
                <div className="bg-slate-800/60 rounded-2xl px-3 py-2 inline-block max-w-full">
                    <p className="font-bold text-[11px] text-purple-300 mb-0.5">{name}</p>
                    <p className="text-sm text-white break-words">{comment.content}</p>
                </div>
                <div className="flex items-center gap-3 mt-1 px-1">
                    <span className="text-[9px] text-slate-500">
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: fr })}
                    </span>
                    {!isReply && (
                        <button onClick={onReply} className="text-[10px] text-slate-500 hover:text-purple-400 font-bold transition-colors">
                            Répondre
                        </button>
                    )}
                    {isOwn && (
                        <button
                            onClick={() => onDelete(comment.id)}
                            className="text-[10px] text-red-500/60 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        >
                            Supprimer
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
