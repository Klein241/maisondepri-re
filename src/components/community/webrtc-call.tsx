'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, X, Loader2, Users, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ICE servers for STUN/TURN — TURN is critical for NAT traversal
const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        // Free TURN servers from Open Relay (metered.ca)
        {
            urls: 'turn:a.relay.metered.ca:80',
            username: 'e8dd65b92f6bce436e5d1345',
            credential: 'dTSbp/tK+LKQbXmg',
        },
        {
            urls: 'turn:a.relay.metered.ca:80?transport=tcp',
            username: 'e8dd65b92f6bce436e5d1345',
            credential: 'dTSbp/tK+LKQbXmg',
        },
        {
            urls: 'turn:a.relay.metered.ca:443',
            username: 'e8dd65b92f6bce436e5d1345',
            credential: 'dTSbp/tK+LKQbXmg',
        },
        {
            urls: 'turns:a.relay.metered.ca:443?transport=tcp',
            username: 'e8dd65b92f6bce436e5d1345',
            credential: 'dTSbp/tK+LKQbXmg',
        },
    ],
    iceCandidatePoolSize: 10,
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
    remoteUser?: {
        id: string;
        name: string;
        avatar?: string;
    };
    callType: 'audio' | 'video';
    mode: 'private' | 'group';
    conversationId?: string;
    groupId?: string;
    groupName?: string;
    groupMembers?: Array<{ id: string; full_name: string; avatar_url?: string | null }>;
    isIncoming?: boolean;
    incomingOffer?: RTCSessionDescriptionInit;
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
    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
    const remoteVideoRefs = useRef<Map<string, HTMLVideoElement | HTMLAudioElement>>(new Map());
    const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const channelRef = useRef<any>(null);
    const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
    const mountedRef = useRef(true);

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
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
                video: callType === 'video' ? {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user',
                } : false,
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            localStreamRef.current = stream;

            // Show local video
            if (localVideoRef.current && callType === 'video') {
                localVideoRef.current.srcObject = stream;
            }

            return stream;
        } catch (err) {
            console.error('Failed to get user media:', err);
            toast.error('Impossible d\'accéder au microphone/caméra. Vérifiez les permissions.');
            onEnd();
            return null;
        }
    }, [callType, onEnd]);

    // Create peer connection for a specific user
    const createPeerConnection = useCallback((peerId: string) => {
        // If already exists, close and recreate
        const existing = peerConnectionsRef.current.get(peerId);
        if (existing) {
            existing.close();
            peerConnectionsRef.current.delete(peerId);
        }

        const pc = new RTCPeerConnection(ICE_SERVERS);

        // Add local tracks
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, localStreamRef.current!);
            });
        }

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate && channelRef.current) {
                channelRef.current.send({
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
            if (!remoteStream) return;

            remoteStreamsRef.current.set(peerId, remoteStream);

            // Create audio/video element for playback
            const existingEl = remoteVideoRefs.current.get(peerId);
            if (existingEl) {
                existingEl.srcObject = remoteStream;
            } else {
                if (callType === 'video') {
                    // Video elements are managed in JSX
                } else {
                    const audioEl = new Audio();
                    audioEl.autoplay = true;
                    audioEl.srcObject = remoteStream;
                    remoteVideoRefs.current.set(peerId, audioEl);
                }
            }

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
        };

        // Connection state changes
        pc.onconnectionstatechange = () => {
            console.log(`[WebRTC] Peer ${peerId} state: ${pc.connectionState}`);
            if (pc.connectionState === 'connected') {
                setCallState('connected');
            } else if (pc.connectionState === 'failed') {
                console.warn(`[WebRTC] Connection to ${peerId} failed, attempting restart...`);
                // Try ICE restart
                pc.restartIce();
            } else if (pc.connectionState === 'disconnected') {
                // Give it a moment to reconnect
                setTimeout(() => {
                    if (pc.connectionState === 'disconnected') {
                        cleanupPeer(peerId);
                        if (mode === 'private') {
                            toast.info('Connexion perdue');
                            endCall();
                        }
                    }
                }, 5000);
            }
        };

        pc.oniceconnectionstatechange = () => {
            console.log(`[WebRTC] ICE state for ${peerId}: ${pc.iceConnectionState}`);
            if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
                setCallState('connected');
            }
        };

        peerConnectionsRef.current.set(peerId, pc);
        return pc;
    }, [user.id, groupMembers, remoteUser, callType, mode]);

    // Add queued ICE candidates
    const flushPendingCandidates = useCallback(async (peerId: string) => {
        const pc = peerConnectionsRef.current.get(peerId);
        const pending = pendingCandidatesRef.current.get(peerId);
        if (pc && pending && pending.length > 0) {
            for (const candidate of pending) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (e) {
                    console.warn('[WebRTC] Error adding queued ICE candidate:', e);
                }
            }
            pendingCandidatesRef.current.set(peerId, []);
        }
    }, []);

    // Cleanup a specific peer
    const cleanupPeer = useCallback((peerId: string) => {
        const pc = peerConnectionsRef.current.get(peerId);
        if (pc) {
            pc.close();
            peerConnectionsRef.current.delete(peerId);
        }
        const el = remoteVideoRefs.current.get(peerId);
        if (el) {
            el.srcObject = null;
            remoteVideoRefs.current.delete(peerId);
        }
        remoteStreamsRef.current.delete(peerId);
        setParticipants(prev => prev.filter(p => p.id !== peerId));
    }, []);

    // End call
    const endCall = useCallback(() => {
        // Notify others
        channelRef.current?.send({
            type: 'broadcast',
            event: 'call-end',
            payload: { from: user.id }
        });

        // Send call-cancelled signal to remote user if private call
        if (mode === 'private' && remoteUser) {
            const cancelChannel = supabase.channel(`call_signal_${remoteUser.id}_cancel_${Date.now()}`, {
                config: { broadcast: { self: false } }
            });
            cancelChannel.subscribe().then(() => {
                cancelChannel.send({
                    type: 'broadcast',
                    event: 'call-cancelled',
                    payload: { callerId: user.id }
                });
                setTimeout(() => supabase.removeChannel(cancelChannel), 2000);
            });
        }

        // Cleanup all peers
        peerConnectionsRef.current.forEach((pc) => pc.close());
        peerConnectionsRef.current.clear();
        remoteVideoRefs.current.forEach((el) => {
            el.srcObject = null;
        });
        remoteVideoRefs.current.clear();
        remoteStreamsRef.current.clear();

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
    }, [user.id, mode, remoteUser, onEnd]);

    // Initialize call
    useEffect(() => {
        mountedRef.current = true;

        const initCall = async () => {
            const stream = await getUserMedia();
            if (!stream || !mountedRef.current) return;

            // Unique channel name based on call participants
            const channelName = mode === 'private'
                ? `webrtc_call_${[user.id, remoteUser?.id].sort().join('_')}`
                : `webrtc_group_call_${groupId}`;

            const channel = supabase.channel(channelName, {
                config: { broadcast: { self: false } }
            });

            // --- SIGNALING HANDLERS ---

            channel.on('broadcast', { event: 'offer' }, async ({ payload }) => {
                if (!mountedRef.current || payload.to !== user.id) return;
                console.log('[WebRTC] Received offer from', payload.from);

                const pc = createPeerConnection(payload.from);
                try {
                    await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
                    // Flush any ICE candidates that arrived before the offer
                    await flushPendingCandidates(payload.from);

                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);

                    channel.send({
                        type: 'broadcast',
                        event: 'answer',
                        payload: { from: user.id, to: payload.from, answer }
                    });
                    setCallState('connecting');
                } catch (e) {
                    console.error('[WebRTC] Error handling offer:', e);
                }
            });

            channel.on('broadcast', { event: 'answer' }, async ({ payload }) => {
                if (!mountedRef.current || payload.to !== user.id) return;
                console.log('[WebRTC] Received answer from', payload.from);

                const pc = peerConnectionsRef.current.get(payload.from);
                if (pc && pc.signalingState === 'have-local-offer') {
                    try {
                        await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
                        // Flush any queued ICE candidates
                        await flushPendingCandidates(payload.from);
                    } catch (e) {
                        console.error('[WebRTC] Error handling answer:', e);
                    }
                }
                setCallState('connecting');
            });

            channel.on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
                if (!mountedRef.current || payload.to !== user.id) return;

                const pc = peerConnectionsRef.current.get(payload.from);
                if (pc && pc.remoteDescription) {
                    try {
                        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
                    } catch (e) {
                        console.warn('[WebRTC] Error adding ICE candidate:', e);
                    }
                } else {
                    // Queue the candidate — the offer/answer hasn't been set yet
                    const pending = pendingCandidatesRef.current.get(payload.from) || [];
                    pending.push(payload.candidate);
                    pendingCandidatesRef.current.set(payload.from, pending);
                }
            });

            channel.on('broadcast', { event: 'call-end' }, ({ payload }) => {
                if (!mountedRef.current) return;
                if (payload.from) {
                    cleanupPeer(payload.from);
                }
                if (mode === 'private') {
                    toast.info('Appel terminé par l\'autre participant');
                    endCall();
                }
            });

            channel.on('broadcast', { event: 'call-join' }, async ({ payload }) => {
                if (!mountedRef.current || payload.from === user.id) return;
                console.log('[WebRTC] User joined:', payload.from, payload.name);

                // New participant joined — create peer connection and send offer
                // Small delay to ensure both sides are subscribed
                setTimeout(async () => {
                    if (!mountedRef.current) return;
                    const pc = createPeerConnection(payload.from);
                    try {
                        const offer = await pc.createOffer();
                        await pc.setLocalDescription(offer);

                        channel.send({
                            type: 'broadcast',
                            event: 'offer',
                            payload: { from: user.id, to: payload.from, offer }
                        });
                    } catch (e) {
                        console.error('[WebRTC] Error creating offer for joiner:', e);
                    }
                }, 500);
            });

            // Subscribe to channel first, THEN send signals
            await channel.subscribe((status: string) => {
                console.log('[WebRTC] Channel status:', status);
            });
            channelRef.current = channel;

            // Announce joining (after channel is confirmed subscribed)
            await new Promise(resolve => setTimeout(resolve, 300));
            channel.send({
                type: 'broadcast',
                event: 'call-join',
                payload: { from: user.id, name: user.name }
            });

            // --- PRIVATE CALL: Initiator sends offer ---
            if (mode === 'private' && !isIncoming && remoteUser) {
                setCallState('ringing');

                // Signal the remote user that they have an incoming call
                const sigChannelName = `call_signal_${remoteUser.id}`;
                const remoteSignalChannel = supabase.channel(sigChannelName, {
                    config: { broadcast: { self: false } }
                });
                await remoteSignalChannel.subscribe();
                await new Promise(resolve => setTimeout(resolve, 200));
                remoteSignalChannel.send({
                    type: 'broadcast',
                    event: 'incoming-call',
                    payload: {
                        callerId: user.id,
                        callerName: user.name,
                        callerAvatar: user.avatar,
                        callType,
                        mode: 'private',
                        conversationId,
                    }
                });
                setTimeout(() => supabase.removeChannel(remoteSignalChannel), 3000);

                // Wait for the remote user to join the call channel, then send offer
                // The offer will be sent when we receive their 'call-join' event
                // But also send a proactive offer after a delay as a fallback
                setTimeout(async () => {
                    if (!mountedRef.current) return;
                    // Only send if we haven't already connected
                    if (peerConnectionsRef.current.size === 0) {
                        const pc = createPeerConnection(remoteUser.id);
                        try {
                            const offer = await pc.createOffer();
                            await pc.setLocalDescription(offer);
                            channel.send({
                                type: 'broadcast',
                                event: 'offer',
                                payload: { from: user.id, to: remoteUser.id, offer }
                            });
                            setCallState('connecting');
                        } catch (e) {
                            console.error('[WebRTC] Error sending proactive offer:', e);
                        }
                    }
                }, 2000);

            } else if (isIncoming) {
                setCallState('connecting');
            } else if (mode === 'group') {
                setCallState('connecting');

                // Notify all group members
                if (groupMembers && groupMembers.length > 0) {
                    for (const member of groupMembers) {
                        if (member.id === user.id) continue;
                        const memberSigChannel = supabase.channel(`call_signal_${member.id}`, {
                            config: { broadcast: { self: false } }
                        });
                        await memberSigChannel.subscribe();
                        await new Promise(resolve => setTimeout(resolve, 100));
                        memberSigChannel.send({
                            type: 'broadcast',
                            event: 'incoming-call',
                            payload: {
                                callerId: user.id,
                                callerName: user.name,
                                callerAvatar: user.avatar,
                                callType,
                                groupId,
                                groupName,
                                mode: 'group',
                            }
                        });
                        setTimeout(() => supabase.removeChannel(memberSigChannel), 3000);
                    }
                }
            }
        };

        initCall();

        return () => {
            mountedRef.current = false;
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

    // Auto-timeout for ringing (30s)
    useEffect(() => {
        if (callState === 'ringing') {
            const timeout = setTimeout(() => {
                if (callState === 'ringing') {
                    toast.info('Pas de réponse');
                    endCall();
                }
            }, 30000);
            return () => clearTimeout(timeout);
        }
    }, [callState, endCall]);

    // Outgoing ringtone
    useEffect(() => {
        if (callState !== 'ringing' && callState !== 'connecting') return;
        let ctx: AudioContext | null = null;
        let interval: NodeJS.Timeout | null = null;
        try {
            ctx = new AudioContext();
            const playBeep = () => {
                if (!ctx || ctx.state === 'closed') return;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = 425;
                gain.gain.setValueAtTime(0.08, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.8);
            };
            playBeep();
            interval = setInterval(playBeep, 3000);
        } catch { /* ignore */ }
        return () => {
            if (interval) clearInterval(interval);
            ctx?.close();
        };
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

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    };

    // Assign remote video ref
    const setRemoteVideoRef = useCallback((peerId: string) => (el: HTMLVideoElement | null) => {
        if (el) {
            remoteVideoRefs.current.set(peerId, el);
            const stream = remoteStreamsRef.current.get(peerId);
            if (stream) {
                el.srcObject = stream;
            }
        }
    }, []);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-gradient-to-b from-slate-900 via-slate-950 to-black flex flex-col"
        >
            {/* Header */}
            <div className="px-6 pt-12 pb-4 text-center">
                <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">
                    {mode === 'group' ? (groupName || 'Appel de groupe') : 'Appel privé'}
                </p>
                <h2 className="text-xl font-bold text-white">
                    {mode === 'private' ? (remoteUser?.name || 'Utilisateur') : (groupName || 'Groupe')}
                </h2>
                <p className={cn(
                    "text-sm mt-1",
                    callState === 'connected' ? "text-green-400" :
                        callState === 'ringing' ? "text-amber-400 animate-pulse" :
                            callState === 'connecting' ? "text-blue-400 animate-pulse" :
                                "text-slate-500"
                )}>
                    {callState === 'ringing' && '📞 Appel en cours...'}
                    {callState === 'connecting' && '🔗 Connexion...'}
                    {callState === 'connected' && `🟢 ${formatDuration(duration)}`}
                    {callState === 'ended' && 'Appel terminé'}
                </p>
            </div>

            {/* Video/Avatars area */}
            <div className="flex-1 flex items-center justify-center px-4 relative overflow-hidden">
                {callType === 'video' ? (
                    <div className="w-full h-full grid gap-2" style={{
                        gridTemplateColumns: participants.length <= 1 ? '1fr' : participants.length <= 4 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
                        gridAutoRows: 'minmax(0, 1fr)',
                    }}>
                        {/* Local video */}
                        <div className="relative rounded-2xl overflow-hidden bg-slate-800 border border-white/10">
                            <video
                                ref={localVideoRef}
                                autoPlay
                                muted
                                playsInline
                                className="w-full h-full object-cover"
                                style={{ transform: 'scaleX(-1)' }}
                            />
                            <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded-lg">
                                <p className="text-xs text-white font-medium">Vous</p>
                            </div>
                            {isMuted && (
                                <div className="absolute top-2 right-2 bg-red-500/80 p-1 rounded-full">
                                    <MicOff className="h-3 w-3 text-white" />
                                </div>
                            )}
                        </div>

                        {/* Remote videos */}
                        {participants.map((p) => (
                            <div key={p.id} className="relative rounded-2xl overflow-hidden bg-slate-800 border border-white/10">
                                {p.stream ? (
                                    <video
                                        ref={setRemoteVideoRef(p.id)}
                                        autoPlay
                                        playsInline
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full bg-slate-800">
                                        <Avatar className="h-20 w-20">
                                            <AvatarImage src={p.avatar || undefined} />
                                            <AvatarFallback className="bg-indigo-600/30 text-indigo-300 text-2xl">
                                                {getInitials(p.name)}
                                            </AvatarFallback>
                                        </Avatar>
                                    </div>
                                )}
                                <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded-lg">
                                    <p className="text-xs text-white font-medium">{p.name}</p>
                                </div>
                            </div>
                        ))}

                        {/* Connecting placeholder */}
                        {callState !== 'connected' && participants.length === 0 && (
                            <div className="flex flex-col items-center justify-center bg-slate-800/50 rounded-2xl border border-white/5">
                                <Loader2 className="h-8 w-8 text-indigo-400 animate-spin mb-3" />
                                <p className="text-sm text-slate-400">
                                    {callState === 'ringing' ? 'En attente de réponse...' : 'Connexion en cours...'}
                                </p>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Audio-only call UI */
                    <div className="flex flex-col items-center gap-6">
                        {/* Remote user avatar(s) */}
                        {participants.length > 0 ? (
                            <div className="flex flex-wrap gap-4 justify-center">
                                {participants.map((p) => (
                                    <motion.div
                                        key={p.id}
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="flex flex-col items-center gap-2"
                                    >
                                        <div className="relative">
                                            <motion.div
                                                animate={callState === 'connected' ? {
                                                    boxShadow: ['0 0 0 0 rgba(99,102,241,0)', '0 0 0 20px rgba(99,102,241,0.3)', '0 0 0 0 rgba(99,102,241,0)']
                                                } : {}}
                                                transition={{ repeat: Infinity, duration: 2 }}
                                                className="rounded-full"
                                            >
                                                <Avatar className="h-24 w-24 border-2 border-indigo-500/50">
                                                    <AvatarImage src={p.avatar || undefined} />
                                                    <AvatarFallback className="bg-indigo-600/30 text-indigo-300 text-2xl">
                                                        {getInitials(p.name)}
                                                    </AvatarFallback>
                                                </Avatar>
                                            </motion.div>
                                            {callState === 'connected' && (
                                                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-900" />
                                            )}
                                        </div>
                                        <p className="text-sm font-medium text-white">{p.name}</p>
                                    </motion.div>
                                ))}
                            </div>
                        ) : (
                            <motion.div
                                animate={callState === 'ringing' ? { scale: [1, 1.1, 1] } : {}}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className="flex flex-col items-center"
                            >
                                <Avatar className="h-32 w-32 border-4 border-indigo-500/30 shadow-2xl shadow-indigo-500/20">
                                    <AvatarImage src={remoteUser?.avatar || undefined} />
                                    <AvatarFallback className="bg-indigo-600/30 text-indigo-300 text-4xl">
                                        {remoteUser ? getInitials(remoteUser.name) : <Users className="h-12 w-12" />}
                                    </AvatarFallback>
                                </Avatar>
                                <p className="text-lg font-bold text-white mt-4">
                                    {remoteUser?.name || groupName || 'Appel'}
                                </p>
                            </motion.div>
                        )}

                        {/* Audio wave animation when connected */}
                        {callState === 'connected' && (
                            <div className="flex items-center gap-1">
                                {[...Array(5)].map((_, i) => (
                                    <motion.div
                                        key={i}
                                        animate={{ height: [8, 24, 8] }}
                                        transition={{ repeat: Infinity, duration: 1, delay: i * 0.15 }}
                                        className="w-1 bg-indigo-500 rounded-full"
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Participants count */}
            {participants.length > 0 && (
                <div className="text-center py-2">
                    <p className="text-xs text-slate-400">
                        <Users className="h-3 w-3 inline mr-1" />
                        {participants.length + 1} participant{participants.length > 0 ? 's' : ''}
                    </p>
                </div>
            )}

            {/* Call Controls */}
            <div className="px-6 pb-12 pt-4">
                <div className="flex items-center justify-center gap-4">
                    {/* Mute */}
                    <Button
                        variant="ghost"
                        onClick={toggleMute}
                        className={cn(
                            "h-14 w-14 rounded-full border-2 transition-all",
                            isMuted
                                ? "bg-red-500/20 border-red-500/50 text-red-400"
                                : "bg-white/10 border-white/20 text-white hover:bg-white/20"
                        )}
                    >
                        {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                    </Button>

                    {/* Video toggle (only for video calls) */}
                    {callType === 'video' && (
                        <Button
                            variant="ghost"
                            onClick={toggleVideo}
                            className={cn(
                                "h-14 w-14 rounded-full border-2 transition-all",
                                !isVideoEnabled
                                    ? "bg-red-500/20 border-red-500/50 text-red-400"
                                    : "bg-white/10 border-white/20 text-white hover:bg-white/20"
                            )}
                        >
                            {isVideoEnabled ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
                        </Button>
                    )}

                    {/* End Call */}
                    <Button
                        onClick={endCall}
                        className="h-16 w-16 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30"
                    >
                        <PhoneOff className="h-7 w-7" />
                    </Button>
                </div>
            </div>
        </motion.div>
    );
}
