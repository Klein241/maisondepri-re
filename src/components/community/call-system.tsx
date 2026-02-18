'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Phone, PhoneOff, Video, VideoOff, Mic, MicOff,
    X, Users, Loader2, Volume2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ========== TYPES ==========
export interface CallSignal {
    callerId: string;
    callerName: string;
    callerAvatar?: string;
    callType: 'video' | 'audio';
    mode: 'private' | 'group';
    conversationId?: string;
    groupId?: string;
    groupName?: string;
}

// ========== INCOMING CALL OVERLAY (for community-view global listener) ==========
export function IncomingCallOverlay({
    call,
    onAccept,
    onReject,
}: {
    call: CallSignal;
    onAccept: () => void;
    onReject: () => void;
}) {
    const [elapsedTime, setElapsedTime] = useState(0);

    // Play ringtone using Web Audio API
    useEffect(() => {
        let isPlaying = true;
        let ctx: AudioContext | null = null;
        let interval: NodeJS.Timeout | null = null;

        try {
            ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

            const playRing = () => {
                if (!isPlaying || !ctx || ctx.state === 'closed') return;
                const playTone = (freq: number, start: number, dur: number) => {
                    const osc = ctx!.createOscillator();
                    const gain = ctx!.createGain();
                    osc.type = 'sine';
                    osc.frequency.value = freq;
                    gain.gain.setValueAtTime(0.15, ctx!.currentTime + start);
                    gain.gain.exponentialRampToValueAtTime(0.001, ctx!.currentTime + start + dur);
                    osc.connect(gain);
                    gain.connect(ctx!.destination);
                    osc.start(ctx!.currentTime + start);
                    osc.stop(ctx!.currentTime + start + dur);
                };
                // WhatsApp-style double ring
                playTone(440, 0, 0.25);
                playTone(523, 0, 0.25);
                playTone(440, 0.35, 0.25);
                playTone(523, 0.35, 0.25);
            };

            playRing();
            interval = setInterval(playRing, 2000);
        } catch (e) {
            console.log('Could not play ringtone:', e);
        }

        // Vibrate on mobile
        if ('vibrate' in navigator) {
            const vibratePattern = () => navigator.vibrate([300, 200, 300, 1200]);
            vibratePattern();
            const vibInterval = setInterval(vibratePattern, 2000);
            return () => {
                isPlaying = false;
                clearInterval(vibInterval);
                navigator.vibrate(0);
                if (interval) clearInterval(interval);
                ctx?.close();
            };
        }

        return () => {
            isPlaying = false;
            if (interval) clearInterval(interval);
            ctx?.close();
        };
    }, []);

    // Timer
    useEffect(() => {
        const interval = setInterval(() => {
            setElapsedTime(prev => prev + 1);
        }, 1000);

        // Auto-reject after 30 seconds
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
                        className="absolute rounded-full border border-green-500/20"
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
                        {call.callType === 'video' ? (
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
                    <Avatar className="h-28 w-28 border-4 border-green-500/30 shadow-2xl shadow-green-500/20">
                        <AvatarImage src={call.callerAvatar} />
                        <AvatarFallback className="bg-gradient-to-br from-indigo-600 to-purple-600 text-4xl font-bold text-white">
                            {call.callerName?.[0] || 'U'}
                        </AvatarFallback>
                    </Avatar>
                </motion.div>

                {/* Caller Name */}
                <h2 className="text-2xl font-black text-white mb-1">{call.callerName}</h2>
                <motion.p
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="text-slate-400 text-sm mb-2"
                >
                    {call.callType === 'video' ? 'Appel vidéo entrant...' : 'Appel vocal entrant...'}
                </motion.p>
                <p className="text-slate-500 text-xs font-mono">
                    {Math.floor(elapsedTime / 60).toString().padStart(2, '0')}:{(elapsedTime % 60).toString().padStart(2, '0')}
                </p>

                {call.groupName && (
                    <Badge className="bg-indigo-500/20 text-indigo-400 border-none mt-3">
                        <Users className="h-3 w-3 mr-1" />
                        {call.groupName}
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
                            {call.callType === 'video' ? (
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

// ========== GLOBAL CALL LISTENER HOOK ==========
// This hook listens for incoming call signals via Supabase broadcast.
// It should be mounted AT THE TOP LEVEL (community-view) so calls ring
// no matter which page/tab the user is on.
export function useCallListener(userId: string | undefined) {
    const [incomingCall, setIncomingCall] = useState<CallSignal | null>(null);

    useEffect(() => {
        if (!userId) return;

        // Listen for incoming call signals via broadcast (works for BOTH private and group calls)
        const signalChannel = supabase
            .channel(`call_signal_${userId}`)
            .on('broadcast', { event: 'incoming-call' }, (payload) => {
                const data = payload.payload as any;
                if (data && data.callerId && data.callerId !== userId) {
                    const signal: CallSignal = {
                        callerId: data.callerId,
                        callerName: data.callerName || 'Utilisateur',
                        callerAvatar: data.callerAvatar,
                        callType: data.callType || 'audio',
                        mode: data.mode || (data.groupId ? 'group' : 'private'),
                        conversationId: data.conversationId,
                        groupId: data.groupId,
                        groupName: data.groupName,
                    };
                    setIncomingCall(signal);
                }
            })
            .on('broadcast', { event: 'call-cancelled' }, (payload) => {
                const data = payload.payload as any;
                if (data?.callerId) {
                    setIncomingCall(prev => {
                        if (prev && prev.callerId === data.callerId) return null;
                        return prev;
                    });
                    toast.info('Appel annulé');
                }
            })
            .subscribe();

        return () => {
            signalChannel.unsubscribe();
        };
    }, [userId]);

    const acceptCall = useCallback(() => {
        if (!incomingCall) return;
        // The accept action just returns the call data, the parent component
        // will use it to open the WebRTCCall component
        const callData = { ...incomingCall };
        setIncomingCall(null);
        return callData;
    }, [incomingCall]);

    const rejectCall = useCallback(() => {
        setIncomingCall(null);
    }, []);

    return { incomingCall, acceptCall, rejectCall };
}

// ========== INITIATE CALL FUNCTION ==========
// This function signals the remote user(s) via Supabase broadcast
// that they have an incoming call. It does NOT open any external link.
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
}): Promise<void> {
    try {
        // Signal the remote user that they have an incoming call
        const remoteSignalChannel = supabase.channel(`call_signal_${receiverId}`, {
            config: { broadcast: { self: false } }
        });
        await remoteSignalChannel.subscribe();
        remoteSignalChannel.send({
            type: 'broadcast',
            event: 'incoming-call',
            payload: {
                callerId,
                callerName,
                callerAvatar,
                callType,
                mode: groupId ? 'group' : 'private',
                groupId: groupId || null,
                groupName: groupName || null,
            }
        });
        // Remove channel after a delay to let the message send
        setTimeout(() => supabase.removeChannel(remoteSignalChannel), 2000);
    } catch (e) {
        console.error('Error initiating call signal:', e);
    }
}

// ========== CALL BUTTONS FOR DM CONVERSATION ==========
export function DMCallButtons({
    currentUserId,
    currentUserName,
    currentUserAvatar,
    otherUserId,
    otherUserName,
    onStartCall,
}: {
    currentUserId: string;
    currentUserName: string;
    currentUserAvatar?: string;
    otherUserId: string;
    otherUserName: string;
    onStartCall?: (type: 'audio' | 'video') => void;
}) {
    const [isCalling, setIsCalling] = useState(false);

    const handleCall = async (type: 'video' | 'audio') => {
        setIsCalling(true);
        // Signal the receiver
        await initiateCall({
            callerId: currentUserId,
            callerName: currentUserName,
            callerAvatar: currentUserAvatar,
            receiverId: otherUserId,
            callType: type,
        });
        // Trigger the WebRTC call UI in the parent component
        if (onStartCall) {
            onStartCall(type);
        }
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
