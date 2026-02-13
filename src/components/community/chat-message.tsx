'use client';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { VoiceMessagePlayer } from "./voice-message-player";

// Chat Message Component
export function ChatMessage({ message, isOwn }: { message: any; isOwn: boolean }) {
    return (
        <div className={cn("flex gap-3", isOwn && "flex-row-reverse")}>
            <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={message.profiles?.avatar_url} />
                <AvatarFallback className="bg-indigo-600/30 text-indigo-300 text-xs">
                    {message.profiles?.full_name?.[0] || 'U'}
                </AvatarFallback>
            </Avatar>
            <div className={cn(
                "max-w-[75%] rounded-2xl px-4 py-2.5",
                isOwn ? "bg-indigo-600 rounded-br-sm" : "bg-white/10 rounded-bl-sm"
            )}>
                {!isOwn && (
                    <p className="text-[10px] font-bold text-indigo-400 mb-1">
                        {message.profiles?.full_name || 'Utilisateur'}
                    </p>
                )}
                {/* Check if it's a voice message */}
                {message.type === 'voice' && message.voice_url ? (
                    <VoiceMessagePlayer
                        voiceUrl={message.voice_url}
                        duration={message.voice_duration}
                        isOwn={isOwn}
                    />
                ) : (
                    <p className="text-sm text-white leading-relaxed">{message.content}</p>
                )}
                <p className="text-[10px] text-white/50 mt-1">
                    {formatDistanceToNow(new Date(message.created_at), { addSuffix: true, locale: fr })}
                </p>
            </div>
        </div>
    );
}
