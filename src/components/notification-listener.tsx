'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import { X, Bell, Sparkles, MessageSquare, AlertTriangle, CheckCircle2, Info, Heart, Users } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'

interface NotificationPopup {
    id: string;
    title: string;
    message: string;
    type: string;
    action_type?: string;
    action_data?: string; // JSON string with navigation info
}

export function NotificationListener() {
    const { user, setActiveTab, setPendingNavigation, triggerDMRefresh } = useAppStore();
    const [popups, setPopups] = useState<NotificationPopup[]>([]);

    const dismissPopup = (id: string) => {
        setPopups(prev => prev.filter(p => p.id !== id));
        // Mark as read in DB
        supabase.from('notifications').update({ is_read: true }).eq('id', id);
    };

    // Handle notification click - deep-link navigate to relevant content
    const navigateToContent = (popup: NotificationPopup) => {
        dismissPopup(popup.id);

        let actionData: any = {};
        try {
            if (popup.action_data) {
                actionData = typeof popup.action_data === 'string'
                    ? JSON.parse(popup.action_data)
                    : popup.action_data;
            }
        } catch (e) {
            console.error('Failed to parse action_data:', e);
        }

        // Navigate to the right tab
        const targetTab = actionData.tab || 'community';
        setActiveTab(targetTab as any);

        // Set pending navigation for deep-link within the view
        setPendingNavigation({
            viewState: actionData.viewState,
            groupId: actionData.groupId,
            groupName: actionData.groupName,
            prayerId: actionData.prayerId,
            communityTab: actionData.communityTab,
            conversationId: actionData.conversationId,
        });
    };

    useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel(`notifications:user:${user.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`
            },
                (payload) => {
                    const { id, title, message, type, action_type, action_data } = payload.new;

                    // Add to popup queue (in-app floating notification)
                    setPopups(prev => [...prev, { id, title, message, type, action_type, action_data }]);

                    // If this is a DM notification, trigger DM refresh signal
                    if (action_type === 'dm_new_message' && action_data) {
                        try {
                            const parsed = typeof action_data === 'string' ? JSON.parse(action_data) : action_data;
                            if (parsed.conversationId) {
                                triggerDMRefresh(parsed.conversationId);
                            }
                        } catch (e) { }
                    }

                    // Auto-dismiss after 10 seconds
                    setTimeout(() => {
                        dismissPopup(id);
                    }, 10000);

                    // NOTE: Browser/system notifications are handled by:
                    // - PushNotificationManager (background Web Push via Worker)
                    // - notification-bell.tsx (foreground Notification API)
                    // Do NOT create duplicate Notification() here.
                })
            .subscribe()

        return () => { channel.unsubscribe() }
    }, [user])

    // ── Voice Salon join notifications ──────────────────────────────────
    useEffect(() => {
        if (!user) return;

        // Listen to any new INSERT in salon_membres_actifs
        const salonChan = supabase
            .channel(`salon_join_notif_${user.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'salon_membres_actifs',
            }, async (payload) => {
                const { salon_id, user_id } = payload.new;
                if (user_id === user.id) return; // Don't notify yourself

                // Fetch salon + name of who joined
                const [{ data: salon }, { data: profile }] = await Promise.all([
                    supabase.from('salons').select('name, group_id').eq('id', salon_id).single(),
                    supabase.from('profiles').select('full_name').eq('id', user_id).single(),
                ]);

                if (!salon) return;

                // Check user is a member of that group
                const { data: membership } = await supabase
                    .from('prayer_group_members')
                    .select('id')
                    .eq('group_id', salon.group_id)
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (!membership) return; // Not a member of this group

                const joinerName = profile?.full_name || 'Un membre';

                // Show browser notification
                if ('Notification' in window && Notification.permission === 'granted') {
                    const notif = new Notification('🎙️ Salon vocal actif !', {
                        body: `${joinerName} est dans le salon — rejoins la conversation !`,
                        tag: `salon_vocal_${salon_id}`,
                        icon: '/icon-192.png',
                        requireInteraction: true,
                    });
                    notif.onclick = () => {
                        window.focus();
                        // Deep-link: open the group chat with voice salon
                        setActiveTab('community' as any);
                        setPendingNavigation({
                            viewState: 'main',
                            communityTab: 'chat',
                            groupId: salon.group_id,
                        });
                        notif.close();
                    };
                }

                // Also show in-app popup
                const fakeId = `salon_${salon_id}_${Date.now()}`;
                setPopups(prev => [...prev, {
                    id: fakeId,
                    title: '🎙️ Salon vocal actif !',
                    message: `${joinerName} est dans le salon vocal — cliquez pour rejoindre !`,
                    type: 'info',
                    action_type: 'group_voice_salon',
                    action_data: JSON.stringify({ communityTab: 'chat', groupId: salon.group_id }),
                }]);
                setTimeout(() => dismissPopup(fakeId), 12000);
            })
            .subscribe();

        return () => { salonChan.unsubscribe(); };
    }, [user]);

    const getIcon = (type: string) => {
        switch (type) {
            case 'success': return <CheckCircle2 className="h-6 w-6 text-green-500" />;
            case 'warning': return <AlertTriangle className="h-6 w-6 text-amber-500" />;
            case 'error': return <X className="h-6 w-6 text-red-500" />;
            case 'prayer': return <Heart className="h-6 w-6 text-pink-500" />;
            case 'testimony': return <Sparkles className="h-6 w-6 text-amber-400" />;
            case 'message': return <MessageSquare className="h-6 w-6 text-blue-500" />;
            case 'info': return <Users className="h-6 w-6 text-indigo-500" />;
            default: return <Bell className="h-6 w-6 text-indigo-500" />;
        }
    };

    const getGradient = (type: string) => {
        switch (type) {
            case 'success': return 'from-green-600/20 to-emerald-600/20 border-green-500/30';
            case 'warning': return 'from-amber-600/20 to-orange-600/20 border-amber-500/30';
            case 'error': return 'from-red-600/20 to-rose-600/20 border-red-500/30';
            case 'prayer': return 'from-pink-600/20 to-rose-600/20 border-pink-500/30';
            case 'testimony': return 'from-amber-600/20 to-yellow-600/20 border-amber-500/30';
            case 'message': return 'from-blue-600/20 to-cyan-600/20 border-blue-500/30';
            default: return 'from-indigo-600/20 to-purple-600/20 border-indigo-500/30';
        }
    };

    return (
        <AnimatePresence>
            {popups.map((popup, index) => (
                <motion.div
                    key={popup.id}
                    initial={{ opacity: 0, y: -100, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -50, scale: 0.9 }}
                    className="fixed z-100 left-1/2 -translate-x-1/2 cursor-pointer"
                    style={{ top: `${100 + index * 100}px` }}
                    onClick={() => navigateToContent(popup)}
                >
                    <div className={`
                        bg-linear-to-br ${getGradient(popup.type)}
                        backdrop-blur-xl border rounded-2xl shadow-2xl
                        p-5 min-w-[320px] max-w-[420px]
                        hover:scale-105 transition-transform duration-200
                    `}>
                        <div className="flex items-start gap-4">
                            <div className="shrink-0 bg-white/10 p-3 rounded-xl">
                                {getIcon(popup.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-white text-lg mb-1">{popup.title}</h4>
                                <p className="text-white/80 text-sm leading-relaxed">{popup.message}</p>
                                <p className="text-white/40 text-xs mt-2 font-medium">Cliquez pour voir →</p>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="shrink-0 -mr-2 -mt-2 text-white/50 hover:text-white hover:bg-white/10 rounded-xl"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    dismissPopup(popup.id);
                                }}
                            >
                                <X className="h-5 w-5" />
                            </Button>
                        </div>

                        {/* Progress bar for auto-dismiss */}
                        <motion.div
                            className="h-1 bg-white/30 rounded-full mt-4 overflow-hidden"
                        >
                            <motion.div
                                className="h-full bg-white/60 rounded-full"
                                initial={{ width: "100%" }}
                                animate={{ width: "0%" }}
                                transition={{ duration: 10, ease: "linear" }}
                            />
                        </motion.div>
                    </div>
                </motion.div>
            ))}
        </AnimatePresence>
    );
}
