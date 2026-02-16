'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, PhoneIncoming, PhoneOutgoing, PhoneMissed, Video, Clock, Users, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface CallRecord {
    id: string;
    caller_id: string;
    receiver_id?: string;
    group_id?: string;
    call_type: 'audio' | 'video';
    mode: 'private' | 'group';
    status: 'completed' | 'missed' | 'rejected';
    duration_seconds: number;
    created_at: string;
    ended_at?: string;
    // Joined data
    caller_name?: string;
    caller_avatar?: string | null;
    receiver_name?: string;
    receiver_avatar?: string | null;
    group_name?: string;
}

interface CallHistoryProps {
    userId: string;
    userName: string;
    onBack: () => void;
    onCall?: (type: 'audio' | 'video', userId: string, userName: string, userAvatar?: string | null) => void;
}

export function CallHistory({ userId, userName, onBack, onCall }: CallHistoryProps) {
    const [calls, setCalls] = useState<CallRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'missed' | 'incoming' | 'outgoing'>('all');

    useEffect(() => {
        loadCallHistory();
    }, [userId]);

    const loadCallHistory = async () => {
        setIsLoading(true);
        try {
            // Try loading from call_history table
            const { data, error } = await supabase
                .from('call_history')
                .select('*')
                .or(`caller_id.eq.${userId},receiver_id.eq.${userId}`)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) {
                // Table might not exist - show empty state
                console.log('[CallHistory] Table may not exist:', error.message);
                setCalls([]);
                setIsLoading(false);
                return;
            }

            if (data && data.length > 0) {
                // Enrich with profile data
                const userIds = new Set<string>();
                data.forEach(c => {
                    if (c.caller_id) userIds.add(c.caller_id);
                    if (c.receiver_id) userIds.add(c.receiver_id);
                });

                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, full_name, avatar_url')
                    .in('id', Array.from(userIds));

                const profileMap = new Map((profiles || []).map(p => [p.id, p]));

                const enriched = data.map(c => ({
                    ...c,
                    caller_name: profileMap.get(c.caller_id)?.full_name || 'Utilisateur',
                    caller_avatar: profileMap.get(c.caller_id)?.avatar_url,
                    receiver_name: c.receiver_id ? profileMap.get(c.receiver_id)?.full_name || 'Utilisateur' : undefined,
                    receiver_avatar: c.receiver_id ? profileMap.get(c.receiver_id)?.avatar_url : undefined,
                }));

                setCalls(enriched);
            } else {
                setCalls([]);
            }
        } catch (e) {
            console.error('[CallHistory] Error:', e);
            setCalls([]);
        }
        setIsLoading(false);
    };

    const formatDuration = (seconds: number) => {
        if (!seconds || seconds === 0) return '--';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        if (m === 0) return `${s}s`;
        return `${m}min ${s}s`;
    };

    const getCallIcon = (call: CallRecord) => {
        const isOutgoing = call.caller_id === userId;
        if (call.status === 'missed') {
            return <PhoneMissed className="h-4 w-4 text-red-400" />;
        }
        if (call.status === 'rejected') {
            return <PhoneOff className="h-4 w-4 text-orange-400" />;
        }
        if (isOutgoing) {
            return <PhoneOutgoing className="h-4 w-4 text-green-400" />;
        }
        return <PhoneIncoming className="h-4 w-4 text-blue-400" />;
    };

    const getContactInfo = (call: CallRecord) => {
        if (call.mode === 'group') {
            return {
                name: call.group_name || 'Appel de groupe',
                avatar: null,
                id: call.group_id || '',
                isGroup: true,
            };
        }
        const isOutgoing = call.caller_id === userId;
        if (isOutgoing) {
            return {
                name: call.receiver_name || 'Utilisateur',
                avatar: call.receiver_avatar,
                id: call.receiver_id || '',
                isGroup: false,
            };
        }
        return {
            name: call.caller_name || 'Utilisateur',
            avatar: call.caller_avatar,
            id: call.caller_id,
            isGroup: false,
        };
    };

    const filteredCalls = calls.filter(call => {
        if (filter === 'all') return true;
        if (filter === 'missed') return call.status === 'missed';
        if (filter === 'incoming') return call.caller_id !== userId;
        if (filter === 'outgoing') return call.caller_id === userId;
        return true;
    });

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    return (
        <div className="flex flex-col h-full bg-gradient-to-b from-slate-900/95 to-slate-950/95">
            {/* Header */}
            <div className="flex items-center gap-3 p-3 sm:p-4 border-b border-white/10 bg-slate-900/80 backdrop-blur-xl">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onBack}
                    className="rounded-full hover:bg-white/10"
                >
                    <ArrowLeft className="h-5 w-5 text-white" />
                </Button>
                <div className="flex-1">
                    <h2 className="font-bold text-white text-base sm:text-lg">Historique des appels</h2>
                    <p className="text-xs text-slate-400">{calls.length} appel{calls.length !== 1 ? 's' : ''}</p>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-1 p-2 overflow-x-auto">
                {[
                    { key: 'all', label: 'Tous' },
                    { key: 'missed', label: 'Manqués' },
                    { key: 'incoming', label: 'Entrants' },
                    { key: 'outgoing', label: 'Sortants' },
                ].map(f => (
                    <Button
                        key={f.key}
                        variant="ghost"
                        size="sm"
                        className={`rounded-full text-xs shrink-0 ${filter === f.key
                                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                        onClick={() => setFilter(f.key as typeof filter)}
                    >
                        {f.label}
                    </Button>
                ))}
            </div>

            {/* Call List */}
            <div className="flex-1 overflow-y-auto px-2 sm:px-3">
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                        <span className="ml-2 text-sm text-slate-400">Chargement...</span>
                    </div>
                ) : filteredCalls.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                            <Phone className="h-8 w-8 text-slate-600" />
                        </div>
                        <p className="text-slate-400 text-sm font-medium">
                            {filter === 'all' ? 'Aucun appel récent' : `Aucun appel ${filter === 'missed' ? 'manqué' : filter === 'incoming' ? 'entrant' : 'sortant'}`}
                        </p>
                        <p className="text-slate-500 text-xs mt-1">
                            Les appels passés et reçus apparaîtront ici
                        </p>
                    </div>
                ) : (
                    <AnimatePresence>
                        {filteredCalls.map((call, index) => {
                            const contact = getContactInfo(call);
                            return (
                                <motion.div
                                    key={call.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.03 }}
                                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors group"
                                >
                                    {/* Avatar */}
                                    <div className="relative">
                                        <Avatar className="h-11 w-11">
                                            <AvatarImage src={contact.avatar || undefined} />
                                            <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white text-xs">
                                                {contact.isGroup ? <Users className="h-5 w-5" /> : getInitials(contact.name)}
                                            </AvatarFallback>
                                        </Avatar>
                                        {/* Call type indicator */}
                                        <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center ${call.status === 'missed' ? 'bg-red-500' :
                                                call.status === 'rejected' ? 'bg-orange-500' :
                                                    'bg-green-500'
                                            }`}>
                                            {call.call_type === 'video' ? (
                                                <Video className="h-2.5 w-2.5 text-white" />
                                            ) : (
                                                <Phone className="h-2.5 w-2.5 text-white" />
                                            )}
                                        </div>
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className={`font-medium text-sm truncate ${call.status === 'missed' ? 'text-red-400' : 'text-white'
                                                }`}>
                                                {contact.name}
                                            </p>
                                            {call.mode === 'group' && (
                                                <Badge className="bg-indigo-500/20 text-indigo-400 text-[9px]">Groupe</Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            {getCallIcon(call)}
                                            <span className="text-xs text-slate-400">
                                                {call.status === 'missed' ? 'Manqué' :
                                                    call.status === 'rejected' ? 'Refusé' :
                                                        formatDuration(call.duration_seconds)}
                                            </span>
                                            <span className="text-slate-600">•</span>
                                            <span className="text-xs text-slate-500">
                                                {formatDistanceToNow(new Date(call.created_at), { addSuffix: true, locale: fr })}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Call back button */}
                                    {!contact.isGroup && onCall && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="rounded-full text-slate-500 hover:text-green-400 hover:bg-green-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => onCall(call.call_type, contact.id, contact.name, contact.avatar)}
                                            title="Rappeler"
                                        >
                                            <Phone className="h-4 w-4" />
                                        </Button>
                                    )}
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
}
