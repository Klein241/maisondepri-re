'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, CheckCheck, Paperclip, X, Download, ZoomIn, Maximize2, FileText, Film, FileImage } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { VoiceMessagePlayer } from './voice-message-player';
import { getInitials, formatTime, getMemberColor } from './chat-utils';
import type { Message } from './chat-types';

// ══════════════════════════════════════════════════════════
// Render message content with clickable links, @mentions, "Lire la suite"
// ══════════════════════════════════════════════════════════

export function RenderMessageContent({
    content,
    msgId,
    expandedMessages,
    onToggleExpand,
}: {
    content: string;
    msgId?: string;
    expandedMessages: Set<string>;
    onToggleExpand: (id: string, expand: boolean) => void;
}) {
    const MAX_LENGTH = 400;
    const isExpanded = msgId ? expandedMessages.has(msgId) : true;
    const shouldTruncate = msgId && content.length > MAX_LENGTH;
    const displayContent = shouldTruncate && !isExpanded ? content.slice(0, MAX_LENGTH) + '...' : content;

    // Helper to render bold, italic, and links
    const renderWithFormatting = (text: string): React.ReactNode[] => {
        const parts: React.ReactNode[] = [];
        // Split by **bold**, *italic*, links, and @mentions
        const regex = /(\*\*.*?\*\*)|(\*.*?\*)|(https?:\/\/[^\s]+)|(@\w+)/g;
        let lastIndex = 0;
        let match;
        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
            const [full] = match;
            if (full.startsWith('**')) {
                parts.push(<strong key={match.index} className="font-bold">{full.slice(2, -2)}</strong>);
            } else if (full.startsWith('*')) {
                parts.push(<em key={match.index} className="italic">{full.slice(1, -1)}</em>);
            } else if (full.startsWith('http')) {
                // Feature 4: Detect Meet links and render as a join button
                if (full.includes('meet.google.com')) {
                    parts.push(
                        <a key={match.index} href={full} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 mt-1 bg-green-600 hover:bg-green-500 text-white text-xs rounded-lg font-medium transition-colors no-underline">
                            <Film className="h-3.5 w-3.5" />
                            Rejoindre la réunion Meet
                        </a>
                    );
                } else {
                    parts.push(<a key={match.index} href={full} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline break-all">{full}</a>);
                }
            } else if (full.startsWith('@')) {
                parts.push(<span key={match.index} className="text-indigo-400 font-semibold">{full}</span>);
            }
            lastIndex = match.index + full.length;
        }
        if (lastIndex < text.length) parts.push(text.slice(lastIndex));
        return parts;
    };

    return (
        <div className="text-sm whitespace-pre-wrap wrap-break-word">
            {displayContent.split('\n').map((line, i) => (
                <span key={i}>
                    {i > 0 && <br />}
                    {line.startsWith('> ') ? (
                        <span className="text-slate-400 border-l-2 border-indigo-400 pl-2 italic text-xs">{renderWithFormatting(line.slice(2))}</span>
                    ) : renderWithFormatting(line)}
                </span>
            ))}
            {shouldTruncate && (
                <button
                    onClick={() => onToggleExpand(msgId!, !isExpanded)}
                    className="text-indigo-400 hover:text-indigo-300 text-[11px] ml-1 underline"
                >
                    {isExpanded ? 'Réduire' : 'Lire la suite'}
                </button>
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════
// Helper: get file type icon
// ══════════════════════════════════════════════════════════
function getFileIcon(fileType?: string) {
    if (!fileType) return <Paperclip className="h-5 w-5 text-indigo-400" />;
    if (fileType.startsWith('image/')) return <FileImage className="h-5 w-5 text-green-400" />;
    if (fileType.startsWith('video/')) return <Film className="h-5 w-5 text-purple-400" />;
    if (fileType.includes('pdf')) return <FileText className="h-5 w-5 text-red-400" />;
    if (fileType.includes('word') || fileType.includes('document')) return <FileText className="h-5 w-5 text-blue-400" />;
    if (fileType.includes('epub')) return <FileText className="h-5 w-5 text-amber-400" />;
    return <Paperclip className="h-5 w-5 text-indigo-400" />;
}

// ══════════════════════════════════════════════════════════
// ChatMessageBubble — single message with reactions, reply, etc.
// ══════════════════════════════════════════════════════════

interface ChatMessageBubbleProps {
    msg: Message;
    isOwn: boolean;
    showAvatar: boolean;
    view: 'conversation' | 'group';
    userId: string;
    expandedMessages: Set<string>;
    onToggleExpand: (id: string, expand: boolean) => void;
    onReply: (msg: Message) => void;
    onThread: (msg: Message) => void;
    onDelete: (msg: Message, forEveryone: boolean) => void;
    onReaction: (msgId: string, emoji: string, currentReactions: Record<string, string>) => void;
}

export function ChatMessageBubble({
    msg, isOwn, showAvatar, view, userId,
    expandedMessages, onToggleExpand,
    onReply, onThread, onDelete, onReaction,
}: ChatMessageBubbleProps) {
    const reactions: Record<string, string> = (() => {
        try {
            const r = (msg as any).reactions;
            if (typeof r === 'string') return JSON.parse(r || '{}');
            if (typeof r === 'object' && r !== null) return r;
            return {};
        } catch { return {}; }
    })();

    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
    const [lightboxType, setLightboxType] = useState<'image' | 'video' | 'pdf' | 'file'>('image');

    const emojiCounts: Record<string, number> = {};
    Object.values(reactions).forEach(emoji => {
        emojiCounts[emoji] = (emojiCounts[emoji] || 0) + 1;
    });

    // Detect file type for fullscreen viewer
    const getViewerType = useCallback((url: string, type?: string): 'image' | 'video' | 'pdf' | 'file' => {
        if (type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url)) return 'image';
        if (type?.startsWith('video/') || /\.(mp4|webm|mov|avi)$/i.test(url)) return 'video';
        if (type?.includes('pdf') || /\.pdf$/i.test(url)) return 'pdf';
        return 'file';
    }, []);

    return (
        <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("flex", isOwn ? "justify-end" : "justify-start")}
        >
            {!isOwn && showAvatar && view === 'group' && (
                <Avatar className="h-7 w-7 sm:h-8 sm:w-8 mr-1.5 sm:mr-2 mt-auto">
                    <AvatarImage src={msg.sender?.avatar_url || undefined} />
                    <AvatarFallback className="text-[10px] sm:text-xs bg-slate-600">
                        {getInitials(msg.sender?.full_name ?? null)}
                    </AvatarFallback>
                </Avatar>
            )}
            <div className="group/msg relative">
                <div
                    className={cn(
                        "max-w-[85%] sm:max-w-[75%] rounded-2xl px-3 sm:px-4 py-2",
                        isOwn
                            ? "bg-indigo-600 text-white rounded-br-sm"
                            : "bg-white/10 text-white rounded-bl-sm"
                    )}
                >
                    {!isOwn && view === 'group' && showAvatar && (
                        <p className="text-[10px] sm:text-xs font-medium mb-1" style={{ color: getMemberColor(msg.sender_id) }}>
                            {msg.sender?.full_name}
                        </p>
                    )}

                    {/* Feature 10: Reply reference — show image thumbnail if replying to an image */}
                    {msg.reply_to_content && (
                        <div className="mb-1 px-2 py-1 rounded-lg bg-white/5 border-l-2 border-indigo-400 text-[10px] text-slate-400 flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                                <span className="font-semibold text-indigo-400">{msg.reply_to_sender || 'Message'}</span>
                                {msg.reply_to_image_url ? (
                                    <p className="text-[10px] text-slate-500">🖼️ Image</p>
                                ) : (
                                    <p className="truncate">{msg.reply_to_content}</p>
                                )}
                            </div>
                            {/* Feature 10: show thumbnail of replied image instead of text */}
                            {msg.reply_to_image_url && (
                                <img
                                    src={msg.reply_to_image_url}
                                    alt=""
                                    className="w-12 h-12 rounded-md object-cover shrink-0 border border-white/10"
                                />
                            )}
                        </div>
                    )}

                    {/* Voice / File / Image / Text */}
                    {msg.type === 'voice' && msg.voice_url ? (
                        <VoiceMessagePlayer voiceUrl={msg.voice_url} duration={msg.voice_duration} />
                    ) : msg.type === 'file' && msg.file_url ? (
                        /* Feature 10: File preview with fullscreen open */
                        <div className="space-y-1">
                            <button
                                onClick={() => {
                                    const vType = getViewerType(msg.file_url!, msg.file_type);
                                    setLightboxUrl(msg.file_url!);
                                    setLightboxType(vType);
                                }}
                                className="w-full flex items-center gap-2 p-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-left"
                            >
                                {getFileIcon(msg.file_type)}
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-medium truncate">{msg.file_name || 'Fichier'}</p>
                                    <p className="text-[10px] text-slate-400">
                                        {msg.file_type || 'Document'} • Appuyez pour ouvrir
                                        {msg.is_downloadable === false && <span className="text-amber-400 ml-1">🔒 Consultation seule</span>}
                                    </p>
                                </div>
                                <Maximize2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            </button>
                        </div>
                    ) : msg.type === 'image' && msg.image_url ? (
                        <button
                            onClick={() => { setLightboxUrl(msg.image_url!); setLightboxType('image'); }}
                            className="block cursor-zoom-in relative group/img"
                        >
                            <img src={msg.image_url} alt="" className="max-w-full rounded-lg max-h-60 object-cover" />
                            <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/30 transition-colors rounded-lg flex items-center justify-center">
                                <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover/img:opacity-100 transition-opacity" />
                            </div>
                        </button>
                    ) : (
                        <RenderMessageContent
                            content={msg.content}
                            msgId={msg.id}
                            expandedMessages={expandedMessages}
                            onToggleExpand={onToggleExpand}
                        />
                    )}

                    <div className="flex items-center justify-end gap-1 mt-1">
                        <span className="text-[10px] opacity-70">{formatTime(msg.created_at)}</span>
                        {isOwn && (
                            msg.is_read ? (
                                <CheckCheck className="h-3 w-3 text-blue-400" />
                            ) : (
                                <Check className="h-3 w-3 opacity-70" />
                            )
                        )}
                    </div>
                </div>

                {/* Feature 8: Emoji reactions bar (hover/touch) — visible to all */}
                <div className="absolute -top-2 right-1 opacity-0 group-hover/msg:opacity-100 focus-within:opacity-100 flex items-center gap-0.5 bg-slate-800/95 border border-white/10 rounded-full px-1 py-0.5 shadow-lg z-10 transition-all">
                    {['👍', '❤️', '😂', '🙏', '🔥', '😢'].map(emoji => (
                        <button
                            key={emoji}
                            onClick={() => {
                                const newReactions = { ...reactions };
                                if (newReactions[userId] === emoji) {
                                    delete newReactions[userId];
                                } else {
                                    newReactions[userId] = emoji;
                                }
                                onReaction(msg.id, emoji, newReactions);
                            }}
                            className={cn(
                                "text-sm hover:scale-125 transition-transform px-0.5",
                                reactions[userId] === emoji && "bg-white/20 rounded-full"
                            )}
                        >{emoji}</button>
                    ))}
                    {isOwn && (
                        <>
                            <span className="w-px h-4 bg-white/10 mx-0.5" />
                            <button
                                onClick={() => {
                                    if (window.confirm('Supprimer ce message ?')) {
                                        onDelete(msg, true);
                                    }
                                }}
                                className="text-[10px] text-slate-400 hover:text-red-400 px-1"
                                title="Supprimer"
                            >🗑️</button>
                        </>
                    )}
                </div>

                {/* Feature 8: Show reactions below message — visible to all members */}
                {Object.keys(emojiCounts).length > 0 && (
                    <div className="flex flex-wrap gap-0.5 mt-0.5">
                        {Object.entries(emojiCounts).map(([emoji, count]) => (
                            <span
                                key={emoji}
                                className={cn(
                                    "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs cursor-pointer hover:bg-white/20 transition-colors",
                                    reactions[userId] === emoji ? "bg-indigo-500/30 border border-indigo-400/50" : "bg-white/10"
                                )}
                                onClick={() => {
                                    const newReactions = { ...reactions };
                                    if (newReactions[userId] === emoji) {
                                        delete newReactions[userId];
                                    } else {
                                        newReactions[userId] = emoji;
                                    }
                                    onReaction(msg.id, emoji, newReactions);
                                }}
                            >
                                {emoji}{count > 1 && <span className="text-[10px] text-slate-400">{count}</span>}
                            </span>
                        ))}
                    </div>
                )}

                {/* Feature 7: Reply & Comment buttons with realtime badge */}
                <div className={cn("flex items-center gap-2 mt-1", isOwn ? "justify-end" : "justify-start")}>
                    <button
                        onClick={() => onReply(msg)}
                        className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-indigo-400 transition-colors"
                    >
                        <span>↩</span><span>Répondre</span>
                    </button>
                    <button
                        onClick={() => onThread(msg)}
                        className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                        title="Commenter"
                    >
                        <span>💬</span><span>Commenter</span>
                    </button>
                </div>

                {/* Feature 7: Comment count badge — positioned BELOW the message container */}
                {msg.comment_count && msg.comment_count > 0 && (
                    <button
                        onClick={() => onThread(msg)}
                        className={cn(
                            "flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors cursor-pointer",
                            "bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/30",
                            isOwn ? "ml-auto" : ""
                        )}
                    >
                        <span>💬</span>
                        <span>{msg.comment_count} commentaire{msg.comment_count > 1 ? 's' : ''}</span>
                    </button>
                )}
            </div>

            {/* ═══ FULLSCREEN LIGHTBOX — Feature 10: supports images, videos, PDFs ═══ */}
            <AnimatePresence>
                {lightboxUrl && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-9999 bg-black/95 backdrop-blur-md flex items-center justify-center"
                        onClick={() => setLightboxUrl(null)}
                    >
                        {/* Close button */}
                        <button
                            onClick={() => setLightboxUrl(null)}
                            className="absolute top-4 right-4 z-10 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                        >
                            <X className="h-6 w-6 text-white" />
                        </button>

                        {/* Feature 9: Download button — respect is_downloadable permission */}
                        {msg.is_downloadable !== false ? (
                            <a
                                href={lightboxUrl}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="absolute top-4 left-4 z-10 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                                title="Télécharger"
                            >
                                <Download className="h-6 w-6 text-white" />
                            </a>
                        ) : (
                            <div
                                className="absolute top-4 left-4 z-10 p-2 bg-red-500/20 rounded-full cursor-not-allowed"
                                title="Téléchargement désactivé par l'expéditeur"
                            >
                                <span className="text-lg">🔒</span>
                            </div>
                        )}

                        {/* Content — Feature 10: open files in fullscreen */}
                        <div onClick={e => e.stopPropagation()} className="max-w-[95vw] max-h-[90vh] w-full flex items-center justify-center">
                            {lightboxType === 'image' ? (
                                <motion.img
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    src={lightboxUrl}
                                    alt=""
                                    className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                                />
                            ) : lightboxType === 'video' ? (
                                <motion.video
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    src={lightboxUrl}
                                    controls
                                    autoPlay
                                    className="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
                                />
                            ) : lightboxType === 'pdf' ? (
                                <motion.iframe
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    src={lightboxUrl}
                                    className="w-full h-[85vh] rounded-lg shadow-2xl bg-white"
                                    title="PDF Viewer"
                                />
                            ) : (
                                <div className="bg-slate-900 rounded-2xl p-8 text-center space-y-4 min-w-[300px]">
                                    {getFileIcon(msg.file_type)}
                                    <p className="text-white font-medium">{msg.file_name || 'Fichier'}</p>
                                    <a
                                        href={lightboxUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors"
                                    >
                                        <Download className="h-4 w-4" /> Ouvrir / Télécharger
                                    </a>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
