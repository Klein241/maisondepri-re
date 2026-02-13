'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, X, MessageSquare, Users, Heart, Sparkles, Check, Trash2, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface AppNotification {
    id: string;
    title: string;
    message: string;
    type: 'message' | 'friend_request' | 'group' | 'prayer' | 'system';
    read: boolean;
    created_at: string;
    sender_name?: string;
    sender_avatar?: string;
    action_url?: string;
    action_type?: string;
    action_data?: string;
}

export function NotificationBell() {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [unreadMessages, setUnreadMessages] = useState(0);
    const panelRef = useRef<HTMLDivElement>(null);
    const user = useAppStore(s => s.user);
    const setActiveTab = useAppStore(s => s.setActiveTab);
    const setPendingNavigation = useAppStore(s => s.setPendingNavigation);

    // Load notifications from localStorage + Supabase
    const loadNotifications = useCallback(async () => {
        if (!user) return;

        // Load from localStorage first
        try {
            const stored = localStorage.getItem(`notifs_${user.id}`);
            if (stored) {
                const parsed: AppNotification[] = JSON.parse(stored);
                setNotifications(parsed);
                setUnreadCount(parsed.filter(n => !n.read).length);
            }
        } catch (e) { }

        // Load admin notifications from Supabase
        try {
            const { data } = await supabase
                .from('admin_notifications')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20);

            if (data) {
                const readIds = JSON.parse(localStorage.getItem(`read_notifs_${user.id}`) || '[]');
                const adminNotifs: AppNotification[] = data.map(n => ({
                    id: `admin_${n.id}`,
                    title: n.title,
                    message: n.message,
                    type: 'system' as const,
                    read: readIds.includes(`admin_${n.id}`),
                    created_at: n.created_at,
                }));

                setNotifications(prev => {
                    const nonAdmin = prev.filter(p => !p.id.startsWith('admin_'));
                    const merged = [...adminNotifs, ...nonAdmin]
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                        .slice(0, 50);
                    return merged;
                });
            }
        } catch (e) { }

        // Load from Supabase notifications table (primary notification source)
        try {
            const { data: supaNotifs } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(30);

            if (supaNotifs && supaNotifs.length > 0) {
                const supaAppNotifs: AppNotification[] = supaNotifs.map(n => ({
                    id: `supa_${n.id}`,
                    title: n.title,
                    message: n.message,
                    type: (n.type === 'message' ? 'message' : n.type === 'prayer' ? 'prayer' : n.type === 'success' ? 'group' : 'system') as AppNotification['type'],
                    read: n.is_read,
                    created_at: n.created_at,
                    action_type: n.action_type,
                    action_data: n.action_data,
                }));

                setNotifications(prev => {
                    const nonSupa = prev.filter(p => !p.id.startsWith('supa_'));
                    const merged = [...supaAppNotifs, ...nonSupa]
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                        .slice(0, 50);
                    return merged;
                });
            }
        } catch (e) { }

        // Count unread DMs
        try {
            const { data: convs } = await supabase
                .from('conversations')
                .select('id')
                .or(`participant1_id.eq.${user.id},participant2_id.eq.${user.id}`);

            if (convs && convs.length > 0) {
                const convIds = convs.map(c => c.id);
                const { count } = await supabase
                    .from('direct_messages')
                    .select('*', { count: 'exact', head: true })
                    .in('conversation_id', convIds)
                    .neq('sender_id', user.id)
                    .eq('read', false);

                setUnreadMessages(count || 0);
            }
        } catch (e) { }
    }, [user]);

    useEffect(() => {
        loadNotifications();
    }, [loadNotifications]);

    // Save notifications to localStorage
    useEffect(() => {
        if (user && notifications.length > 0) {
            localStorage.setItem(`notifs_${user.id}`, JSON.stringify(notifications.slice(0, 50)));
            setUnreadCount(notifications.filter(n => !n.read).length);
        }
    }, [notifications, user]);

    // Realtime subscriptions
    useEffect(() => {
        if (!user) return;

        // Listen for new DMs
        const dmChannel = supabase
            .channel(`notif_dm_${user.id}_${Date.now()}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'direct_messages',
            }, async (payload) => {
                const msg = payload.new as any;
                if (msg.sender_id === user.id) return;

                // Get sender profile
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name, avatar_url')
                    .eq('id', msg.sender_id)
                    .single();

                const notif: AppNotification = {
                    id: `dm_${msg.id}`,
                    title: 'Nouveau message',
                    message: msg.content?.substring(0, 80) || 'Message vocal 🎙️',
                    type: 'message',
                    read: false,
                    created_at: msg.created_at || new Date().toISOString(),
                    sender_name: profile?.full_name || 'Quelqu\'un',
                    sender_avatar: profile?.avatar_url || undefined,
                };

                setNotifications(prev => [notif, ...prev].slice(0, 50));
                setUnreadMessages(prev => prev + 1);

                // Trigger SW notification (works even when browser minimized)
                triggerPushNotification(
                    `💬 ${profile?.full_name || 'Nouveau message'}`,
                    msg.content?.substring(0, 100) || 'Message vocal 🎙️'
                );
            })
            .subscribe();

        // Listen for friend requests
        const friendChannel = supabase
            .channel(`notif_friend_${user.id}_${Date.now()}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'friendships',
                filter: `receiver_id=eq.${user.id}`,
            }, async (payload) => {
                const req = payload.new as any;

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name, avatar_url')
                    .eq('id', req.sender_id)
                    .single();

                const notif: AppNotification = {
                    id: `friend_${req.id}`,
                    title: 'Demande d\'ami',
                    message: `${profile?.full_name || 'Quelqu\'un'} vous a envoyé une demande d'ami`,
                    type: 'friend_request',
                    read: false,
                    created_at: req.created_at || new Date().toISOString(),
                    sender_name: profile?.full_name || undefined,
                    sender_avatar: profile?.avatar_url || undefined,
                };

                setNotifications(prev => [notif, ...prev].slice(0, 50));

                triggerPushNotification(
                    '🤝 Demande d\'ami',
                    `${profile?.full_name || 'Quelqu\'un'} veut être votre ami`
                );
            })
            .subscribe();

        // Listen for group messages
        const groupChannel = supabase
            .channel(`notif_group_${user.id}_${Date.now()}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'prayer_group_messages',
            }, async (payload) => {
                const msg = payload.new as any;
                if (msg.user_id === user.id) return;

                // Check if user is member of this group
                const { data: membership } = await supabase
                    .from('prayer_group_members')
                    .select('id')
                    .eq('group_id', msg.group_id)
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (!membership) return;

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name, avatar_url')
                    .eq('id', msg.user_id)
                    .single();

                const { data: group } = await supabase
                    .from('prayer_groups')
                    .select('name')
                    .eq('id', msg.group_id)
                    .single();

                const notif: AppNotification = {
                    id: `grp_${msg.id}`,
                    title: group?.name || 'Message de groupe',
                    message: `${profile?.full_name || 'Quelqu\'un'}: ${msg.content?.substring(0, 60) || '🎙️'}`,
                    type: 'group',
                    read: false,
                    created_at: msg.created_at || new Date().toISOString(),
                    sender_name: profile?.full_name || undefined,
                    sender_avatar: profile?.avatar_url || undefined,
                };

                setNotifications(prev => [notif, ...prev].slice(0, 50));

                triggerPushNotification(
                    `👥 ${group?.name || 'Groupe'}`,
                    `${profile?.full_name}: ${msg.content?.substring(0, 80) || '🎙️'}`
                );
            })
            .subscribe();

        // Listen for admin notifications
        const adminChannel = supabase
            .channel(`notif_admin_${user.id}_${Date.now()}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'admin_notifications',
            }, (payload) => {
                const n = payload.new as any;
                const notif: AppNotification = {
                    id: `admin_${n.id}`,
                    title: n.title,
                    message: n.message,
                    type: 'system',
                    read: false,
                    created_at: n.created_at || new Date().toISOString(),
                };
                setNotifications(prev => [notif, ...prev].slice(0, 50));

                triggerPushNotification(n.title, n.message);
            })
            .subscribe();

        return () => {
            dmChannel.unsubscribe();
            friendChannel.unsubscribe();
            groupChannel.unsubscribe();
            adminChannel.unsubscribe();
        };
    }, [user]);

    // Trigger Service Worker push notification (Pinterest-style, works when minimized)
    const triggerPushNotification = useCallback((title: string, body: string) => {
        // Method 1: Service Worker showNotification (works when tab is in background)
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'SHOW_NOTIFICATION',
                title,
                body,
                tag: `notif_${Date.now()}`,
                url: '/',
            });
        }
        // Method 2: Fallback to Notification API directly
        else if ('Notification' in window && Notification.permission === 'granted') {
            try {
                new Notification(title, {
                    body,
                    icon: '/icon-192.png',
                    badge: '/icon-192.png',
                    tag: `notif_${Date.now()}`,
                });
            } catch (e) {
                // Some browsers don't support new Notification() in SW context
            }
        }

        // Play notification sound
        try {
            const audio = new Audio('/notification.mp3');
            audio.volume = 0.3;
            audio.play().catch(() => { });
        } catch (e) { }
    }, []);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const markAsRead = (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        // Also save to readIds
        if (user) {
            const readIds = JSON.parse(localStorage.getItem(`read_notifs_${user.id}`) || '[]');
            if (!readIds.includes(id)) {
                readIds.push(id);
                localStorage.setItem(`read_notifs_${user.id}`, JSON.stringify(readIds));
            }
        }
    };

    const markAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        if (user) {
            const allIds = notifications.map(n => n.id);
            localStorage.setItem(`read_notifs_${user.id}`, JSON.stringify(allIds));
        }
    };

    const clearAll = () => {
        setNotifications([]);
        if (user) {
            localStorage.removeItem(`notifs_${user.id}`);
        }
    };

    const handleNotifClick = (notif: AppNotification) => {
        markAsRead(notif.id);

        // Mark as read in Supabase if it's a Supabase notification
        if (notif.id.startsWith('supa_')) {
            const supaId = notif.id.replace('supa_', '');
            supabase.from('notifications').update({ is_read: true }).eq('id', supaId).then(() => { });
        }

        // Parse action_data for deep-linking
        let actionData: any = {};
        try {
            if (notif.action_data) {
                actionData = typeof notif.action_data === 'string' ? JSON.parse(notif.action_data) : notif.action_data;
            }
        } catch (e) {
            console.error('Failed to parse action_data:', e);
        }

        // Navigate to the right tab
        const targetTab = actionData.tab || (notif.type === 'message' || notif.type === 'group' ? 'community' : null);
        if (targetTab) {
            setActiveTab(targetTab as any);
        }

        // Set pending navigation for deep-link within the view
        if (actionData.viewState || actionData.groupId || actionData.prayerId || actionData.communityTab || actionData.conversationId) {
            setPendingNavigation({
                viewState: actionData.viewState,
                groupId: actionData.groupId,
                groupName: actionData.groupName,
                prayerId: actionData.prayerId,
                communityTab: actionData.communityTab,
                conversationId: actionData.conversationId,
            });
        }

        setIsOpen(false);
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'message': return <MessageSquare className="h-4 w-4 text-blue-400" />;
            case 'friend_request': return <Users className="h-4 w-4 text-green-400" />;
            case 'group': return <Users className="h-4 w-4 text-purple-400" />;
            case 'prayer': return <Heart className="h-4 w-4 text-pink-400" />;
            default: return <Sparkles className="h-4 w-4 text-amber-400" />;
        }
    };

    const totalUnread = unreadCount + unreadMessages;

    if (!user) return null;

    return (
        <div className="relative" ref={panelRef}>
            {/* Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
            >
                <Bell className={cn(
                    "h-5 w-5 transition-colors",
                    totalUnread > 0 ? "text-amber-400" : "text-slate-400"
                )} />

                {/* Badge Count */}
                {totalUnread > 0 && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold shadow-lg shadow-red-500/40"
                    >
                        {totalUnread > 99 ? '99+' : totalUnread}
                    </motion.div>
                )}

                {/* Pulse animation when new notifications */}
                {totalUnread > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    </span>
                )}
            </button>

            {/* Notification Panel - FIXED position, above everything */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop overlay */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
                            onClick={() => setIsOpen(false)}
                        />
                        {/* Panel */}
                        <motion.div
                            initial={{ opacity: 0, y: -20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -20, scale: 0.95 }}
                            transition={{ duration: 0.25 }}
                            className="fixed top-16 left-3 right-3 sm:left-auto sm:right-4 sm:w-96 max-h-[75vh] bg-[#121620] border border-white/10 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden z-[9999]"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                                <div className="flex items-center gap-2">
                                    <Bell className="h-4 w-4 text-amber-400" />
                                    <h3 className="font-bold text-sm text-white">Notifications</h3>
                                    {totalUnread > 0 && (
                                        <Badge className="bg-red-500/20 text-red-400 border-none text-[10px] h-5">
                                            {totalUnread}
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex gap-1">
                                    {unreadCount > 0 && (
                                        <Button
                                            variant="ghost" size="sm"
                                            className="h-7 px-2 rounded-lg text-[10px] text-indigo-400"
                                            onClick={markAllAsRead}
                                        >
                                            <Check className="h-3 w-3 mr-1" /> Tout lire
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost" size="icon"
                                        className="h-7 w-7 rounded-lg text-slate-500"
                                        onClick={() => setIsOpen(false)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* Unread Messages Summary */}
                            {unreadMessages > 0 && (
                                <div
                                    className="px-4 py-2.5 bg-indigo-600/10 border-b border-white/5 cursor-pointer hover:bg-indigo-600/20 transition-colors"
                                    onClick={() => { setActiveTab('community'); setIsOpen(false); }}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-full bg-indigo-600/30 flex items-center justify-center">
                                            <MessageSquare className="h-4 w-4 text-indigo-400" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-xs font-bold text-white">
                                                {unreadMessages} message{unreadMessages > 1 ? 's' : ''} non lu{unreadMessages > 1 ? 's' : ''}
                                            </p>
                                            <p className="text-[10px] text-slate-500">Appuyez pour voir</p>
                                        </div>
                                        <Badge className="bg-indigo-600 text-white border-none text-[10px]">
                                            {unreadMessages}
                                        </Badge>
                                    </div>
                                </div>
                            )}

                            {/* Notification List */}
                            <ScrollArea className="max-h-[55vh]">
                                {notifications.length === 0 ? (
                                    <div className="text-center py-12 px-4">
                                        <Bell className="h-10 w-10 text-slate-700 mx-auto mb-3" />
                                        <p className="text-slate-500 text-sm">Aucune notification</p>
                                        <p className="text-slate-600 text-xs mt-1">Vous serez notifié des nouveaux messages et événements</p>
                                    </div>
                                ) : (
                                    <div className="py-1">
                                        {notifications.map((notif) => (
                                            <motion.div
                                                key={notif.id}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                className={cn(
                                                    "px-4 py-3 flex items-start gap-3 cursor-pointer transition-colors border-b border-white/[0.03]",
                                                    !notif.read
                                                        ? "bg-indigo-500/5 hover:bg-indigo-500/10"
                                                        : "hover:bg-white/5"
                                                )}
                                                onClick={() => handleNotifClick(notif)}
                                            >
                                                {/* Icon or Avatar */}
                                                <div className="shrink-0 mt-0.5">
                                                    {notif.sender_avatar ? (
                                                        <Avatar className="h-9 w-9 border border-white/10">
                                                            <AvatarImage src={notif.sender_avatar} />
                                                            <AvatarFallback className="bg-indigo-600/30 text-indigo-300 text-xs">
                                                                {notif.sender_name?.[0] || '?'}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                    ) : (
                                                        <div className="h-9 w-9 rounded-full bg-white/5 flex items-center justify-center">
                                                            {getIcon(notif.type)}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <p className={cn(
                                                        "text-xs leading-relaxed",
                                                        !notif.read ? "text-white font-semibold" : "text-slate-300"
                                                    )}>
                                                        {notif.sender_name && (
                                                            <span className="font-bold">{notif.sender_name}: </span>
                                                        )}
                                                        {notif.title}
                                                    </p>
                                                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                                        {notif.message}
                                                    </p>
                                                    <p className="text-[10px] text-slate-600 mt-1">
                                                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: fr })}
                                                    </p>
                                                </div>

                                                {/* Unread dot */}
                                                {!notif.read && (
                                                    <div className="h-2.5 w-2.5 rounded-full bg-indigo-500 shrink-0 mt-2" />
                                                )}
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>

                            {/* Footer */}
                            {notifications.length > 0 && (
                                <div className="px-4 py-2 border-t border-white/5 flex justify-between">
                                    <Button
                                        variant="ghost" size="sm"
                                        className="h-7 rounded-lg text-[10px] text-red-400 hover:text-red-300"
                                        onClick={clearAll}
                                    >
                                        <Trash2 className="h-3 w-3 mr-1" /> Effacer tout
                                    </Button>
                                </div>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
