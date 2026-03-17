'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, CheckCheck, Paperclip, X, Download, ZoomIn, Maximize2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { VoiceMessagePlayer } from './voice-message-player';
import { getInitials, formatTime, getMemberColor } from './chat-utils';
import type { Message } from './chat-types';

// ══════════════════════════════════════════════════════════
// Render message content with clickable links, @mentions, "Lire la suite"
// ══════════════════════════════════════════════════════════

function RenderMessageContent({
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
    const WORD_LIMIT = 50;
    const words = content.split(/\s+/);
    const isLong = words.length > WORD_LIMIT;
    const isExpanded = expandedMessages.has(msgId || '');
    const displayContent = isLong && !isExpanded
        ? words.slice(0, WORD_LIMIT).join(' ') + '...'
        : content;

    const urlRegexLocal = /(https?:\/\/[^\s]+)/gi;
    const parts = displayContent.split(urlRegexLocal);
    const hasUrl = parts.length > 1;

    const renderWithFormatting = (text: string) => {
        const boldParts = text.split(/(\*\*.*?\*\*)/g);
        return boldParts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
                return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>;
            }
            const mentionParts = part.split(/(@\w[\w\s]*?\s)/g);
            if (mentionParts.length <= 1) return part;
            return mentionParts.map((p, j) =>
                p.startsWith('@') ? <span key={`${i}-${j}`} className="text-indigo-400 font-semibold">{p}</span> : p
            );
        });
    };

    const readMoreBtn = isLong && !isExpanded ? (
        <button
            onClick={(e) => { e.stopPropagation(); onToggleExpand(msgId || '', true); }}
            className="text-indigo-400 hover:text-indigo-300 text-xs font-medium mt-1 block transition-colors"
        >
            Lire la suite ▼
        </button>
    ) : isLong && isExpanded ? (
        <button
            onClick={(e) => { e.stopPropagation(); onToggleExpand(msgId || '', false); }}
            className="text-indigo-400 hover:text-indigo-300 text-xs font-medium mt-1 block transition-colors"
        >
            Réduire ▲
        </button>
    ) : null;

    if (!hasUrl) return (
        <div>
            <p className="text-sm whitespace-pre-wrap wrap-break-word">{renderWithFormatting(displayContent)}</p>
            {readMoreBtn}
        </div>
    );

    return (
        <div>
            <div className="text-sm whitespace-pre-wrap wrap-break-word">
                {parts.map((part, i) => {
                    if (urlRegexLocal.test(part)) {
                        urlRegexLocal.lastIndex = 0;
                        let domain = '';
                        try { domain = new URL(part).hostname; } catch { domain = part; }
                        return (
                            <span key={i}>
                                <a href={part} target="_blank" rel="noopener noreferrer"
                                    className="text-blue-300 underline hover:text-blue-200 transition-colors break-all"
                                >{part}</a>
                                <div className="mt-1 rounded-lg bg-white/5 border border-white/10 p-2 max-w-full overflow-hidden">
                                    <p className="text-[10px] text-slate-400 truncate">🔗 {domain}</p>
                                    <p className="text-xs text-slate-300 truncate">{part.length > 60 ? part.slice(0, 60) + '...' : part}</p>
                                </div>
                            </span>
                        );
                    }
                    urlRegexLocal.lastIndex = 0;
                    return <span key={i}>{renderWithFormatting(part)}</span>;
                })}
            </div>
            {readMoreBtn}
        </div>
    );
}

// ══════════════════════════════════════════════════════════
// ChatMessageBubble — single message with reactions, reply, etc.
// ══════════════════════════════════════════════════════════

export interface ChatMessageBubbleProps {
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
    const [lightboxType, setLightboxType] = useState<'image' | 'file'>('image');

    const emojiCounts: Record<string, number> = {};
    Object.values(reactions).forEach(emoji => {
        emojiCounts[emoji] = (emojiCounts[emoji] || 0) + 1;
    });

    return (
        <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("flex", isOwn ? "justify-end" : "justify-start")}
        >
            {!isOwn && showAvatar && view === 'group' && (
                <Avatar className="h-8 w-8 mr-2 mt-auto">
                    <AvatarImage src={msg.sender?.avatar_url || undefined} />
                    <AvatarFallback className="text-xs bg-slate-600">
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
                        <p className="text-xs font-medium mb-1" style={{ color: getMemberColor(msg.sender_id) }}>
                            {msg.sender?.full_name}
                        </p>
                    )}

                    {/* Reply reference */}
                    {msg.reply_to_content && (
                        <div className="mb-1 px-2 py-1 rounded-lg bg-white/5 border-l-2 border-indigo-400 text-[10px] text-slate-400">
                            <span className="font-semibold text-indigo-400">{msg.reply_to_sender || 'Message'}</span>
                            <p className="truncate">{msg.reply_to_content}</p>
                        </div>
                    )}

                    {/* Voice / File / Image / Text */}
                    {msg.type === 'voice' && msg.voice_url ? (
                        <VoiceMessagePlayer voiceUrl={msg.voice_url} duration={msg.voice_duration} />
                    ) : msg.type === 'file' && msg.file_url ? (
                        <div className="space-y-1">
                            <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                                <Paperclip className="h-4 w-4 text-indigo-400 shrink-0" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-medium truncate">{msg.file_name || 'Fichier'}</p>
                                    <p className="text-[10px] text-slate-400">{msg.file_type || 'Document'}</p>
                                </div>
                                <button
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLightboxUrl(msg.file_url!); setLightboxType(msg.file_type?.startsWith('image') ? 'image' : 'file'); }}
                                    className="p-1 rounded hover:bg-white/10"
                                    title="Plein écran"
                                >
                                    <Maximize2 className="h-3.5 w-3.5 text-slate-400" />
                                </button>
                            </a>
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

                {/* Emoji reactions bar (hover) */}
                <div className="absolute -top-2 right-1 opacity-0 group-hover/msg:opacity-100 focus-within:opacity-100 flex items-center gap-0.5 bg-slate-800/95 border border-white/10 rounded-full px-1 py-0.5 shadow-lg z-10 transition-all">
                    {['👍', '❤️', '😂', '🙏', '🔥'].map(emoji => (
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
                            className="text-sm hover:scale-125 transition-transform px-0.5"
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

                {/* Show reactions below message */}
                {Object.keys(emojiCounts).length > 0 && (
                    <div className="flex gap-0.5 mt-0.5">
                        {Object.entries(emojiCounts).map(([emoji, count]) => (
                            <span key={emoji} className="inline-flex items-center gap-0.5 bg-white/10 rounded-full px-1.5 py-0.5 text-xs">
                                {emoji}{count > 1 && <span className="text-[10px] text-slate-400">{count}</span>}
                            </span>
                        ))}
                    </div>
                )}

                {/* Reply & Comment buttons */}
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
                        {(msg as any).comment_count > 0 && (
                            <span className="bg-indigo-500 text-white text-[9px] rounded-full px-1 min-w-[14px] text-center">
                                {(msg as any).comment_count}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* ═══ FULLSCREEN LIGHTBOX ═══ */}
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

                        {/* Download button */}
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

                        {/* Content */}
                        <div onClick={e => e.stopPropagation()} className="max-w-[95vw] max-h-[90vh]">
                            {lightboxType === 'image' ? (
                                <motion.img
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    src={lightboxUrl}
                                    alt=""
                                    className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                                />
                            ) : (
                                <div className="bg-slate-900 rounded-2xl p-8 text-center space-y-4 min-w-[300px]">
                                    <Paperclip className="h-12 w-12 text-indigo-400 mx-auto" />
                                    <p className="text-white font-medium">Fichier</p>
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
