'use client';

/**
 * VoiceSalon – Salon vocal temps réel style Discord
 * ══════════════════════════════════════════════════
 * • Entrée/sortie libre du salon
 * • Push-to-Talk (PTT) ou micro ouvert (toggle)
 * • WebRTC mesh audio (jusqu'à 8 pairs via Supabase Realtime signaling)
 * • Présence en temps réel : liste des membres + indicateur "en train de parler"
 * • Notification push quand le premier membre rejoint (via Supabase broadcast)
 * • Compatible Chrome, Firefox, Edge, Brave, Opera, Safari
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Mic, MicOff, PhoneOff, Volume2, VolumeX,
    Radio, Users, Loader2, LogIn
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── ICE servers (STUN + TURN public gratuit) ──────────────────────────────
const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        {
            urls: 'turn:a.relay.metered.ca:80',
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

// ── Types ─────────────────────────────────────────────────────────────────
interface SalonMember {
    id: string;
    user_id: string;
    is_speaking: boolean;
    is_muted: boolean;
    joined_at: string;
    profile?: { full_name: string | null; avatar_url: string | null };
}

interface VoiceSalonProps {
    groupId: string;
    groupName: string;
    user: { id: string; name: string; avatar?: string };
    /** Called when the user closes the salon panel */
    onClose?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────
export function VoiceSalon({ groupId, groupName, user, onClose }: VoiceSalonProps) {
    // ── Salon state ──────────────────────────────────────────────────────
    const [salonId, setSalonId] = useState<string | null>(null);
    const [isJoined, setIsJoined] = useState(false);
    const [isJoining, setIsJoining] = useState(false);
    const [members, setMembers] = useState<SalonMember[]>([]);

    // ── Audio state ──────────────────────────────────────────────────────
    const [isMuted, setIsMuted] = useState(true);          // start muted
    const [isPTTMode, setIsPTTMode] = useState(true);      // PTT vs open mic
    const [isPTTActive, setIsPTTActive] = useState(false); // PTT button held
    const [isSpeaking, setIsSpeaking] = useState(false);   // VAD result

    // ── WebRTC ───────────────────────────────────────────────────────────
    const localStreamRef = useRef<MediaStream | null>(null);
    const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    const remoteAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
    const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
    const channelRef = useRef<any>(null);
    const presenceChannelRef = useRef<any>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const vadIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const mountedRef = useRef(true);

    // ──────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────
    const getInitials = (name: string | null) =>
        (name || 'U').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

    // ── Ensure salon row exists ──────────────────────────────────────────
    const getOrCreateSalon = useCallback(async (): Promise<string | null> => {
        // Try to find existing salon for group
        const { data: existing } = await supabase
            .from('salons')
            .select('id')
            .eq('group_id', groupId)
            .maybeSingle();

        if (existing?.id) return existing.id;

        // Create it
        const { data: created, error } = await supabase
            .from('salons')
            .insert({ group_id: groupId, name: `Salon – ${groupName}` })
            .select('id')
            .single();

        if (error) {
            console.error('[VoiceSalon] Cannot create salon:', error);
            return null;
        }
        return created.id;
    }, [groupId, groupName]);

    // ── Load members with profiles ───────────────────────────────────────
    const loadMembers = useCallback(async (sid: string) => {
        const { data } = await supabase
            .from('salon_membres_actifs')
            .select('*, profile:profiles(full_name, avatar_url)')
            .eq('salon_id', sid)
            .order('joined_at');

        if (data && mountedRef.current) setMembers(data as SalonMember[]);
    }, []);

    // ── Get user media (audio only, Opus codec preferred) ────────────────
    const getUserMedia = useCallback(async (): Promise<MediaStream | null> => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: { ideal: 48000 },
                    channelCount: { ideal: 1 },
                },
                video: false,
            });
            // Start muted
            stream.getAudioTracks().forEach((t) => (t.enabled = false));
            localStreamRef.current = stream;
            setupVAD(stream);
            return stream;
        } catch (err) {
            toast.error('Impossible d\'accéder au micro. Vérifiez les permissions.');
            return null;
        }
    }, []);

    // ── Voice Activity Detection (for speaking indicator even in PTT) ─────
    const setupVAD = (stream: MediaStream) => {
        try {
            const ctx = new AudioContext();
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 512;
            analyser.smoothingTimeConstant = 0.4;
            source.connect(analyser);
            analyserRef.current = analyser;

            const buf = new Uint8Array(analyser.fftSize);
            vadIntervalRef.current = setInterval(() => {
                if (!analyserRef.current) return;
                analyserRef.current.getByteTimeDomainData(buf);
                const rms = Math.sqrt(buf.reduce((sum, v) => sum + (v - 128) ** 2, 0) / buf.length);
                const speaking = rms > 10;
                setIsSpeaking(prev => {
                    if (prev !== speaking) return speaking;
                    return prev;
                });
            }, 100);
        } catch { /* ignore */ }
    };

    // ── Create WebRTC peer connection ────────────────────────────────────
    const createPC = useCallback((peerId: string): RTCPeerConnection => {
        const existing = peerConnectionsRef.current.get(peerId);
        if (existing) { existing.close(); peerConnectionsRef.current.delete(peerId); }

        const pc = new RTCPeerConnection(ICE_SERVERS);

        // Add local tracks
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((t) =>
                pc.addTrack(t, localStreamRef.current!)
            );
        }

        // ICE candidate
        pc.onicecandidate = ({ candidate }) => {
            if (candidate && channelRef.current) {
                channelRef.current.send({
                    type: 'broadcast',
                    event: 'salon-ice',
                    payload: { from: user.id, to: peerId, candidate: candidate.toJSON() },
                });
            }
        };

        // Remote audio
        pc.ontrack = ({ streams }) => {
            const stream = streams[0];
            if (!stream) return;
            let audio = remoteAudioRefs.current.get(peerId);
            if (!audio) {
                audio = new Audio();
                audio.autoplay = true;
                remoteAudioRefs.current.set(peerId, audio);
            }
            audio.srcObject = stream;
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'failed') pc.restartIce();
        };

        peerConnectionsRef.current.set(peerId, pc);
        return pc;
    }, [user.id]);

    // ── Flush pending ICE candidates ─────────────────────────────────────
    const flushPending = useCallback(async (peerId: string) => {
        const pc = peerConnectionsRef.current.get(peerId);
        const pending = pendingCandidatesRef.current.get(peerId) || [];
        for (const c of pending) {
            try { await pc?.addIceCandidate(new RTCIceCandidate(c)); } catch { }
        }
        pendingCandidatesRef.current.set(peerId, []);
    }, []);

    // ── Join salon ───────────────────────────────────────────────────────
    const joinSalon = useCallback(async () => {
        if (!user || isJoining || isJoined) return;
        setIsJoining(true);

        const sid = await getOrCreateSalon();
        if (!sid) { setIsJoining(false); return; }
        setSalonId(sid);

        const stream = await getUserMedia();
        if (!stream) { setIsJoining(false); return; }

        // Upsert presence
        await supabase.from('salon_membres_actifs').upsert({
            salon_id: sid,
            user_id: user.id,
            is_speaking: false,
            is_muted: true,
        }, { onConflict: 'salon_id,user_id' });

        // Load current members
        await loadMembers(sid);

        // ── Supabase Realtime channel for WebRTC signaling ───────────────
        const chanName = `voice_salon_${sid}`;
        const channel = supabase.channel(chanName, {
            config: { broadcast: { self: false } },
        });

        // Offer from existing member
        channel.on('broadcast', { event: 'salon-offer' }, async ({ payload }) => {
            if (!mountedRef.current || payload.to !== user.id) return;
            const pc = createPC(payload.from);
            await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
            await flushPending(payload.from);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            channel.send({ type: 'broadcast', event: 'salon-answer', payload: { from: user.id, to: payload.from, answer } });
        });

        // Answer from joining member
        channel.on('broadcast', { event: 'salon-answer' }, async ({ payload }) => {
            if (!mountedRef.current || payload.to !== user.id) return;
            const pc = peerConnectionsRef.current.get(payload.from);
            if (pc?.signalingState === 'have-local-offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
                await flushPending(payload.from);
            }
        });

        // ICE
        channel.on('broadcast', { event: 'salon-ice' }, async ({ payload }) => {
            if (!mountedRef.current || payload.to !== user.id) return;
            const pc = peerConnectionsRef.current.get(payload.from);
            if (pc?.remoteDescription) {
                try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch { }
            } else {
                const q = pendingCandidatesRef.current.get(payload.from) || [];
                q.push(payload.candidate);
                pendingCandidatesRef.current.set(payload.from, q);
            }
        });

        // New member joined → existing member sends offer
        channel.on('broadcast', { event: 'salon-join' }, async ({ payload }) => {
            if (!mountedRef.current || payload.from === user.id) return;
            setTimeout(async () => {
                const pc = createPC(payload.from);
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                channel.send({ type: 'broadcast', event: 'salon-offer', payload: { from: user.id, to: payload.from, offer } });
            }, 400);
        });

        // Speaking state broadcast
        channel.on('broadcast', { event: 'salon-speaking' }, ({ payload }) => {
            if (!mountedRef.current) return;
            setMembers((prev) =>
                prev.map((m) =>
                    m.user_id === payload.userId ? { ...m, is_speaking: payload.isSpeaking, is_muted: payload.isMuted } : m
                )
            );
        });

        // Member left
        channel.on('broadcast', { event: 'salon-leave' }, ({ payload }) => {
            if (!mountedRef.current) return;
            setMembers((prev) => prev.filter((m) => m.user_id !== payload.userId));
            const pc = peerConnectionsRef.current.get(payload.userId);
            if (pc) { pc.close(); peerConnectionsRef.current.delete(payload.userId); }
        });

        await channel.subscribe();
        channelRef.current = channel;

        // Announce join
        await new Promise((r) => setTimeout(r, 300));
        channel.send({ type: 'broadcast', event: 'salon-join', payload: { from: user.id, name: user.name } });

        // ── Supabase Realtime POSTGRES changes for presence ───────────────
        const presenceChan = supabase
            .channel(`salon_presence_${sid}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'salon_membres_actifs',
                filter: `salon_id=eq.${sid}`,
            }, () => loadMembers(sid))
            .subscribe();
        presenceChannelRef.current = presenceChan;

        setIsJoined(true);
        setIsJoining(false);
        toast.success('🎙️ Vous avez rejoint le salon vocal');
    }, [user, isJoining, isJoined, getOrCreateSalon, getUserMedia, loadMembers, createPC, flushPending]);

    // ── Leave salon ──────────────────────────────────────────────────────
    const leaveSalon = useCallback(async () => {
        if (!isJoined || !salonId) return;

        // Broadcast leave
        channelRef.current?.send({
            type: 'broadcast',
            event: 'salon-leave',
            payload: { userId: user.id },
        });

        // Cleanup WebRTC
        peerConnectionsRef.current.forEach((pc) => pc.close());
        peerConnectionsRef.current.clear();
        remoteAudioRefs.current.forEach((a) => { a.srcObject = null; });
        remoteAudioRefs.current.clear();

        // Stop local audio
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;

        // Stop VAD
        if (vadIntervalRef.current) clearInterval(vadIntervalRef.current);
        analyserRef.current = null;

        // Remove from DB
        await supabase
            .from('salon_membres_actifs')
            .delete()
            .eq('salon_id', salonId)
            .eq('user_id', user.id);

        // Unsubscribe channels
        if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
        if (presenceChannelRef.current) { supabase.removeChannel(presenceChannelRef.current); presenceChannelRef.current = null; }

        setIsJoined(false);
        setIsMuted(true);
        setIsPTTActive(false);
        setIsSpeaking(false);
        setMembers([]);
        setSalonId(null);
        toast.info('Vous avez quitté le salon vocal');
    }, [isJoined, salonId, user.id]);

    // ── Toggle mute / update speaking state ──────────────────────────────
    const setAudioEnabled = useCallback((enabled: boolean) => {
        if (!localStreamRef.current) return;
        localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = enabled));
        const muted = !enabled;
        setIsMuted(muted);

        // Broadcast speaking state
        if (channelRef.current) {
            channelRef.current.send({
                type: 'broadcast',
                event: 'salon-speaking',
                payload: { userId: user.id, isSpeaking: enabled && isSpeaking, isMuted: muted },
            });
        }

        // Update DB speaking state
        if (salonId) {
            supabase.from('salon_membres_actifs')
                .update({ is_speaking: enabled && isSpeaking, is_muted: muted })
                .eq('salon_id', salonId)
                .eq('user_id', user.id)
                .then(() => { });
        }
    }, [user.id, salonId, isSpeaking]);

    // ── PTT handlers ─────────────────────────────────────────────────────
    const startPTT = useCallback(() => {
        if (!isPTTMode || !isJoined) return;
        setIsPTTActive(true);
        setAudioEnabled(true);
    }, [isPTTMode, isJoined, setAudioEnabled]);

    const stopPTT = useCallback(() => {
        if (!isPTTMode || !isJoined) return;
        setIsPTTActive(false);
        setAudioEnabled(false);
    }, [isPTTMode, isJoined, setAudioEnabled]);

    // ── Toggle open mic ──────────────────────────────────────────────────
    const toggleOpenMic = useCallback(() => {
        const newMuted = !isMuted;
        setAudioEnabled(!newMuted);
    }, [isMuted, setAudioEnabled]);

    // ── Cleanup on unmount ───────────────────────────────────────────────
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            // Don't auto-leave on unmount (user must press Leave)
        };
    }, []);

    // ── Load initial members when joined ─────────────────────────────────
    useEffect(() => {
        if (!salonId) {
            // Load count for preview (not joined)
            (async () => {
                const sid = await getOrCreateSalon();
                if (sid && mountedRef.current) {
                    setSalonId(sid);
                    loadMembers(sid);
                }
            })();
        }
    }, [groupId]); // only on group change

    // ── Broadcast speaking state changes ─────────────────────────────────
    useEffect(() => {
        if (!isJoined || !channelRef.current || !salonId) return;
        channelRef.current.send({
            type: 'broadcast',
            event: 'salon-speaking',
            payload: { userId: user.id, isSpeaking: isSpeaking && !isMuted, isMuted },
        });
        supabase.from('salon_membres_actifs')
            .update({ is_speaking: isSpeaking && !isMuted, is_muted: isMuted })
            .eq('salon_id', salonId)
            .eq('user_id', user.id)
            .then(() => { });
    }, [isSpeaking, isMuted]);

    // ─────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────
    const activeMemberCount = members.length;
    const speakingMembers = members.filter((m) => m.is_speaking);

    return (
        <div className="flex flex-col h-full bg-linear-to-b from-slate-900 to-slate-950 rounded-2xl overflow-hidden border border-white/10">

            {/* ── Header ── */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-900/80 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Radio className="h-5 w-5 text-green-400" />
                        {activeMemberCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-slate-900 animate-pulse" />
                        )}
                    </div>
                    <div>
                        <p className="font-bold text-white text-sm">Salon vocal</p>
                        <p className="text-[10px] text-slate-400">{groupName}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge className={cn(
                        "text-[10px] font-bold",
                        activeMemberCount > 0 ? "bg-green-500/20 text-green-400" : "bg-slate-600/20 text-slate-500"
                    )}>
                        <Users className="h-3 w-3 mr-1" />
                        {activeMemberCount} membre{activeMemberCount !== 1 ? 's' : ''}
                    </Badge>
                    {onClose && (
                        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors text-lg leading-none">×</button>
                    )}
                </div>
            </div>

            {/* ── Members Grid ── */}
            <div className="flex-1 p-4 overflow-y-auto">
                {activeMemberCount === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-8">
                        <motion.div
                            animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                        >
                            <Radio className="h-14 w-14 text-slate-600" />
                        </motion.div>
                        <p className="text-slate-500 text-sm font-medium">Salon calme</p>
                        <p className="text-slate-600 text-xs">Rejoignez le salon pour commencer</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                        <AnimatePresence>
                            {members.map((member) => {
                                const isCurrentUser = member.user_id === user.id;
                                const speaking = member.is_speaking && !member.is_muted;
                                return (
                                    <motion.div
                                        key={member.user_id}
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.8 }}
                                        className="flex flex-col items-center gap-2"
                                    >
                                        {/* Avatar with speaking ring */}
                                        <div className="relative">
                                            {/* Animated speaking ring */}
                                            {speaking && (
                                                <>
                                                    <motion.div
                                                        animate={{ scale: [1, 1.35], opacity: [0.6, 0] }}
                                                        transition={{ repeat: Infinity, duration: 1 }}
                                                        className="absolute inset-0 rounded-full bg-green-400"
                                                    />
                                                    <motion.div
                                                        animate={{ scale: [1, 1.6], opacity: [0.3, 0] }}
                                                        transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                                                        className="absolute inset-0 rounded-full bg-green-400"
                                                    />
                                                </>
                                            )}
                                            <Avatar className={cn(
                                                "h-14 w-14 border-2 relative transition-all duration-200",
                                                speaking ? "border-green-400 shadow-lg shadow-green-500/30" : "border-white/10",
                                                isCurrentUser && "ring-1 ring-indigo-500 ring-offset-1 ring-offset-slate-900"
                                            )}>
                                                <AvatarImage src={member.profile?.avatar_url || undefined} />
                                                <AvatarFallback className={cn(
                                                    "text-sm font-bold",
                                                    speaking ? "bg-green-600/20 text-green-300" : "bg-slate-700 text-slate-300"
                                                )}>
                                                    {getInitials(member.profile?.full_name || null)}
                                                </AvatarFallback>
                                            </Avatar>
                                            {/* Muted icon */}
                                            {member.is_muted && (
                                                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-red-500/90 border-2 border-slate-900 flex items-center justify-center">
                                                    <MicOff className="h-2.5 w-2.5 text-white" />
                                                </div>
                                            )}
                                        </div>
                                        <p className={cn(
                                            "text-[10px] font-medium truncate max-w-[64px] text-center",
                                            isCurrentUser ? "text-indigo-400" : "text-slate-300"
                                        )}>
                                            {isCurrentUser ? 'Vous' : (member.profile?.full_name || 'Membre')}
                                        </p>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                )}

                {/* Speaking indicator bar */}
                <AnimatePresence>
                    {speakingMembers.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 8 }}
                            className="mt-3 px-3 py-2 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-2"
                        >
                            <div className="flex gap-0.5 items-center">
                                {[...Array(4)].map((_, i) => (
                                    <motion.div
                                        key={i}
                                        animate={{ height: [4, 14, 4] }}
                                        transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.1 }}
                                        className="w-0.5 bg-green-400 rounded-full"
                                    />
                                ))}
                            </div>
                            <p className="text-xs text-green-300 font-medium">
                                {speakingMembers.map((m) =>
                                    m.user_id === user.id ? 'Vous' : (m.profile?.full_name || 'Membre')
                                ).join(', ')} parle…
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── Controls ── */}
            <div className="px-4 pb-4 pt-3 border-t border-white/10 bg-slate-900/60 space-y-3">
                {!isJoined ? (
                    /* ── Join Button ── */
                    <Button
                        onClick={joinSalon}
                        disabled={isJoining}
                        className="w-full h-12 rounded-xl bg-linear-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold text-sm gap-2 shadow-lg shadow-green-500/20"
                    >
                        {isJoining ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <LogIn className="h-5 w-5" />
                        )}
                        Rejoindre le salon vocal
                    </Button>
                ) : (
                    <>
                        {/* ── PTT / Open Mic Toggle ── */}
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400 font-medium">Mode audio</span>
                            <button
                                onClick={() => {
                                    const newPTT = !isPTTMode;
                                    setIsPTTMode(newPTT);
                                    if (!newPTT) {
                                        // Switching to open mic
                                        setAudioEnabled(!isMuted);
                                    } else {
                                        // Switching to PTT → mute
                                        setAudioEnabled(false);
                                        setIsPTTActive(false);
                                    }
                                }}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all border",
                                    isPTTMode
                                        ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                                        : "bg-green-500/20 text-green-300 border-green-500/30"
                                )}
                            >
                                {isPTTMode ? (
                                    <><Volume2 className="h-3 w-3" /> Push-to-Talk</>
                                ) : (
                                    <><Mic className="h-3 w-3" /> Micro ouvert</>
                                )}
                            </button>
                        </div>

                        {/* ── Main Audio Control ── */}
                        {isPTTMode ? (
                            /* PTT Button (hold to speak) */
                            <motion.button
                                onPointerDown={startPTT}
                                onPointerUp={stopPTT}
                                onPointerLeave={stopPTT}
                                whileTap={{ scale: 0.95 }}
                                className={cn(
                                    "w-full h-14 rounded-xl font-bold text-sm transition-all duration-150 select-none touch-none",
                                    "flex items-center justify-center gap-2 border-2",
                                    isPTTActive
                                        ? "bg-green-500 border-green-400 text-white shadow-lg shadow-green-500/40"
                                        : "bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-500"
                                )}
                                style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                            >
                                <motion.div
                                    animate={isPTTActive ? {
                                        scale: [1, 1.2, 1],
                                        opacity: [1, 0.7, 1],
                                    } : {}}
                                    transition={{ repeat: Infinity, duration: 0.5 }}
                                >
                                    {isPTTActive ? (
                                        <Mic className="h-6 w-6" />
                                    ) : (
                                        <MicOff className="h-6 w-6 opacity-50" />
                                    )}
                                </motion.div>
                                <span>
                                    {isPTTActive ? (
                                        '🔴 En train de parler…'
                                    ) : (
                                        'Maintenir pour parler'
                                    )}
                                </span>
                            </motion.button>
                        ) : (
                            /* Open Mic Toggle */
                            <button
                                onClick={toggleOpenMic}
                                className={cn(
                                    "w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border transition-all",
                                    isMuted
                                        ? "bg-red-500/15 border-red-500/40 text-red-400 hover:bg-red-500/20"
                                        : "bg-green-500/15 border-green-500/40 text-green-400 hover:bg-green-500/20"
                                )}
                            >
                                {isMuted ? (
                                    <><MicOff className="h-5 w-5" /> Micro coupé (cliquer pour activer)</>
                                ) : (
                                    <><Mic className="h-5 w-5" /> Micro actif (cliquer pour couper)</>
                                )}
                            </button>
                        )}

                        {/* ── Leave Button ── */}
                        <Button
                            onClick={leaveSalon}
                            variant="ghost"
                            className="w-full h-10 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 font-bold text-sm gap-2"
                        >
                            <PhoneOff className="h-4 w-4" />
                            Quitter le salon
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}
