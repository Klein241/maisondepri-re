'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Video, Phone, Calendar, Clock, Users, Plus, X, Loader2,
    ExternalLink, Copy, Check, CalendarDays, Bell, ChevronRight,
    ArrowLeft, Settings, Link2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { initiateCall } from './call-system';

// Google API configuration
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar';

interface GroupCallManagerProps {
    user: { id: string; name: string; avatar?: string } | null;
    groupId: string;
    groupName: string;
    groupMembers?: Array<{ id: string; full_name: string; avatar_url?: string | null }>;
    onStartCall?: (type: 'audio' | 'video') => void;
}

interface ScheduledCall {
    id: string;
    title: string;
    description: string | null;
    meet_link: string;
    calendar_event_id: string | null;
    scheduled_at: string;
    duration_minutes: number;
    created_by: string;
    creator_name?: string;
    group_id: string;
    status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
    created_at: string;
}

export function GroupCallManager({ user, groupId, groupName, groupMembers, onStartCall }: GroupCallManagerProps) {
    const [view, setView] = useState<'main' | 'schedule' | 'history'>('main');
    const [scheduledCalls, setScheduledCalls] = useState<ScheduledCall[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
    const [isGoogleAuthed, setIsGoogleAuthed] = useState(false);

    // Schedule form state
    const [scheduleTitle, setScheduleTitle] = useState('');
    const [scheduleDescription, setScheduleDescription] = useState('');
    const [scheduleDate, setScheduleDate] = useState('');
    const [scheduleTime, setScheduleTime] = useState('');
    const [scheduleDuration, setScheduleDuration] = useState(60);

    // Load scheduled calls
    useEffect(() => {
        loadScheduledCalls();

        // Subscribe to changes
        const channel = supabase
            .channel(`group_calls_${groupId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'group_calls',
                filter: `group_id=eq.${groupId}`
            }, () => {
                loadScheduledCalls();
            })
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [groupId]);

    // Initialize Google API
    useEffect(() => {
        if (!GOOGLE_CLIENT_ID || !GOOGLE_API_KEY) {
            console.log('Google API credentials not configured - using direct Meet links');
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = () => {
            (window as any).gapi.load('client:auth2', async () => {
                try {
                    await (window as any).gapi.client.init({
                        apiKey: GOOGLE_API_KEY,
                        clientId: GOOGLE_CLIENT_ID,
                        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
                        scope: SCOPES,
                    });
                    setIsGoogleLoaded(true);

                    const authInstance = (window as any).gapi.auth2.getAuthInstance();
                    setIsGoogleAuthed(authInstance?.isSignedIn.get() || false);
                } catch (e) {
                    console.error('Google API init error:', e);
                }
            });
        };
        document.body.appendChild(script);

        return () => {
            document.body.removeChild(script);
        };
    }, []);

    const loadScheduledCalls = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('group_calls')
                .select(`
                    *,
                    profiles:created_by (full_name)
                `)
                .eq('group_id', groupId)
                .in('status', ['scheduled', 'in_progress'])
                .order('scheduled_at', { ascending: true });

            if (error) {
                // Table might not exist yet - create it
                if (error.message.includes('does not exist') || error.code === '42P01') {
                    console.log('group_calls table does not exist yet');
                    setScheduledCalls([]);
                } else {
                    throw error;
                }
            } else {
                setScheduledCalls((data || []).map((d: any) => ({
                    ...d,
                    creator_name: d.profiles?.full_name || 'Inconnu'
                })));
            }
        } catch (e) {
            console.error('Error loading scheduled calls:', e);
        }
        setIsLoading(false);
    };

    const signInWithGoogle = async () => {
        if (!isGoogleLoaded) {
            toast.error('Google API non chargée. Vérifiez votre connexion.');
            return;
        }
        try {
            const authInstance = (window as any).gapi.auth2.getAuthInstance();
            await authInstance.signIn();
            setIsGoogleAuthed(true);
            toast.success('Connecté à Google !');
        } catch (e) {
            console.error('Google sign in error:', e);
            toast.error('Erreur de connexion Google');
        }
    };

    // Create an instant meeting using WebRTC
    const createInstantMeeting = async () => {
        if (!user) return;
        setIsCreating(true);

        try {
            // Save to Supabase for history
            const { error } = await supabase
                .from('group_calls')
                .insert({
                    group_id: groupId,
                    title: `🙏 Appel de prière - ${groupName}`,
                    meet_link: 'webrtc',
                    scheduled_at: new Date().toISOString(),
                    duration_minutes: 60,
                    created_by: user.id,
                    status: 'in_progress'
                });

            if (error) {
                if (error.message.includes('does not exist') || error.code === '42P01') {
                    // Table doesn't exist yet — still allow the call
                    console.warn('group_calls table not found, proceeding anyway');
                } else {
                    console.error('Error saving call:', error);
                }
            } else {
                loadScheduledCalls();
            }

            // Signal all group members via broadcast
            if (groupMembers && groupMembers.length > 0) {
                for (const member of groupMembers) {
                    if (member.id === user.id) continue;
                    await initiateCall({
                        callerId: user.id,
                        callerName: user.name || 'Utilisateur',
                        callerAvatar: user.avatar,
                        receiverId: member.id,
                        callType: 'video',
                        groupId,
                        groupName,
                    });
                }
            }

            // Trigger WebRTC call UI
            if (onStartCall) {
                onStartCall('video');
            }
            toast.success('📹 Appel de groupe démarré !');
        } catch (e) {
            console.error('Error creating instant meeting:', e);
            toast.error('Erreur lors de la création de l\'appel');
        }
        setIsCreating(false);
    };

    // Schedule a future meeting
    const scheduleCall = async () => {
        if (!user || !scheduleTitle.trim() || !scheduleDate || !scheduleTime) {
            toast.error('Veuillez remplir tous les champs requis');
            return;
        }

        setIsCreating(true);

        try {
            const scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
            const endDateTime = new Date(scheduledDateTime.getTime() + scheduleDuration * 60 * 1000);
            let meetLink = '';
            let calendarEventId = null;

            // Try to create Google Calendar event if authenticated
            if (isGoogleAuthed && isGoogleLoaded) {
                try {
                    const event = {
                        summary: scheduleTitle,
                        description: scheduleDescription || `Appel de prière planifié pour ${groupName}`,
                        start: {
                            dateTime: scheduledDateTime.toISOString(),
                            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                        },
                        end: {
                            dateTime: endDateTime.toISOString(),
                            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                        },
                        conferenceData: {
                            createRequest: {
                                requestId: `prayer-scheduled-${Date.now()}`,
                                conferenceSolutionKey: { type: 'hangoutsMeet' }
                            }
                        },
                        reminders: {
                            useDefault: false,
                            overrides: [
                                { method: 'popup', minutes: 30 },
                                { method: 'popup', minutes: 10 },
                            ]
                        }
                    };

                    const response = await (window as any).gapi.client.calendar.events.insert({
                        calendarId: 'primary',
                        resource: event,
                        conferenceDataVersion: 1,
                    });

                    meetLink = response.result.hangoutLink || response.result.conferenceData?.entryPoints?.[0]?.uri || '';
                    calendarEventId = response.result.id;
                } catch (e) {
                    console.error('Google Calendar API error:', e);
                    meetLink = 'webrtc';
                }
            } else {
                meetLink = 'webrtc';
            }

            // Save to Supabase
            const { error } = await supabase
                .from('group_calls')
                .insert({
                    group_id: groupId,
                    title: scheduleTitle,
                    description: scheduleDescription || null,
                    meet_link: meetLink,
                    calendar_event_id: calendarEventId,
                    scheduled_at: scheduledDateTime.toISOString(),
                    duration_minutes: scheduleDuration,
                    created_by: user.id,
                    status: 'scheduled'
                });

            if (error) {
                if (error.message.includes('does not exist') || error.code === '42P01') {
                    toast.info('Créez la table group_calls dans Supabase pour activer cette fonctionnalité.');
                } else {
                    throw error;
                }
            } else {
                toast.success('Appel planifié avec succès !');
                setView('main');
                setScheduleTitle('');
                setScheduleDescription('');
                setScheduleDate('');
                setScheduleTime('');
                loadScheduledCalls();
            }
        } catch (e) {
            console.error('Error scheduling call:', e);
            toast.error('Erreur lors de la planification');
        }
        setIsCreating(false);
    };

    const copyMeetLink = (link: string) => {
        navigator.clipboard.writeText(link);
        setCopied(true);
        toast.success('Lien copié !');
        setTimeout(() => setCopied(false), 2000);
    };

    const joinCall = (_meetLink: string) => {
        // Instead of opening an external link, trigger the WebRTC call
        if (onStartCall) {
            onStartCall('video');
        }
    };

    const cancelCall = async (callId: string) => {
        try {
            const { error } = await supabase
                .from('group_calls')
                .update({ status: 'cancelled' })
                .eq('id', callId);

            if (error) throw error;
            toast.success('Appel annulé');
            loadScheduledCalls();
        } catch (e) {
            console.error('Error cancelling call:', e);
            toast.error('Erreur lors de l\'annulation');
        }
    };

    const formatDateTime = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('fr-FR', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const isCallNow = (call: ScheduledCall) => {
        const now = Date.now();
        const start = new Date(call.scheduled_at).getTime();
        const end = start + call.duration_minutes * 60 * 1000;
        return now >= start - 5 * 60 * 1000 && now <= end; // 5 min before to end
    };

    const getTimeUntil = (dateStr: string) => {
        const diff = new Date(dateStr).getTime() - Date.now();
        if (diff < 0) return 'Maintenant';
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        if (hours > 24) return `Dans ${Math.floor(hours / 24)} jour(s)`;
        if (hours > 0) return `Dans ${hours}h ${mins}min`;
        return `Dans ${mins} min`;
    };

    // ========== RENDER ==========

    // Schedule View
    if (view === 'schedule') {
        return (
            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col h-full bg-gradient-to-b from-slate-900 to-slate-950"
            >
                <div className="p-4 border-b border-white/10 flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => setView('main')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h3 className="font-bold text-white">Planifier un appel</h3>
                        <p className="text-xs text-slate-400">{groupName}</p>
                    </div>
                </div>

                <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4 max-w-lg mx-auto">
                        {/* Google Auth Banner */}
                        {!isGoogleAuthed && GOOGLE_CLIENT_ID && (
                            <Card className="bg-blue-500/10 border-blue-500/20 rounded-2xl">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                                            <Calendar className="h-5 w-5 text-blue-400" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-white">Connectez Google</p>
                                            <p className="text-xs text-slate-400">Pour créer automatiquement un événement Google Calendar & Meet</p>
                                        </div>
                                        <Button
                                            size="sm"
                                            className="bg-blue-600 hover:bg-blue-500 rounded-xl"
                                            onClick={signInWithGoogle}
                                        >
                                            Connecter
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {isGoogleAuthed && (
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                                <Check className="h-3 w-3 mr-1" /> Google connecté
                            </Badge>
                        )}

                        {/* Title */}
                        <div>
                            <label className="text-sm font-medium text-slate-300 mb-2 block">
                                Titre de l'appel *
                            </label>
                            <Input
                                value={scheduleTitle}
                                onChange={(e) => setScheduleTitle(e.target.value)}
                                placeholder="Ex: Prière du dimanche soir"
                                className="bg-white/5 border-white/10 rounded-xl"
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="text-sm font-medium text-slate-300 mb-2 block">
                                Description (optionnel)
                            </label>
                            <Input
                                value={scheduleDescription}
                                onChange={(e) => setScheduleDescription(e.target.value)}
                                placeholder="Sujet de l'appel..."
                                className="bg-white/5 border-white/10 rounded-xl"
                            />
                        </div>

                        {/* Date & Time */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-sm font-medium text-slate-300 mb-2 block">
                                    📅 Date *
                                </label>
                                <Input
                                    type="date"
                                    value={scheduleDate}
                                    onChange={(e) => setScheduleDate(e.target.value)}
                                    min={new Date().toISOString().split('T')[0]}
                                    className="bg-white/5 border-white/10 rounded-xl"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-300 mb-2 block">
                                    ⏰ Heure *
                                </label>
                                <Input
                                    type="time"
                                    value={scheduleTime}
                                    onChange={(e) => setScheduleTime(e.target.value)}
                                    className="bg-white/5 border-white/10 rounded-xl"
                                />
                            </div>
                        </div>

                        {/* Duration */}
                        <div>
                            <label className="text-sm font-medium text-slate-300 mb-2 block">
                                Durée
                            </label>
                            <div className="flex gap-2">
                                {[30, 60, 90, 120].map(d => (
                                    <Button
                                        key={d}
                                        variant="ghost"
                                        size="sm"
                                        className={cn(
                                            "rounded-xl border",
                                            scheduleDuration === d
                                                ? "bg-indigo-600 text-white border-indigo-500"
                                                : "bg-white/5 text-slate-400 border-white/10"
                                        )}
                                        onClick={() => setScheduleDuration(d)}
                                    >
                                        {d} min
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Submit button */}
                        <Button
                            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl h-12"
                            onClick={scheduleCall}
                            disabled={isCreating || !scheduleTitle || !scheduleDate || !scheduleTime}
                        >
                            {isCreating ? (
                                <>
                                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                    Création...
                                </>
                            ) : (
                                <>
                                    <Calendar className="h-5 w-5 mr-2" />
                                    Planifier l'appel
                                </>
                            )}
                        </Button>

                        <p className="text-xs text-slate-500 text-center">
                            {isGoogleAuthed
                                ? "Un événement Google Calendar avec lien Meet sera créé automatiquement"
                                : "Un lien Google Meet sera généré. Les participants pourront le rejoindre à l'heure prévue."}
                        </p>
                    </div>
                </ScrollArea>
            </motion.div>
        );
    }

    // Main View
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col h-full"
        >
            {/* Header */}
            <div className="p-4 space-y-4">
                {/* Quick Actions */}
                <div className="grid grid-cols-2 gap-3">
                    {/* Instant Call Button */}
                    <Button
                        className="h-20 rounded-2xl bg-gradient-to-br from-green-600/20 to-emerald-600/10 border border-green-500/20 hover:border-green-500/40 flex flex-col items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                        variant="ghost"
                        onClick={createInstantMeeting}
                        disabled={isCreating}
                    >
                        {isCreating ? (
                            <Loader2 className="h-6 w-6 text-green-400 animate-spin" />
                        ) : (
                            <Video className="h-6 w-6 text-green-400" />
                        )}
                        <span className="text-sm font-bold text-white">Appel instantané</span>
                    </Button>

                    {/* Schedule Call Button */}
                    <Button
                        className="h-20 rounded-2xl bg-gradient-to-br from-indigo-600/20 to-purple-600/10 border border-indigo-500/20 hover:border-indigo-500/40 flex flex-col items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                        variant="ghost"
                        onClick={() => setView('schedule')}
                    >
                        <CalendarDays className="h-6 w-6 text-indigo-400" />
                        <span className="text-sm font-bold text-white">Planifier</span>
                    </Button>
                </div>
            </div>

            {/* Scheduled Calls List */}
            <div className="flex-1 px-4">
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">
                        Appels programmés
                    </h4>
                    {scheduledCalls.length > 0 && (
                        <Badge className="bg-indigo-500/20 text-indigo-400 border-none text-xs">
                            {scheduledCalls.length}
                        </Badge>
                    )}
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                    </div>
                ) : scheduledCalls.length === 0 ? (
                    <Card className="bg-white/5 border-white/5 rounded-2xl">
                        <CardContent className="flex flex-col items-center py-8 text-center">
                            <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center mb-4">
                                <Phone className="h-8 w-8 text-indigo-400/50" />
                            </div>
                            <p className="text-slate-400 font-medium">Aucun appel programmé</p>
                            <p className="text-xs text-slate-500 mt-1">
                                Créez un appel instantané ou planifiez-en un
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3 pb-4">
                        {scheduledCalls.map((call) => (
                            <Card
                                key={call.id}
                                className={cn(
                                    "rounded-2xl border overflow-hidden transition-all",
                                    call.status === 'in_progress'
                                        ? "bg-green-500/10 border-green-500/20 animate-pulse"
                                        : isCallNow(call)
                                            ? "bg-indigo-500/10 border-indigo-500/20"
                                            : "bg-white/5 border-white/5"
                                )}
                            >
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                {call.status === 'in_progress' && (
                                                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                                )}
                                                <h5 className="font-bold text-white text-sm">{call.title}</h5>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                                <Clock className="h-3 w-3" />
                                                <span>{formatDateTime(call.scheduled_at)}</span>
                                                <span>•</span>
                                                <span>{call.duration_minutes} min</span>
                                            </div>
                                            {call.description && (
                                                <p className="text-xs text-slate-500 mt-1">{call.description}</p>
                                            )}
                                        </div>
                                        <Badge
                                            className={cn(
                                                "text-xs border-none",
                                                call.status === 'in_progress'
                                                    ? "bg-green-500/20 text-green-400"
                                                    : "bg-indigo-500/20 text-indigo-400"
                                            )}
                                        >
                                            {call.status === 'in_progress' ? 'En cours' : getTimeUntil(call.scheduled_at)}
                                        </Badge>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Button
                                            size="sm"
                                            className={cn(
                                                "flex-1 rounded-xl h-9",
                                                call.status === 'in_progress' || isCallNow(call)
                                                    ? "bg-green-600 hover:bg-green-500"
                                                    : "bg-indigo-600 hover:bg-indigo-500"
                                            )}
                                            onClick={() => joinCall(call.meet_link)}
                                        >
                                            <Video className="h-4 w-4 mr-2" />
                                            {call.status === 'in_progress' ? 'Rejoindre' : 'Ouvrir Meet'}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9 rounded-xl bg-white/5"
                                            onClick={() => copyMeetLink(call.meet_link)}
                                        >
                                            {copied ? (
                                                <Check className="h-4 w-4 text-green-400" />
                                            ) : (
                                                <Copy className="h-4 w-4 text-slate-400" />
                                            )}
                                        </Button>
                                        {call.created_by === user?.id && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-9 w-9 rounded-xl bg-red-500/10 hover:bg-red-500/20"
                                                onClick={() => cancelCall(call.id)}
                                            >
                                                <X className="h-4 w-4 text-red-400" />
                                            </Button>
                                        )}
                                    </div>

                                    {call.creator_name && (
                                        <p className="text-[10px] text-slate-500 mt-2">
                                            Créé par {call.creator_name}
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Info Footer */}
            <div className="p-4 border-t border-white/5">
                <p className="text-[10px] text-slate-500 text-center">
                    Les appels utilisent Google Meet. Assurez-vous d'avoir un compte Google.
                </p>
            </div>
        </motion.div>
    );
}
