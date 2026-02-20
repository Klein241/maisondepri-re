'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Radio, X, Send, Heart, Smile, Trash2, UserX, Pin,
    MessageCircle, ChevronDown, MoreVertical, AlertTriangle,
    Facebook, Youtube, Instagram, Tv, Monitor, ArrowLeft, Users, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

// ===== TYPES =====
interface LiveStream {
    id: string;
    group_id: string;
    created_by: string;
    title: string;
    platform: string;
    embed_url: string | null;
    embed_code: string | null;
    is_active: boolean;
    viewer_count: number;
    started_at: string;
    ended_at: string | null;
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

interface LiveReaction {
    id: string;
    emoji: string;
    user_id: string;
    created_at: string;
}

// ===== PLATFORM CONFIGS =====
const PLATFORMS = [
    { id: 'facebook', name: 'Facebook', icon: Facebook, color: '#1877F2', gradient: 'from-blue-600 to-blue-700' },
    { id: 'youtube', name: 'YouTube', icon: Youtube, color: '#FF0000', gradient: 'from-red-600 to-red-700' },
    { id: 'tiktok', name: 'TikTok', icon: Tv, color: '#000000', gradient: 'from-gray-800 to-black' },
    { id: 'instagram', name: 'Instagram', icon: Instagram, color: '#E4405F', gradient: 'from-pink-500 via-purple-500 to-orange-500' },
    { id: 'twitch', name: 'Twitch', icon: Monitor, color: '#9146FF', gradient: 'from-purple-600 to-purple-800' },
    { id: 'other', name: 'Autre', icon: Monitor, color: '#6366f1', gradient: 'from-indigo-600 to-indigo-700' },
];

const EMOJI_LIST = ['❤️', '🙏', '🔥', '👏', '😍', '✝️', '💪', '🙌', '😭', '💯', '⭐', '🕊️'];

// ===== EXTRACT EMBED URL =====
function extractEmbedUrl(input: string, platform: string): string | null {
    const trimmed = input.trim();

    // If it's an iframe, extract src
    const iframeMatch = trimmed.match(/src=["']([^"']+)["']/);
    if (iframeMatch) return iframeMatch[1];

    // If it's a URL, convert to embed
    try {
        const url = new URL(trimmed);

        if (platform === 'youtube') {
            // youtube.com/watch?v=ID or youtu.be/ID
            if (url.hostname.includes('youtube.com')) {
                const videoId = url.searchParams.get('v');
                if (videoId) return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
            }
            if (url.hostname === 'youtu.be') {
                return `https://www.youtube.com/embed${url.pathname}?autoplay=1`;
            }
        }

        if (platform === 'facebook') {
            // Facebook video URL
            return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(trimmed)}&show_text=false&autoplay=true`;
        }

        if (platform === 'twitch') {
            // twitch.tv/channel
            const channel = url.pathname.replace('/', '');
            if (channel) return `https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}`;
        }

        // For tiktok, instagram, etc. — use the URL directly
        return trimmed;
    } catch {
        // Not a valid URL
        return null;
    }
}

// ===== CREATE STREAM DIALOG =====
export function CreateStreamDialog({
    groupId,
    userId,
    isOpen,
    onClose,
    onCreated
}: {
    groupId: string;
    userId: string;
    isOpen: boolean;
    onClose: () => void;
    onCreated: (stream: LiveStream) => void;
}) {
    const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
    const [streamInput, setStreamInput] = useState('');
    const [streamTitle, setStreamTitle] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const handleCreate = async () => {
        if (!selectedPlatform || !streamInput.trim()) {
            toast.error("Sélectionnez une plateforme et collez le lien ou le code embed");
            return;
        }

        setIsCreating(true);
        try {
            const embedUrl = extractEmbedUrl(streamInput.trim(), selectedPlatform);
            const isEmbedCode = streamInput.trim().startsWith('<');

            const { data, error } = await supabase
                .from('group_livestreams')
                .insert({
                    group_id: groupId,
                    created_by: userId,
                    title: streamTitle.trim() || 'Diffusion en direct',
                    platform: selectedPlatform,
                    embed_url: embedUrl,
                    embed_code: isEmbedCode ? streamInput.trim() : null,
                    is_active: true,
                })
                .select()
                .single();

            if (error) throw error;

            toast.success('🔴 Diffusion en direct lancée !');
            onCreated(data);
            onClose();
            setSelectedPlatform(null);
            setStreamInput('');
            setStreamTitle('');
        } catch (e: any) {
            console.error('Error creating stream:', e);
            toast.error("Erreur: " + (e.message || "Impossible de créer la diffusion"));
        }
        setIsCreating(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-[#0F1219] border-white/10 text-white max-w-[92vw] sm:max-w-lg rounded-2xl sm:rounded-[2rem] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
                <DialogHeader>
                    <DialogTitle className="text-xl font-black flex items-center gap-2">
                        <Radio className="h-5 w-5 text-red-500 animate-pulse" />
                        Diffusion en Direct
                    </DialogTitle>
                    <DialogDescription className="text-slate-400">
                        Partagez votre live avec les membres du groupe
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 pt-4">
                    {/* Title */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Titre du live (optionnel)
                        </label>
                        <Input
                            placeholder="Ex: Prière du soir en direct"
                            value={streamTitle}
                            onChange={(e) => setStreamTitle(e.target.value)}
                            className="h-11 rounded-xl bg-white/5 border-white/10"
                        />
                    </div>

                    {/* Platform Selection */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Plateforme *
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {PLATFORMS.map(p => {
                                const Icon = p.icon;
                                return (
                                    <motion.button
                                        key={p.id}
                                        whileHover={{ scale: 1.03 }}
                                        whileTap={{ scale: 0.97 }}
                                        onClick={() => setSelectedPlatform(p.id)}
                                        className={cn(
                                            "flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all",
                                            selectedPlatform === p.id
                                                ? `bg-gradient-to-br ${p.gradient} border-white/20 shadow-lg`
                                                : "bg-white/5 border-white/10 hover:bg-white/10"
                                        )}
                                    >
                                        <Icon className="h-6 w-6" />
                                        <span className="text-[10px] font-bold">{p.name}</span>
                                    </motion.button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Stream URL/Embed */}
                    {selectedPlatform && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-2"
                        >
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                Lien ou code embed du live *
                            </label>
                            <Textarea
                                placeholder={
                                    selectedPlatform === 'youtube'
                                        ? "https://www.youtube.com/watch?v=... ou collez le code embed"
                                        : selectedPlatform === 'facebook'
                                            ? "https://www.facebook.com/.../videos/... ou collez le code embed"
                                            : "Collez le lien ou le code embed de votre live"
                                }
                                value={streamInput}
                                onChange={(e) => setStreamInput(e.target.value)}
                                className="min-h-[80px] bg-white/5 border-white/10 rounded-xl resize-none text-sm"
                            />
                            <p className="text-[10px] text-slate-500">
                                💡 Collez le lien de votre live OU le code embed (&lt;iframe...&gt;)
                            </p>
                        </motion.div>
                    )}

                    {/* Submit Button */}
                    <Button
                        className="w-full h-12 rounded-2xl bg-gradient-to-r from-red-600 to-pink-600 font-bold text-base shadow-lg shadow-red-600/30"
                        onClick={handleCreate}
                        disabled={isCreating || !selectedPlatform || !streamInput.trim()}
                    >
                        {isCreating ? (
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                            >
                                <Radio className="h-5 w-5" />
                            </motion.div>
                        ) : (
                            <>
                                <Radio className="h-5 w-5 mr-2" />
                                Publier le Live
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ===== LIVE STREAM SALON (Main viewer) =====
export function LiveStreamSalon({
    stream,
    groupId,
    groupName,
    userId,
    onClose,
}: {
    stream: LiveStream;
    groupId: string;
    groupName: string;
    userId: string;
    onClose: () => void;
}) {
    const [comments, setComments] = useState<LiveComment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [replyTo, setReplyTo] = useState<LiveComment | null>(null);
    const [reactions, setReactions] = useState<LiveReaction[]>([]);
    const [floatingReactions, setFloatingReactions] = useState<{ id: string; emoji: string; x: number }[]>([]);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [viewerCount, setViewerCount] = useState(stream.viewer_count);
    const [isAdmin, setIsAdmin] = useState(stream.created_by === userId);
    const [bannedUsers, setBannedUsers] = useState<string[]>([]);
    const [userProfile, setUserProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null);
    const commentsEndRef = useRef<HTMLDivElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    // Load user profile
    useEffect(() => {
        const loadProfile = async () => {
            const { data } = await supabase
                .from('profiles')
                .select('full_name, avatar_url')
                .eq('id', userId)
                .single();
            if (data) setUserProfile(data);
        };
        loadProfile();
    }, [userId]);

    // Load comments
    const loadComments = useCallback(async () => {
        const { data, error } = await supabase
            .from('livestream_comments')
            .select('*')
            .eq('livestream_id', stream.id)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error loading comments:', error);
            return;
        }

        if (data) {
            // Load profiles for comments
            const userIds = [...new Set(data.map(c => c.user_id))];
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url')
                .in('id', userIds);

            const profileMap = new Map((profiles || []).map(p => [p.id, p]));

            // Organize into threads
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

            // Attach replies to parent comments
            topLevel.forEach(c => {
                c.replies = repliesMap.get(c.id) || [];
            });

            setComments(topLevel);
        }
    }, [stream.id]);

    // Load banned users (admin only)
    useEffect(() => {
        if (!isAdmin) return;
        const loadBanned = async () => {
            const { data } = await supabase
                .from('livestream_banned_users')
                .select('user_id')
                .eq('livestream_id', stream.id);
            if (data) setBannedUsers(data.map(b => b.user_id));
        };
        loadBanned();
    }, [isAdmin, stream.id]);

    // Initial load + realtime
    useEffect(() => {
        loadComments();

        // Subscribe to new comments
        const commentsChannel = supabase
            .channel(`live-comments-${stream.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'livestream_comments',
                filter: `livestream_id=eq.${stream.id}`
            }, () => {
                loadComments();
            })
            .subscribe();

        // Subscribe to reactions
        const reactionsChannel = supabase
            .channel(`live-reactions-${stream.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'livestream_reactions',
                filter: `livestream_id=eq.${stream.id}`
            }, (payload) => {
                const reaction = payload.new as LiveReaction;
                // Show floating reaction animation
                const id = reaction.id;
                const x = 20 + Math.random() * 60; // random x position
                setFloatingReactions(prev => [...prev, { id, emoji: reaction.emoji, x }]);
                setTimeout(() => {
                    setFloatingReactions(prev => prev.filter(r => r.id !== id));
                }, 3000);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(commentsChannel);
            supabase.removeChannel(reactionsChannel);
        };
    }, [stream.id, loadComments]);

    // Auto scroll to bottom
    useEffect(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [comments]);

    // Send comment
    const handleSendComment = async () => {
        if (!newComment.trim()) return;

        try {
            const { error } = await supabase
                .from('livestream_comments')
                .insert({
                    livestream_id: stream.id,
                    user_id: userId,
                    content: newComment.trim(),
                    parent_id: replyTo?.id || null,
                });

            if (error) throw error;
            setNewComment('');
            setReplyTo(null);
        } catch (e: any) {
            toast.error("Erreur: " + e.message);
        }
    };

    // Send reaction
    const handleReaction = async (emoji: string) => {
        try {
            await supabase
                .from('livestream_reactions')
                .insert({
                    livestream_id: stream.id,
                    user_id: userId,
                    emoji,
                });
        } catch (e: any) {
            console.error('Error sending reaction:', e);
        }
        setShowEmojiPicker(false);
    };

    // Delete comment (admin)
    const handleDeleteComment = async (commentId: string) => {
        try {
            await supabase
                .from('livestream_comments')
                .delete()
                .eq('id', commentId);
            toast.success('Commentaire supprimé');
        } catch (e: any) {
            toast.error("Erreur: " + e.message);
        }
    };

    // Ban user from live (admin)
    const handleBanUser = async (targetUserId: string, userName: string) => {
        if (!confirm(`Retirer ${userName} du live ?`)) return;
        try {
            await supabase
                .from('livestream_banned_users')
                .insert({
                    livestream_id: stream.id,
                    user_id: targetUserId,
                    banned_by: userId,
                });
            setBannedUsers(prev => [...prev, targetUserId]);
            toast.success(`${userName} a été retiré du live`);
        } catch (e: any) {
            toast.error("Erreur: " + e.message);
        }
    };

    // End stream (admin)
    const handleEndStream = async () => {
        if (!confirm('Terminer la diffusion en direct ?')) return;
        try {
            await supabase
                .from('group_livestreams')
                .update({ is_active: false, ended_at: new Date().toISOString() })
                .eq('id', stream.id);
            toast.success('Diffusion terminée');
            onClose();
        } catch (e: any) {
            toast.error("Erreur: " + e.message);
        }
    };

    // Get platform config
    const platformConfig = PLATFORMS.find(p => p.id === stream.platform) || PLATFORMS[5];
    const PlatformIcon = platformConfig.icon;

    // Check if user is banned
    const isBanned = bannedUsers.includes(userId);

    // Render embed video
    const renderVideo = () => {
        if (stream.embed_code) {
            return (
                <div
                    className="w-full aspect-video bg-black rounded-xl overflow-hidden"
                    dangerouslySetInnerHTML={{ __html: stream.embed_code }}
                />
            );
        }
        if (stream.embed_url) {
            return (
                <div className="w-full aspect-video bg-black rounded-xl overflow-hidden">
                    <iframe
                        src={stream.embed_url}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                        allowFullScreen
                        frameBorder="0"
                    />
                </div>
            );
        }
        return (
            <div className="w-full aspect-video bg-black/50 rounded-xl flex items-center justify-center">
                <p className="text-slate-500 text-sm">Aucune vidéo disponible</p>
            </div>
        );
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
                        <h1 className="font-black text-base sm:text-lg truncate">{stream.title}</h1>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] sm:text-xs text-slate-500">
                        <PlatformIcon className="h-3 w-3" />
                        <span>{platformConfig.name}</span>
                        <span>•</span>
                        <span>{groupName}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Badge className="bg-red-600/20 text-red-400 gap-1 text-[10px]">
                        <Eye className="h-3 w-3" />
                        EN DIRECT
                    </Badge>
                    {isAdmin && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:bg-red-500/10 text-xs h-8"
                            onClick={handleEndStream}
                        >
                            Terminer
                        </Button>
                    )}
                </div>
            </header>

            {/* Video area */}
            <div className="px-2 sm:px-4 py-2 relative">
                {renderVideo()}

                {/* Floating Reactions */}
                <AnimatePresence>
                    {floatingReactions.map(r => (
                        <motion.div
                            key={r.id}
                            initial={{ opacity: 1, y: 0, x: `${r.x}%` }}
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

            {/* Quick reactions bar */}
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

                {/* Extended emoji picker */}
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

            {/* Comments section */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                <ScrollArea className="flex-1 px-3 sm:px-4" ref={scrollAreaRef}>
                    <div className="py-3 space-y-3">
                        {comments.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                <p className="text-sm">Soyez le premier à commenter</p>
                            </div>
                        ) : (
                            comments.map(comment => (
                                <CommentItem
                                    key={comment.id}
                                    comment={comment}
                                    userId={userId}
                                    isAdmin={isAdmin}
                                    onReply={() => setReplyTo(comment)}
                                    onDelete={() => handleDeleteComment(comment.id)}
                                    onBan={() => handleBanUser(comment.user_id, comment.profile?.full_name || 'Utilisateur')}
                                    onDeleteReply={(replyId) => handleDeleteComment(replyId)}
                                />
                            ))
                        )}
                        <div ref={commentsEndRef} />
                    </div>
                </ScrollArea>

                {/* Reply indicator */}
                {replyTo && (
                    <div className="px-3 sm:px-4 py-2 bg-indigo-500/10 border-t border-indigo-500/20 flex items-center gap-2">
                        <span className="text-xs text-indigo-300">
                            Répondre à <b>{replyTo.profile?.full_name || 'Utilisateur'}</b>
                        </span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 ml-auto"
                            onClick={() => setReplyTo(null)}
                        >
                            <X className="h-3 w-3" />
                        </Button>
                    </div>
                )}

                {/* Comment input */}
                {isBanned ? (
                    <div className="px-4 py-3 bg-red-500/10 border-t border-red-500/20">
                        <p className="text-xs text-red-400 text-center flex items-center justify-center gap-2">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Vous avez été retiré de ce live
                        </p>
                    </div>
                ) : (
                    <div className="px-3 sm:px-4 py-3 border-t border-white/5 flex items-center gap-2 bg-[#0a0d14]/80 backdrop-blur">
                        <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={userProfile?.avatar_url || undefined} />
                            <AvatarFallback className="bg-indigo-500/20 text-indigo-300 text-xs">
                                {(userProfile?.full_name || '?')[0]}
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
                                className="h-10 w-10 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 shrink-0"
                                onClick={handleSendComment}
                                disabled={!newComment.trim()}
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </motion.div>
                    </div>
                )}
            </div>
        </motion.div>
    );
}

// ===== COMMENT ITEM =====
function CommentItem({
    comment,
    userId,
    isAdmin,
    onReply,
    onDelete,
    onBan,
    onDeleteReply,
}: {
    comment: LiveComment;
    userId: string;
    isAdmin: boolean;
    onReply: () => void;
    onDelete: () => void;
    onBan: () => void;
    onDeleteReply: (id: string) => void;
}) {
    const isOwn = comment.user_id === userId;

    return (
        <div className="group">
            {/* Main comment */}
            <div className="flex items-start gap-2">
                <Avatar className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 mt-0.5">
                    <AvatarImage src={comment.profile?.avatar_url || undefined} />
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
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-white">
                                {comment.profile?.full_name || 'Utilisateur'}
                            </span>
                            {comment.is_pinned && (
                                <Pin className="h-2.5 w-2.5 text-amber-400" />
                            )}
                        </div>
                        <p className="text-sm text-slate-200 break-words whitespace-pre-wrap">{comment.content}</p>
                    </div>
                    <div className="flex items-center gap-3 mt-1 px-1">
                        <span className="text-[10px] text-slate-600">
                            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: fr })}
                        </span>
                        <button
                            onClick={onReply}
                            className="text-[10px] font-bold text-slate-500 hover:text-indigo-400 transition-colors"
                        >
                            Répondre
                        </button>
                        {(isOwn || isAdmin) && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className="text-slate-600 hover:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <MoreVertical className="h-3 w-3" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="bg-[#1a1f2e] border-white/10 text-white rounded-xl w-48">
                                    <DropdownMenuItem onClick={onDelete} className="gap-2 text-red-400">
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Supprimer
                                    </DropdownMenuItem>
                                    {isAdmin && !isOwn && (
                                        <DropdownMenuItem onClick={onBan} className="gap-2 text-orange-400">
                                            <UserX className="h-3.5 w-3.5" />
                                            Retirer du live
                                        </DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
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
                                <AvatarImage src={reply.profile?.avatar_url || undefined} />
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
                                            onClick={() => onDeleteReply(reply.id)}
                                            className="text-[9px] text-red-500/60 hover:text-red-400 opacity-0 group-hover/reply:opacity-100 transition-opacity"
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
    );
}

// ===== LIVE STREAM BUTTON (for group detail header) =====
export function LiveStreamButton({
    groupId,
    userId,
    isGroupAdmin,
    onOpenStream,
}: {
    groupId: string;
    userId: string;
    isGroupAdmin: boolean;
    onOpenStream: (stream: LiveStream) => void;
}) {
    const [activeStream, setActiveStream] = useState<LiveStream | null>(null);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [loading, setLoading] = useState(true);

    // Check for active livestream
    useEffect(() => {
        const checkStream = async () => {
            try {
                const { data, error } = await supabase
                    .from('group_livestreams')
                    .select('*')
                    .eq('group_id', groupId)
                    .eq('is_active', true)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                // If table doesn't exist or other error, just skip
                if (!error && data) {
                    setActiveStream(data);
                }
            } catch (e) {
                console.log('Livestream table not available yet');
            }
            setLoading(false);
        };
        checkStream();

        // Listen for stream changes (silently fails if table doesn't exist)
        let channel: any = null;
        try {
            channel = supabase
                .channel(`group-stream-${groupId}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'group_livestreams',
                    filter: `group_id=eq.${groupId}`
                }, (payload) => {
                    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                        const stream = payload.new as LiveStream;
                        if (stream.is_active) {
                            setActiveStream(stream);
                        } else {
                            setActiveStream(null);
                        }
                    }
                    if (payload.eventType === 'DELETE') {
                        setActiveStream(null);
                    }
                })
                .subscribe();
        } catch (e) {
            // Realtime subscription failed — table probably doesn't exist yet
        }

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    }, [groupId]);

    if (loading) return null;

    // Active stream exists — show blinking button for members
    if (activeStream) {
        return (
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                    className="rounded-2xl bg-gradient-to-r from-red-600 to-pink-600 shadow-lg shadow-red-600/30 border-0 gap-2 px-4 h-10 relative overflow-hidden"
                    onClick={() => onOpenStream(activeStream)}
                >
                    {/* Pulsing glow effect */}
                    <motion.div
                        className="absolute inset-0 bg-red-500/30"
                        animate={{ opacity: [0, 0.5, 0] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                    />
                    <motion.div
                        animate={{ scale: [1, 1.3, 1] }}
                        transition={{ repeat: Infinity, duration: 1 }}
                    >
                        <Radio className="h-4 w-4 relative z-10" />
                    </motion.div>
                    <span className="text-xs font-bold relative z-10">LIVE</span>
                </Button>
            </motion.div>
        );
    }

    // No active stream — show create button for admin only
    if (isGroupAdmin) {
        return (
            <>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button
                        className="rounded-2xl bg-gradient-to-r from-red-600/80 to-pink-600/80 hover:from-red-600 hover:to-pink-600 border-0 gap-2 px-4 h-10"
                        onClick={() => setShowCreateDialog(true)}
                    >
                        <Radio className="h-4 w-4" />
                        <span className="text-xs font-bold hidden sm:inline">Diffuser</span>
                    </Button>
                </motion.div>

                <CreateStreamDialog
                    groupId={groupId}
                    userId={userId}
                    isOpen={showCreateDialog}
                    onClose={() => setShowCreateDialog(false)}
                    onCreated={(stream) => {
                        setActiveStream(stream);
                        onOpenStream(stream);
                    }}
                />
            </>
        );
    }

    return null;
}
