'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Phone, PhoneOff, Video, VideoOff, Mic, MicOff,
    X, Copy, Check, ExternalLink, Users, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ========== TYPES ==========
interface CallData {
    id: string;
    caller_id: string;
    caller_name: string;
    caller_avatar?: string;
    receiver_id: string;
    call_type: 'video' | 'audio';
    meet_link: string;
    status: 'ringing' | 'accepted' | 'rejected' | 'missed' | 'ended';
    group_id?: string;
    group_name?: string;
    created_at: string;
}

// ========== GENERATE MEET LINK ==========
function generateMeetLink(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    const segment = (len: number) =>
        Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `https://meet.google.com/${segment(3)}-${segment(4)}-${segment(3)}`;
}

// ========== INCOMING CALL OVERLAY ==========
export function IncomingCallOverlay({
    call,
    onAccept,
    onReject,
}: {
    call: CallData;
    onAccept: () => void;
    onReject: () => void;
}) {
    const [elapsedTime, setElapsedTime] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Play ringtone
    useEffect(() => {
        try {
            // Create a simple ringtone using Web Audio API
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            let isPlaying = true;

            const playRing = () => {
                if (!isPlaying) return;
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.frequency.value = 440;
                oscillator.type = 'sine';
                gainNode.gain.value = 0.3;

                oscillator.start();
                gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
                oscillator.stop(audioContext.currentTime + 0.5);

                setTimeout(() => {
                    if (isPlaying) {
                        const osc2 = audioContext.createOscillator();
                        const gain2 = audioContext.createGain();
                        osc2.connect(gain2);
                        gain2.connect(audioContext.destination);
                        osc2.frequency.value = 554;
                        osc2.type = 'sine';
                        gain2.gain.value = 0.3;
                        osc2.start();
                        gain2.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
                        osc2.stop(audioContext.currentTime + 0.5);
                    }
                }, 600);
            };

            playRing();
            const interval = setInterval(playRing, 2000);

            return () => {
                isPlaying = false;
                clearInterval(interval);
                audioContext.close();
            };
        } catch (e) {
            console.log('Could not play ringtone:', e);
        }
    }, []);

    // Timer
    useEffect(() => {
        const interval = setInterval(() => {
            setElapsedTime(prev => prev + 1);
        }, 1000);

        // Auto-miss after 30 seconds
        const timeout = setTimeout(() => {
            onReject();
        }, 30000);

        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }, [onReject]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-gradient-to-b from-slate-900/98 via-indigo-950/95 to-slate-900/98 backdrop-blur-xl flex flex-col items-center justify-center"
        >
            {/* Animated background rings */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {[1, 2, 3].map(i => (
                    <motion.div
                        key={i}
                        className="absolute rounded-full border border-indigo-500/20"
                        animate={{
                            width: [100, 300 + i * 80],
                            height: [100, 300 + i * 80],
                            opacity: [0.6, 0],
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            delay: i * 0.5,
                            ease: 'easeOut',
                        }}
                    />
                ))}
            </div>

            {/* Call Type Icon */}
            <div className="relative z-10 flex flex-col items-center">
                <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="mb-2"
                >
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-sm px-4 py-1">
                        {call.call_type === 'video' ? (
                            <><Video className="h-4 w-4 mr-1.5" /> Appel Vidéo</>
                        ) : (
                            <><Phone className="h-4 w-4 mr-1.5" /> Appel Vocal</>
                        )}
                    </Badge>
                </motion.div>

                {/* Caller Avatar */}
                <motion.div
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="my-8"
                >
                    <Avatar className="h-28 w-28 border-4 border-indigo-500/30 shadow-2xl shadow-indigo-500/20">
                        <AvatarImage src={call.caller_avatar} />
                        <AvatarFallback className="bg-gradient-to-br from-indigo-600 to-purple-600 text-4xl font-bold text-white">
                            {call.caller_name?.[0] || 'U'}
                        </AvatarFallback>
                    </Avatar>
                </motion.div>

                {/* Caller Name */}
                <h2 className="text-2xl font-black text-white mb-1">{call.caller_name}</h2>
                <p className="text-slate-400 text-sm mb-2">
                    {call.call_type === 'video' ? 'Appel vidéo entrant...' : 'Appel vocal entrant...'}
                </p>
                <p className="text-slate-500 text-xs font-mono">
                    {Math.floor(elapsedTime / 60).toString().padStart(2, '0')}:{(elapsedTime % 60).toString().padStart(2, '0')}
                </p>

                {call.group_name && (
                    <Badge className="bg-indigo-500/20 text-indigo-400 border-none mt-3">
                        <Users className="h-3 w-3 mr-1" />
                        {call.group_name}
                    </Badge>
                )}
            </div>

            {/* Action Buttons */}
            <div className="relative z-10 flex items-center gap-12 mt-16">
                {/* Reject */}
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                    <button
                        onClick={onReject}
                        className="flex flex-col items-center gap-2"
                    >
                        <div className="h-16 w-16 rounded-full bg-red-600 flex items-center justify-center shadow-lg shadow-red-600/40 hover:bg-red-500 transition-colors">
                            <PhoneOff className="h-7 w-7 text-white" />
                        </div>
                        <span className="text-xs text-red-400 font-medium">Refuser</span>
                    </button>
                </motion.div>

                {/* Accept */}
                <motion.div
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                >
                    <button
                        onClick={onAccept}
                        className="flex flex-col items-center gap-2"
                    >
                        <div className="h-16 w-16 rounded-full bg-green-600 flex items-center justify-center shadow-lg shadow-green-600/40 hover:bg-green-500 transition-colors">
                            {call.call_type === 'video' ? (
                                <Video className="h-7 w-7 text-white" />
                            ) : (
                                <Phone className="h-7 w-7 text-white" />
                            )}
                        </div>
                        <span className="text-xs text-green-400 font-medium">Décrocher</span>
                    </button>
                </motion.div>
            </div>
        </motion.div>
    );
}

// ========== CALL LISTENER HOOK ==========
export function useCallListener(userId: string | undefined) {
    const [incomingCall, setIncomingCall] = useState<CallData | null>(null);

    useEffect(() => {
        if (!userId) return;

        // Listen for incoming calls in realtime
        const channel = supabase
            .channel(`calls_for_${userId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'calls',
                filter: `receiver_id=eq.${userId}`
            }, (payload) => {
                const call = payload.new as CallData;
                if (call.status === 'ringing') {
                    setIncomingCall(call);
                }
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'calls',
                filter: `receiver_id=eq.${userId}`
            }, (payload) => {
                const call = payload.new as CallData;
                // If call was ended/cancelled by caller, dismiss
                if (call.status === 'ended' || call.status === 'missed') {
                    setIncomingCall(null);
                }
            })
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [userId]);

    const acceptCall = useCallback(async () => {
        if (!incomingCall) return;

        try {
            await supabase
                .from('calls')
                .update({ status: 'accepted' })
                .eq('id', incomingCall.id);

            // Open the meet link
            window.open(incomingCall.meet_link, '_blank');
            setIncomingCall(null);
            toast.success('Appel connecté !');
        } catch (e) {
            console.error('Error accepting call:', e);
            toast.error("Erreur lors de l'acceptation de l'appel");
        }
    }, [incomingCall]);

    const rejectCall = useCallback(async () => {
        if (!incomingCall) return;

        try {
            await supabase
                .from('calls')
                .update({ status: 'rejected' })
                .eq('id', incomingCall.id);

            setIncomingCall(null);
        } catch (e) {
            console.error('Error rejecting call:', e);
        }
    }, [incomingCall]);

    return { incomingCall, acceptCall, rejectCall };
}

// ========== INITIATE CALL FUNCTION ==========
export async function initiateCall({
    callerId,
    callerName,
    callerAvatar,
    receiverId,
    callType,
    groupId,
    groupName,
}: {
    callerId: string;
    callerName: string;
    callerAvatar?: string;
    receiverId: string;
    callType: 'video' | 'audio';
    groupId?: string;
    groupName?: string;
}): Promise<string | null> {
    const meetLink = generateMeetLink();

    try {
        const { data, error } = await supabase
            .from('calls')
            .insert({
                caller_id: callerId,
                caller_name: callerName,
                caller_avatar: callerAvatar,
                receiver_id: receiverId,
                call_type: callType,
                meet_link: meetLink,
                status: 'ringing',
                group_id: groupId || null,
                group_name: groupName || null,
            })
            .select()
            .single();

        if (error) {
            // Table might not exist - fallback to direct meet link
            if (error.message.includes('does not exist') || error.code === '42P01') {
                toast.info(`Lien d'appel: ${meetLink}`);
                window.open(meetLink, '_blank');
                return meetLink;
            }
            throw error;
        }

        // Open meet link for caller immediately
        window.open(meetLink, '_blank');

        // Set a timeout to mark as missed if not answered
        setTimeout(async () => {
            try {
                const { data: callData } = await supabase
                    .from('calls')
                    .select('status')
                    .eq('id', data.id)
                    .single();

                if (callData?.status === 'ringing') {
                    await supabase
                        .from('calls')
                        .update({ status: 'missed' })
                        .eq('id', data.id);
                }
            } catch (e) {
                // Ignore
            }
        }, 30000);

        toast.success(`Appel ${callType === 'video' ? 'vidéo' : 'vocal'} lancé ! En attente de réponse...`);
        return meetLink;
    } catch (e) {
        console.error('Error initiating call:', e);
        // Fallback: just open meet
        const fallbackLink = `https://meet.google.com/new`;
        window.open(fallbackLink, '_blank');
        toast.info("Appel lancé via Google Meet");
        return fallbackLink;
    }
}

// ========== CALL BUTTONS FOR DM CONVERSATION ==========
export function DMCallButtons({
    currentUserId,
    currentUserName,
    currentUserAvatar,
    otherUserId,
    otherUserName,
}: {
    currentUserId: string;
    currentUserName: string;
    currentUserAvatar?: string;
    otherUserId: string;
    otherUserName: string;
}) {
    const [isCalling, setIsCalling] = useState(false);

    const handleCall = async (type: 'video' | 'audio') => {
        setIsCalling(true);
        await initiateCall({
            callerId: currentUserId,
            callerName: currentUserName,
            callerAvatar: currentUserAvatar,
            receiverId: otherUserId,
            callType: type,
        });
        setIsCalling(false);
    };

    return (
        <div className="flex gap-1">
            {/* Voice Call */}
            <Button
                variant="ghost"
                size="icon"
                className="text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded-full h-10 w-10"
                onClick={() => handleCall('audio')}
                disabled={isCalling}
            >
                {isCalling ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                    <Phone className="h-5 w-5" />
                )}
            </Button>
            {/* Video Call */}
            <Button
                variant="ghost"
                size="icon"
                className="text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded-full h-10 w-10"
                onClick={() => handleCall('video')}
                disabled={isCalling}
            >
                <Video className="h-5 w-5" />
            </Button>
        </div>
    );
}
