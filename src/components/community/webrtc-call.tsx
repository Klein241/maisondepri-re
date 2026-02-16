'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, X, Loader2, Users, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// ICE servers for STUN/TURN
const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
    ]
};

interface Participant {
    id: string;
    name: string;
    avatar?: string | null;
    stream?: MediaStream;
    isMuted?: boolean;
}

interface WebRTCCallProps {
    user: { id: string; name: string; avatar?: string };
    callType: 'audio' | 'video';
    mode: 'private' | 'group';
    // For private calls
    remoteUser?: { id: string; name: string; avatar?: string | null };
    conversationId?: string;
    // For group calls
    groupId?: string;
    groupName?: string;
    groupMembers?: Array<{ id: string; full_name: string; avatar_url?: string | null }>;
    // Incoming call data
    isIncoming?: boolean;
    incomingOffer?: RTCSessionDescriptionInit;
    // Callbacks
    onEnd: () => void;
}

export function WebRTCCall({
    user,
    callType,
    mode,
    remoteUser,
    conversationId,
    groupId,
    groupName,
    groupMembers,
    isIncoming,
    incomingOffer,
    onEnd,
}: WebRTCCallProps) {
    const [callState, setCallState] = useState<'ringing' | 'connecting' | 'connected' | 'ended'>('ringing');
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
    const [duration, setDuration] = useState(0);
    const [participants, setParticipants] = useState<Participant[]>([]);

    const localStreamRef = useRef<MediaStream | null>(null);
    const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    const remoteAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
    const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const channelRef = useRef<any>(null);
    const ringtoneRef = useRef<HTMLAudioElement | null>(null);

    // Unique call ID
    const callId = useRef(`call_${Date.now()}_${Math.random().toString(36).slice(2)}`).current;

    // Format duration
    const formatDuration = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // Get user media
    const getUserMedia = useCallback(async () => {
        try {
            const constraints: MediaStreamConstraints = {
                audio: true,
                video: callType === 'video'
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            localStreamRef.current = stream;
            return stream;
        } catch (err) {
            console.error('Failed to get user media:', err);
            toast.error('Impossible d\'accéder au microphone. Vérifiez les permissions.');
            onEnd();
            return null;
        }
    }, [callType, onEnd]);

    // Create peer connection for a specific user
    const createPeerConnection = useCallback((peerId: string) => {
        const pc = new RTCPeerConnection(ICE_SERVERS);

        // Add local tracks
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, localStreamRef.current!);
            });
        }

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                // Send ICE candidate via Supabase channel
                channelRef.current?.send({
                    type: 'broadcast',
                    event: 'ice-candidate',
                    payload: {
                        from: user.id,
                        to: peerId,
                        candidate: event.candidate.toJSON(),
                    }
                });
            }
        };

        // Handle remote stream
        pc.ontrack = (event) => {
            const remoteStream = event.streams[0];
            if (remoteStream) {
                // Create or update audio/video element
                let audioEl = remoteAudioRefs.current.get(peerId);
                if (!audioEl) {
                    audioEl = new Audio();
                    audioEl.autoplay = true;
                    remoteAudioRefs.current.set(peerId, audioEl);
                }
                audioEl.srcObject = remoteStream;

                setParticipants(prev => {
                    const existing = prev.find(p => p.id === peerId);
                    if (existing) {
                        return prev.map(p => p.id === peerId ? { ...p, stream: remoteStream } : p);
                    }
                    const member = groupMembers?.find(m => m.id === peerId);
                    return [...prev, {
                        id: peerId,
                        name: member?.full_name || remoteUser?.name || 'Utilisateur',
                        avatar: member?.avatar_url || remoteUser?.avatar,
                        stream: remoteStream,
                    }];
                });
            }
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'connected') {
                setCallState('connected');
            } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                // Remove this peer
                cleanupPeer(peerId);
            }
        };

        peerConnectionsRef.current.set(peerId, pc);
        return pc;
    }, [user.id, groupMembers, remoteUser]);

    // Cleanup a specific peer
    const cleanupPeer = (peerId: string) => {
        const pc = peerConnectionsRef.current.get(peerId);
        if (pc) {
            pc.close();
            peerConnectionsRef.current.delete(peerId);
        }
        const audioEl = remoteAudioRefs.current.get(peerId);
        if (audioEl) {
            audioEl.srcObject = null;
            remoteAudioRefs.current.delete(peerId);
        }
        setParticipants(prev => prev.filter(p => p.id !== peerId));
    };

    // Initialize call
    useEffect(() => {
        let mounted = true;

        const initCall = async () => {
            const stream = await getUserMedia();
            if (!stream || !mounted) return;

            // Setup signaling channel
            const channelName = mode === 'private'
                ? `call_${[user.id, remoteUser?.id].sort().join('_')}`
                : `group_call_${groupId}`;

            const channel = supabase.channel(channelName, {
                config: { broadcast: { self: false } }
            });

            channel.on('broadcast', { event: 'offer' }, async ({ payload }) => {
                if (payload.to !== user.id) return;
                const pc = createPeerConnection(payload.from);
                await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                channel.send({
                    type: 'broadcast',
                    event: 'answer',
                    payload: { from: user.id, to: payload.from, answer }
                });
                setCallState('connecting');
            });

            channel.on('broadcast', { event: 'answer' }, async ({ payload }) => {
                if (payload.to !== user.id) return;
                const pc = peerConnectionsRef.current.get(payload.from);
                if (pc) {
                    await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
                }
                setCallState('connecting');
            });

            channel.on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
                if (payload.to !== user.id) return;
                const pc = peerConnectionsRef.current.get(payload.from);
                if (pc) {
                    try {
                        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
                    } catch (e) {
                        console.error('Error adding ICE candidate:', e);
                    }
                }
            });

            channel.on('broadcast', { event: 'call-end' }, ({ payload }) => {
                if (payload.from) {
                    cleanupPeer(payload.from);
                }
                // If private call, end entirely
                if (mode === 'private') {
                    endCall();
                }
            });

            channel.on('broadcast', { event: 'call-join' }, async ({ payload }) => {
                if (payload.from === user.id) return;
                // New participant joined, send them an offer
                const pc = createPeerConnection(payload.from);
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);

                channel.send({
                    type: 'broadcast',
                    event: 'offer',
                    payload: { from: user.id, to: payload.from, offer }
                });
            });

            await channel.subscribe();
            channelRef.current = channel;

            // Announce joining
            channel.send({
                type: 'broadcast',
                event: 'call-join',
                payload: { from: user.id, name: user.name }
            });

            // For private call initiator, send offer to remote user
            if (mode === 'private' && !isIncoming && remoteUser) {
                setCallState('ringing');
                // Wait a moment for the remote user to potentially join
                setTimeout(async () => {
                    if (!mounted) return;
                    const pc = createPeerConnection(remoteUser.id);
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);

                    channel.send({
                        type: 'broadcast',
                        event: 'offer',
                        payload: { from: user.id, to: remoteUser.id, offer }
                    });
                    setCallState('connecting');
                }, 1000);
            } else if (isIncoming) {
                setCallState('connecting');
            } else if (mode === 'group') {
                setCallState('connecting');
            }
        };

        initCall();

        return () => {
            mounted = false;
        };
    }, []);

    // Duration timer
    useEffect(() => {
        if (callState === 'connected') {
            durationIntervalRef.current = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);
        }
        return () => {
            if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
        };
    }, [callState]);

    // Auto-timeout for ringing
    useEffect(() => {
        if (callState === 'ringing') {
            const timeout = setTimeout(() => {
                if (callState === 'ringing') {
                    toast.info('Pas de réponse');
                    endCall();
                }
            }, 30000); // 30s timeout
            return () => clearTimeout(timeout);
        }
    }, [callState]);

    // Toggle mute
    const toggleMute = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsMuted(prev => !prev);
        }
    };

    // Toggle video
    const toggleVideo = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getVideoTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsVideoEnabled(prev => !prev);
        }
    };

    // End call
    const endCall = () => {
        // Notify others
        channelRef.current?.send({
            type: 'broadcast',
            event: 'call-end',
            payload: { from: user.id }
        });

        // Cleanup
        peerConnectionsRef.current.forEach((pc, _) => pc.close());
        peerConnectionsRef.current.clear();
        remoteAudioRefs.current.forEach((audio, _) => {
            audio.srcObject = null;
        });
        remoteAudioRefs.current.clear();

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }

        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }

        if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
        }

        setCallState('ended');
        onEnd();
    };

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed inset-0 z-[100] bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-between p-6"
            >
                {/* Top bar */}
                <div className="text-center mt-8">
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                        {callType === 'video' ? '📹 Appel vidéo' : '📞 Appel vocal'}
                        {mode === 'group' && ` • ${groupName || 'Groupe'}`}
                    </p>
                    <p className="text-sm text-slate-300">
                        {callState === 'ringing' && 'Sonnerie...'}
                        {callState === 'connecting' && 'Connexion...'}
                        {callState === 'connected' && formatDuration(duration)}
                        {callState === 'ended' && 'Terminé'}
                    </p>
                </div>

                {/* Participants */}
                <div className="flex-1 flex items-center justify-center w-full max-w-md">
                    {mode === 'private' ? (
                        /* Private call - single remote user */
                        <div className="text-center">
                            <motion.div
                                animate={callState === 'ringing' ? {
                                    scale: [1, 1.05, 1],
                                    opacity: [1, 0.8, 1]
                                } : {}}
                                transition={{ duration: 2, repeat: Infinity }}
                            >
                                <Avatar className="h-28 w-28 mx-auto mb-4 ring-4 ring-white/10">
                                    <AvatarImage src={remoteUser?.avatar || undefined} />
                                    <AvatarFallback className="text-3xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white">
                                        {getInitials(remoteUser?.name || '?')}
                                    </AvatarFallback>
                                </Avatar>
                            </motion.div>
                            <h2 className="text-xl font-semibold text-white">{remoteUser?.name || 'Utilisateur'}</h2>
                            {callState === 'ringing' && (
                                <motion.p
                                    animate={{ opacity: [0.5, 1, 0.5] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                    className="text-sm text-slate-400 mt-1"
                                >
                                    Appel en cours...
                                </motion.p>
                            )}
                            {callState === 'connecting' && (
                                <div className="flex items-center gap-2 justify-center mt-2">
                                    <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                                    <span className="text-sm text-slate-400">Connexion...</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Group call - multiple participants */
                        <div className="w-full space-y-4">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-sm mx-auto">
                                {/* Current user */}
                                <div className="text-center">
                                    <Avatar className="h-16 w-16 mx-auto mb-1 ring-2 ring-green-500/50">
                                        <AvatarImage src={user.avatar || undefined} />
                                        <AvatarFallback className="text-sm bg-gradient-to-br from-green-500 to-emerald-500 text-white">
                                            {getInitials(user.name)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <p className="text-xs text-white truncate">Vous</p>
                                    {isMuted && <span className="text-[10px] text-red-400">🔇</span>}
                                </div>

                                {/* Remote participants */}
                                {participants.map(p => (
                                    <div key={p.id} className="text-center">
                                        <Avatar className="h-16 w-16 mx-auto mb-1 ring-2 ring-indigo-500/50">
                                            <AvatarImage src={p.avatar || undefined} />
                                            <AvatarFallback className="text-sm bg-gradient-to-br from-indigo-500 to-purple-500 text-white">
                                                {getInitials(p.name)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <p className="text-xs text-white truncate">{p.name}</p>
                                    </div>
                                ))}
                            </div>
                            <p className="text-center text-xs text-slate-500">
                                <Users className="h-3 w-3 inline mr-1" />
                                {participants.length + 1} participant{participants.length > 0 ? 's' : ''}
                            </p>
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="flex items-center gap-4 mb-8">
                    {/* Mute */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleMute}
                        className={`h-14 w-14 rounded-full ${isMuted
                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                            : 'bg-white/10 text-white hover:bg-white/20'
                            }`}
                    >
                        {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                    </Button>

                    {/* End Call */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={endCall}
                        className="h-16 w-16 rounded-full bg-red-600 hover:bg-red-700 text-white"
                    >
                        <PhoneOff className="h-7 w-7" />
                    </Button>

                    {/* Video toggle (if video call) */}
                    {callType === 'video' && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleVideo}
                            className={`h-14 w-14 rounded-full ${!isVideoEnabled
                                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                : 'bg-white/10 text-white hover:bg-white/20'
                                }`}
                        >
                            {isVideoEnabled ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
                        </Button>
                    )}

                    {/* Speaker (visual only — audio is always played) */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-14 w-14 rounded-full bg-white/10 text-white hover:bg-white/20"
                    >
                        <Volume2 className="h-6 w-6" />
                    </Button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

// Helper: Incoming call notification overlay
interface IncomingCallProps {
    callerName: string;
    callerAvatar?: string | null;
    callType: 'audio' | 'video';
    onAccept: () => void;
    onReject: () => void;
}

export function IncomingCallOverlay({ callerName, callerAvatar, callType, onAccept, onReject }: IncomingCallProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[110] w-80 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl"
        >
            <div className="flex items-center gap-3 mb-3">
                <Avatar className="h-12 w-12">
                    <AvatarImage src={callerAvatar || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white">
                        {callerName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-semibold text-white text-sm">{callerName}</p>
                    <motion.p
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="text-xs text-slate-400"
                    >
                        {callType === 'video' ? '📹 Appel vidéo entrant...' : '📞 Appel vocal entrant...'}
                    </motion.p>
                </div>
            </div>
            <div className="flex gap-3">
                <Button
                    onClick={onReject}
                    className="flex-1 h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white"
                >
                    <PhoneOff className="h-4 w-4 mr-1" />
                    Refuser
                </Button>
                <Button
                    onClick={onAccept}
                    className="flex-1 h-10 rounded-xl bg-green-600 hover:bg-green-700 text-white"
                >
                    <Phone className="h-4 w-4 mr-1" />
                    Répondre
                </Button>
            </div>
        </motion.div>
    );
}
