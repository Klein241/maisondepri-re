'use client';

import { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Send, Smile, Mic, Paperclip, AtSign, BookOpen,
    Play, Pause, Trash2, Loader2, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EmojiPicker } from '@/components/ui/emoji-picker';
import { cn } from '@/lib/utils';
import { getInitials } from './chat-utils';
import type { Message, GroupMember } from './chat-types';

export interface ChatInputBarProps {
    view: 'conversation' | 'group';
    userId: string;
    // Message state
    newMessage: string;
    isSending: boolean;
    replyingTo: Message | null;
    // Mentions
    showMentions: boolean;
    mentionFilter: string;
    groupMembers: GroupMember[];
    onlineUsers: Record<string, boolean>;
    // Emoji
    showEmojiPicker: boolean;
    // Recording
    isRecording: boolean;
    isPaused: boolean;
    isUploadingVoice: boolean;
    recordingTime: number;
    // File upload
    isUploadingFile: boolean;
    uploadProgress?: Record<string, number>;
    // Handlers
    onMessageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSendMessage: () => void;
    onEmojiSelect: (emoji: string) => void;
    onToggleEmojiPicker: () => void;
    onToggleMentions: () => void;
    onInsertMention: (name: string) => void;
    onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onStartRecording: () => void;
    onStopRecording: () => void;
    onCancelRecording: () => void;
    onPauseRecording: () => void;
    onResumeRecording: () => void;
    onClearReply: () => void;
    onOpenBibleShare: () => void;
    inputRef: React.RefObject<HTMLInputElement | null>;
}

export function ChatInputBar({
    view, userId,
    newMessage, isSending, replyingTo,
    showMentions, mentionFilter, groupMembers, onlineUsers,
    showEmojiPicker,
    isRecording, isPaused, isUploadingVoice, recordingTime,
    isUploadingFile,
    uploadProgress = {},
    onMessageChange, onSendMessage,
    onEmojiSelect, onToggleEmojiPicker,
    onToggleMentions, onInsertMention,
    onFileUpload,
    onStartRecording, onStopRecording, onCancelRecording,
    onPauseRecording, onResumeRecording,
    onClearReply, onOpenBibleShare,
    inputRef,
}: ChatInputBarProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="p-2 sm:p-3 border-t border-white/10 bg-slate-900/95 backdrop-blur-md shrink-0 z-20">
            {/* @Mention suggestions */}
            <AnimatePresence>
                {showMentions && view === 'group' && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="mb-2 bg-slate-800 rounded-lg border border-white/10 max-h-32 overflow-y-auto"
                    >
                        {groupMembers
                            .filter(m => m.id !== userId && (!mentionFilter || m.full_name?.toLowerCase().includes(mentionFilter)))
                            .slice(0, 5)
                            .map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => onInsertMention(m.full_name || 'Utilisateur')}
                                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 text-left"
                                >
                                    <Avatar className="h-5 w-5">
                                        <AvatarImage src={m.avatar_url || undefined} />
                                        <AvatarFallback className="text-[8px] bg-slate-600">{getInitials(m.full_name)}</AvatarFallback>
                                    </Avatar>
                                    <span className="text-xs text-white">{m.full_name}</span>
                                    {(m.is_online || onlineUsers[m.id]) && <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />}
                                </button>
                            ))
                        }
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Emoji Picker */}
            <div className="relative">
                <EmojiPicker
                    isOpen={showEmojiPicker}
                    onClose={onToggleEmojiPicker}
                    onEmojiSelect={onEmojiSelect}
                />
            </div>

            {/* Reply preview bar */}
            {replyingTo && (
                <div className="flex items-center gap-2 mb-1 px-3 py-2 bg-slate-800/90 rounded-xl border-l-3 border-indigo-500">
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-indigo-400 font-semibold">↩ Répondre à {replyingTo.sender?.full_name || 'Message'}</p>
                        <p className="text-[11px] text-slate-400 truncate">
                            {replyingTo.type === 'image' ? '📷 Photo' : replyingTo.type === 'file' ? `📎 ${replyingTo.file_name || 'Fichier'}` : replyingTo.type === 'voice' ? '🎤 Message vocal' : replyingTo.content}
                        </p>
                    </div>
                    {(replyingTo.image_url || (replyingTo.type === 'image' && replyingTo.file_url)) && (
                        <img
                            src={replyingTo.image_url || replyingTo.file_url}
                            alt=""
                            className="w-10 h-10 rounded-md object-cover shrink-0"
                        />
                    )}
                    <button onClick={onClearReply} className="text-slate-500 hover:text-white p-1"><X className="h-3.5 w-3.5" /></button>
                </div>
            )}

            <div className="flex items-center gap-1 sm:gap-2">
                <Button variant="ghost" size="icon"
                    onClick={onToggleEmojiPicker}
                    className="text-slate-400 hover:text-white h-8 w-8 shrink-0"
                >
                    <Smile className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>

                {/* File attachment */}
                <Button variant="ghost" size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingFile}
                    className="text-slate-400 hover:text-white h-8 w-8 shrink-0"
                    title="Partager un fichier"
                >
                    {isUploadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4 sm:h-5 sm:w-5" />}
                </Button>
                <input ref={fileInputRef} type="file" className="hidden"
                    accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.epub"
                    multiple
                    onChange={onFileUpload}
                />

                {/* Multi-file upload progress */}
                {Object.keys(uploadProgress).length > 0 && (
                    <div className="absolute bottom-full left-0 right-0 mb-1 px-2 space-y-1">
                        {Object.entries(uploadProgress).map(([name, pct]) => (
                            <div key={name} className="bg-slate-800/95 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-white/10">
                                <div className="flex items-center justify-between text-[10px] mb-0.5">
                                    <span className="text-white truncate max-w-[180px]">{name}</span>
                                    <span className={pct === -1 ? 'text-red-400' : pct >= 100 ? 'text-green-400' : 'text-indigo-400'}>
                                        {pct === -1 ? '❌ Erreur' : pct >= 100 ? '✅ Envoyé' : `${Math.round(pct)}%`}
                                    </span>
                                </div>
                                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-300 ${pct === -1 ? 'bg-red-500' : pct >= 100 ? 'bg-green-500' : 'bg-indigo-500'
                                            }`}
                                        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {view === 'group' && (
                    <Button variant="ghost" size="icon"
                        onClick={onToggleMentions}
                        className="text-slate-400 hover:text-indigo-400 h-8 w-8 shrink-0"
                        title="Tagger un membre"
                    >
                        <AtSign className="h-4 w-4" />
                    </Button>
                )}

                {/* Bible share */}
                <Button variant="ghost" size="icon"
                    onClick={onOpenBibleShare}
                    className="text-slate-400 hover:text-amber-400 h-8 w-8 shrink-0"
                    title="Partager un verset biblique"
                >
                    <BookOpen className="h-4 w-4" />
                </Button>

                {isRecording ? (
                    <div className="flex-1 flex items-center gap-2 sm:gap-3 bg-red-500/20 rounded-full px-3 sm:px-4 py-2">
                        <div className={cn("w-3 h-3 bg-red-500 rounded-full", !isPaused && "animate-pulse")} />
                        <span className="text-red-400 font-mono flex-1 text-sm">
                            {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                            {isPaused && <span className="text-yellow-400 ml-2 text-xs">⏸️ Pause</span>}
                        </span>
                        <Button variant="ghost" size="icon" onClick={onCancelRecording}
                            className="text-red-400 hover:text-red-300 h-8 w-8" title="Supprimer">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon"
                            onClick={isPaused ? onResumeRecording : onPauseRecording}
                            className={cn("h-8 w-8", isPaused ? "text-green-400 hover:text-green-300" : "text-yellow-400 hover:text-yellow-300")}
                            title={isPaused ? 'Reprendre' : 'Pause'}>
                            {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={onStopRecording}
                            className="text-green-400 hover:text-green-300 h-8 w-8" title="Envoyer">
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                ) : isUploadingVoice ? (
                    <div className="flex-1 flex items-center justify-center gap-2 bg-indigo-500/20 rounded-full px-3 sm:px-4 py-2">
                        <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                        <span className="text-indigo-400 text-xs sm:text-sm">Envoi du message vocal...</span>
                    </div>
                ) : (
                    <Input
                        ref={inputRef}
                        placeholder={view === 'group' ? "Message... (@ pour tagger)" : "Écrire un message..."}
                        value={newMessage}
                        onChange={onMessageChange}
                        onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && onSendMessage()}
                        className="flex-1 bg-white/5 border-white/10 rounded-full text-sm min-w-0"
                    />
                )}

                {newMessage.trim() ? (
                    <Button size="icon" onClick={onSendMessage} disabled={isSending}
                        className="bg-indigo-600 hover:bg-indigo-500 rounded-full">
                        {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                ) : !isRecording && !isUploadingVoice && (
                    <Button variant="ghost" size="icon" onClick={onStartRecording}
                        className="text-slate-400 hover:text-white">
                        <Mic className="h-5 w-5" />
                    </Button>
                )}
            </div>
        </div>
    );
}
