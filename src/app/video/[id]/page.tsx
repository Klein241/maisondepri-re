'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Share2, SmilePlus, Send, Loader2,
    MessageSquare, Check, Eye, Copy, ExternalLink
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

interface VideoItem {
    id: string;
    title: string;
    video_url: string;
    thumbnail_url: string | null;
    description: string | null;
    platform: string;
    category: string;
    view_count: number;
    created_at: string;
}

interface Comment {
    id: string;
    video_id: string;
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
    { emoji: '🕊️', label: 'Paix' },
    { emoji: '🌟', label: 'Miracle' },
    { emoji: '🙌', label: 'Gloire' },
    { emoji: '💯', label: 'Amen' },
];

const CATEGORY_LABELS: Record<string, string> = {
    predication: '🎤 Prédication',
    louange: '🎵 Louange',
    temoignage: '💬 Témoignage',
    enseignement: '📖 Enseignement',
    priere: '🙏 Prière',
    autre: '📺 Autre',
};

function convertToEmbed(url: string, platform: string): string {
    if (!url) return url;
    try {
        const u = new URL(url);
        if (platform === 'youtube' || u.hostname.includes('youtube') || u.hostname === 'youtu.be') {
            let videoId = u.searchParams.get('v');
            if (!videoId && u.hostname === 'youtu.be') videoId = u.pathname.slice(1);
            if (!videoId && u.pathname.includes('/embed/')) videoId = u.pathname.split('/embed/')[1]?.split('?')[0];
            if (videoId) return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;
        }
        if (platform === 'facebook' || u.hostname.includes('facebook')) {
            if (u.pathname.includes('/plugins/video.php')) {
                const href = u.searchParams.get('href');
                return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(href || url)}&show_text=false&autoplay=true&allowfullscreen=true`;
            }
            return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=true&allowfullscreen=true`;
        }
    } catch (e) { }
    return url;
}

export default function VideoPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAppStore();
    const id = params.id as string;

    const [video, setVideo] = useState<VideoItem | null>(null);
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

    const isPortrait = video && ['facebook', 'tiktok', 'instagram'].includes(video.platform);

    // Load video
    useEffect(() => {
        if (!id) return;
        const fetchVideo = async () => {
            setLoading(true);
            const { data } = await supabase.from('video_gallery').select('*').eq('id', id).single();
            if (data) {
                setVideo(data);
                // Increment view count
                await supabase.from('video_gallery').update({ view_count: (data.view_count || 0) + 1 }).eq('id', id);
            }
            setLoading(false);
        };
        fetchVideo();
    }, [id]);

    // Load comments
    const loadComments = useCallback(async () => {
        if (!id) return;
        const { data } = await supabase
            .from('video_comments')
            .select('*')
            .eq('video_id', id)
            .order('created_at', { ascending: true });
        if (!data) return;

        const userIds = [...new Set(data.map((c: any) => c.user_id))];
        const { data: profiles } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', userIds.length > 0 ? userIds : ['none']);
        const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

        const topLevel: Comment[] = [];
        const repliesMap = new Map<string, Comment[]>();
        data.forEach((c: any) => {
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
        const { data } = await supabase.from('video_reactions').select('reaction').eq('video_id', id);
        if (!data) return;
        const counts: Record<string, number> = {};
        data.forEach((r: any) => { counts[r.reaction] = (counts[r.reaction] || 0) + 1; });
        setReactions(Object.entries(counts).map(([reaction, count]) => ({ reaction, count })));
    }, [id]);

    useEffect(() => { loadComments(); loadReactions(); }, [loadComments, loadReactions]);

    // Realtime subscriptions
    useEffect(() => {
        if (!id) return;
        const commentSub = supabase.channel(`video-comments-${id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'video_comments', filter: `video_id=eq.${id}` }, () => loadComments())
            .subscribe();
        const reactionSub = supabase.channel(`video-reactions-${id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'video_reactions', filter: `video_id=eq.${id}` }, () => loadReactions())
            .subscribe();
        return () => { commentSub.unsubscribe(); reactionSub.unsubscribe(); };
    }, [id, loadComments, loadReactions]);

    // Auto-scroll
    useEffect(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [comments]);

    const handleSendComment = async () => {
        if (!user) { toast.error('Connectez-vous pour commenter'); return; }
        if (!newComment.trim()) return;
        setSendingComment(true);
        const { error } = await supabase.from('video_comments').insert({
            video_id: id,
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
        const { error } = await supabase.from('video_reactions').insert({
            video_id: id,
            user_id: user.id,
            reaction: emoji,
        });
        if (!error) {
            const floatId = Math.random().toString(36).slice(2);
            const x = 10 + Math.random() * 80;
            setFloatingEmojis(prev => [...prev, { id: floatId, emoji, x }]);
            setTimeout(() => setFloatingEmojis(prev => prev.filter(e => e.id !== floatId)), 2500);
        }
        setShowEmojiPicker(false);
    };

    const handleShare = async () => {
        const url = window.location.href;
        const title = video?.title || 'Vidéo Maison de Prière';
        if (navigator.share) {
            try {
                await navigator.share({ title, text: `Regardez cette vidéo: ${title}`, url });
                return;
            } catch (e) { }
        }
        await navigator.clipboard.writeText(url);
        setCopied(true);
        toast.success('🔗 Lien copié !');
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDeleteComment = async (commentId: string) => {
        await supabase.from('video_comments').delete().eq('id', commentId);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#050709] flex items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-blue-400" />
            </div>
        );
    }

    if (!video) {
        return (
            <div className="min-h-screen bg-[#050709] flex flex-col items-center justify-center gap-4 text-slate-400">
                <p>Vidéo introuvable</p>
                <Button variant="ghost" onClick={() => router.back()}>Retour</Button>
            </div>
        );
    }

    const embedSrc = convertToEmbed(video.video_url, video.platform);
    const totalReactions = reactions.reduce((acc, r) => acc + r.count, 0);
    const totalComments = comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0);

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#050709] to-[#0a0d14] flex flex-col">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 flex items-center gap-3 px-4 pt-10 pb-3 bg-gradient-to-b from-[#050709]/95 to-transparent backdrop-blur-sm">
                <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-9 w-9 shrink-0">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1 min-w-0">
                    <h1 className="font-black text-sm text-white truncate">{video.title}</h1>
                    <div className="flex items-center gap-2">
                        <Badge className="text-[8px] bg-blue-600/20 text-blue-300 px-1 py-0">
                            {CATEGORY_LABELS[video.category] || video.category}
                        </Badge>
                        <span className="text-[9px] text-slate-500 flex items-center gap-0.5">
                            <Eye className="h-3 w-3" /> {video.view_count || 0}
                        </span>
                    </div>
                </div>
                <Button variant="ghost" size="icon" onClick={handleShare} className="h-9 w-9 shrink-0">
                    {copied ? <Check className="h-5 w-5 text-green-400" /> : <Share2 className="h-5 w-5" />}
                </Button>
            </header>

            {/* Video player */}
            <div className="pt-20">
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

            {/* Reactions + share bar */}
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

                {/* Reaction pills */}
                <div className="flex gap-1.5 flex-wrap flex-1">
                    {reactions.sort((a, b) => b.count - a.count).slice(0, 6).map(r => (
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
                    <Button variant="ghost" size="icon" className="h-9 w-9"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
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

                {/* Share */}
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleShare}>
                    {copied ? <Check className="h-4 w-4 text-green-400" /> : <Share2 className="h-4 w-4 text-slate-400" />}
                </Button>
            </div>

            {/* Description */}
            {video.description && (
                <div className="px-4 py-2 border-b border-white/5">
                    <p className="text-sm text-slate-400">{video.description}</p>
                </div>
            )}

            {/* Original link */}
            <div className="px-4 py-2 border-b border-white/5">
                <a href={video.video_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] text-blue-400 hover:underline">
                    <ExternalLink className="h-3 w-3" />
                    Voir sur {video.platform}
                </a>
            </div>

            {/* Comments header */}
            <div className="px-4 py-2 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-bold text-slate-300">{totalComments} commentaire(s)</span>
            </div>

            {/* Comments list */}
            <div className="flex-1 px-3 py-2 space-y-3 pb-28">
                {comments.length === 0 ? (
                    <div className="text-center py-10 text-slate-500">
                        <MessageSquare className="h-10 w-10 mx-auto opacity-30 mb-2" />
                        <p className="text-sm">Soyez le premier à commenter !</p>
                    </div>
                ) : (
                    comments.map(comment => (
                        <div key={comment.id} className="space-y-2">
                            <CommentBubble comment={comment} userId={user?.id}
                                onReply={() => setReplyTo(comment)} onDelete={handleDeleteComment} />
                            {comment.replies?.map(reply => (
                                <div key={reply.id} className="pl-10">
                                    <CommentBubble comment={reply} userId={user?.id}
                                        onReply={() => setReplyTo(comment)} onDelete={handleDeleteComment} isReply />
                                </div>
                            ))}
                        </div>
                    ))
                )}
                <div ref={commentsEndRef} />
            </div>

            {/* Comment input */}
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0d14]/95 backdrop-blur-sm border-t border-white/5 px-3 py-3">
                {replyTo && (
                    <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-slate-800/60 rounded-xl">
                        <span className="text-[10px] text-blue-400 flex-1 truncate">
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
                        <AvatarFallback className="bg-blue-600 text-white text-xs">
                            {user ? (user.full_name?.[0] || '?').toUpperCase() : '?'}
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
                            className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 outline-none"
                        />
                        <button onClick={handleSendComment}
                            disabled={!newComment.trim() || sendingComment || !user}
                            className="shrink-0 text-blue-400 disabled:text-slate-600 hover:text-blue-300 transition-colors">
                            {sendingComment ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function CommentBubble({
    comment, userId, onReply, onDelete, isReply = false
}: {
    comment: Comment; userId?: string; onReply: () => void;
    onDelete: (id: string) => void; isReply?: boolean;
}) {
    const isOwn = userId === comment.user_id;
    const name = comment.profile?.full_name || 'Utilisateur';
    return (
        <div className="flex gap-2 items-start group">
            <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={comment.profile?.avatar_url || ''} />
                <AvatarFallback className="bg-blue-700 text-white text-xs">{name[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
                <div className="bg-slate-800/60 rounded-2xl px-3 py-2 inline-block max-w-full">
                    <p className="font-bold text-[11px] text-blue-300 mb-0.5">{name}</p>
                    <p className="text-sm text-white break-words">{comment.content}</p>
                </div>
                <div className="flex items-center gap-3 mt-1 px-1">
                    <span className="text-[9px] text-slate-500">
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: fr })}
                    </span>
                    {!isReply && (
                        <button onClick={onReply}
                            className="text-[10px] text-slate-500 hover:text-blue-400 font-bold transition-colors">
                            Répondre
                        </button>
                    )}
                    {isOwn && (
                        <button onClick={() => onDelete(comment.id)}
                            className="text-[10px] text-red-500/60 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                            Supprimer
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
