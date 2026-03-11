'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    Bell, X, Check, Trash2, Filter,
    MessageSquare, Users, Heart, Sparkles,
    AlertCircle, ChevronDown, Settings,
    RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNotificationContext } from '@/components/NotificationContext';
import type { NotificationItem } from '@/hooks/use-notifications';

/**
 * ══════════════════════════════════════════════════════════
 * NotificationCenter — Premium Notification Panel
 * ══════════════════════════════════════════════════════════
 *
 * Features:
 * - Infinite scroll with cursor-based pagination
 * - Swipe-to-dismiss on mobile
 * - Section headers (Today, This Week, Older)
 * - Actor avatars with aggregation count
 * - Filter tabs (All, Unread)
 * - Pull-to-refresh
 * - Animated entry/exit
 */

type FilterTab = 'all' | 'unread';

export function NotificationCenter() {
    const {
        notifications,
        unreadCount,
        isLoading,
        hasMore,
        loadMore,
        refresh,
        markAllAsRead,
        clearAll,
        handleNotificationClick,
    } = useNotificationContext();

    const [isOpen, setIsOpen] = useState(false);
    const [filter, setFilter] = useState<FilterTab>('all');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);

    // ── Click outside to close ──────────────────────────────
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // ── Infinite scroll observer ────────────────────────────
    const lastItemRef = useCallback(
        (node: HTMLDivElement | null) => {
            if (isLoading) return;
            if (observerRef.current) observerRef.current.disconnect();

            observerRef.current = new IntersectionObserver(entries => {
                if (entries[0]?.isIntersecting && hasMore) {
                    loadMore();
                }
            });

            if (node) observerRef.current.observe(node);
        },
        [isLoading, hasMore, loadMore]
    );

    // ── Pull to refresh ─────────────────────────────────────
    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true);
        await refresh();
        setIsRefreshing(false);
    }, [refresh]);

    // ── Filter notifications ────────────────────────────────
    const filteredNotifications = filter === 'unread'
        ? notifications.filter(n => !n.is_read)
        : notifications;

    // ── Group by time sections ──────────────────────────────
    const sections = groupByTimeSections(filteredNotifications);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="relative p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                aria-label="Notifications"
            >
                <Bell className={cn(
                    "h-5 w-5 transition-colors",
                    unreadCount > 0 ? "text-amber-400" : "text-slate-400"
                )} />

                {unreadCount > 0 && (
                    <>
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold shadow-lg shadow-red-500/40"
                        >
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </motion.div>
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        </span>
                    </>
                )}
            </button>
        );
    }

    return (
        <div className="relative" ref={panelRef}>
            {/* Bell button (active state) */}
            <button
                onClick={() => setIsOpen(false)}
                className="relative p-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 transition-all"
            >
                <Bell className="h-5 w-5 text-indigo-400" />
                {unreadCount > 0 && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold"
                    >
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </motion.div>
                )}
            </button>

            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-9998"
                onClick={() => setIsOpen(false)}
            />

            {/* Panel */}
            <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="fixed top-14 left-3 right-3 sm:left-auto sm:right-4 sm:w-[420px] max-h-[80vh] bg-[#0f1318] border border-white/10 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden z-9999 flex flex-col"
            >
                {/* ── Header ─────────────────────────────────── */}
                <div className="px-4 py-3 border-b border-white/5">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Bell className="h-4 w-4 text-amber-400" />
                            <h3 className="font-bold text-sm text-white">Notifications</h3>
                            {unreadCount > 0 && (
                                <Badge className="bg-red-500/20 text-red-400 border-none text-[10px] h-5">
                                    {unreadCount}
                                </Badge>
                            )}
                        </div>
                        <div className="flex gap-1">
                            {unreadCount > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 rounded-lg text-[10px] text-indigo-400 hover:text-indigo-300"
                                    onClick={markAllAsRead}
                                >
                                    <Check className="h-3 w-3 mr-1" /> Tout lire
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    "h-7 w-7 rounded-lg text-slate-500 hover:text-slate-300",
                                    isRefreshing && "animate-spin"
                                )}
                                onClick={handleRefresh}
                            >
                                <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-lg text-slate-500 hover:text-slate-300"
                                onClick={() => setIsOpen(false)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Filter tabs */}
                    <div className="flex gap-1">
                        <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>
                            Toutes
                        </FilterButton>
                        <FilterButton active={filter === 'unread'} onClick={() => setFilter('unread')}>
                            Non lues {unreadCount > 0 && `(${unreadCount})`}
                        </FilterButton>
                    </div>
                </div>

                {/* ── Notification List ───────────────────────── */}
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto overscroll-contain"
                    style={{ maxHeight: 'calc(80vh - 140px)' }}
                >
                    {filteredNotifications.length === 0 ? (
                        <div className="text-center py-16 px-4">
                            <div className="h-16 w-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                                <Bell className="h-8 w-8 text-slate-700" />
                            </div>
                            <p className="text-slate-400 text-sm font-medium">
                                {filter === 'unread' ? 'Aucune notification non lue' : 'Aucune notification'}
                            </p>
                            <p className="text-slate-600 text-xs mt-2">
                                Vous serez notifié des nouveaux messages et événements
                            </p>
                        </div>
                    ) : (
                        <div>
                            {sections.map(section => (
                                <div key={section.label}>
                                    {/* Section header */}
                                    <div className="px-4 py-2 bg-[#0a0d11] sticky top-0 z-10">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                            {section.label}
                                        </p>
                                    </div>

                                    {/* Items */}
                                    {section.items.map((notif, index) => (
                                        <SwipeableNotificationItem
                                            key={notif.id}
                                            notification={notif}
                                            onClick={() => {
                                                handleNotificationClick(notif);
                                                setIsOpen(false);
                                            }}
                                            ref={
                                                index === section.items.length - 1 &&
                                                    section === sections[sections.length - 1]
                                                    ? lastItemRef
                                                    : undefined
                                            }
                                        />
                                    ))}
                                </div>
                            ))}

                            {/* Load more indicator */}
                            {isLoading && (
                                <div className="flex items-center justify-center py-4 gap-2">
                                    <div className="h-4 w-4 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                                    <span className="text-slate-500 text-xs">Chargement…</span>
                                </div>
                            )}

                            {!hasMore && filteredNotifications.length > 5 && (
                                <div className="text-center py-4">
                                    <p className="text-slate-600 text-xs">Fin des notifications</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Footer ──────────────────────────────────── */}
                {filteredNotifications.length > 0 && (
                    <div className="px-4 py-2 border-t border-white/5 flex justify-between items-center">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 rounded-lg text-[10px] text-red-400 hover:text-red-300"
                            onClick={clearAll}
                        >
                            <Trash2 className="h-3 w-3 mr-1" /> Effacer tout
                        </Button>
                        <span className="text-[10px] text-slate-600">
                            {filteredNotifications.length} notification{filteredNotifications.length > 1 ? 's' : ''}
                        </span>
                    </div>
                )}
            </motion.div>
        </div>
    );
}

// ── Filter Button Component ──────────────────────────────

function FilterButton({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "px-3 py-1 rounded-lg text-[11px] font-medium transition-all",
                active
                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                    : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
            )}
        >
            {children}
        </button>
    );
}

// ── Swipeable Notification Item ──────────────────────────

interface SwipeableItemProps {
    notification: NotificationItem;
    onClick: () => void;
}

const SwipeableNotificationItem = React.forwardRef<HTMLDivElement, SwipeableItemProps>(
    ({ notification, onClick }, ref) => {
        const x = useMotionValue(0);
        const opacity = useTransform(x, [-100, 0], [0.5, 1]);
        const bgColor = useTransform(x, [-100, -50, 0], [
            'rgba(239,68,68,0.2)', 'rgba(239,68,68,0.1)', 'transparent'
        ]);

        const handleDragEnd = (_: any, info: PanInfo) => {
            if (info.offset.x < -80) {
                // Swiped left — mark as read
                onClick();
            }
        };

        const actors = notification.actors || [];
        const actorCount = notification.actor_count || 1;

        return (
            <motion.div
                ref={ref}
                style={{ x, opacity }}
                drag="x"
                dragConstraints={{ left: -100, right: 0 }}
                dragElastic={0.1}
                onDragEnd={handleDragEnd}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={cn(
                    "relative px-4 py-3 flex items-start gap-3 cursor-pointer transition-colors border-b border-white/3",
                    !notification.is_read
                        ? "bg-indigo-500/4 hover:bg-indigo-500/8"
                        : "hover:bg-white/3"
                )}
                onClick={onClick}
            >
                {/* Swipe-to-read background hint */}
                <motion.div
                    style={{ backgroundColor: bgColor as any }}
                    className="absolute inset-0 flex items-center justify-end pr-4 pointer-events-none"
                >
                    <Check className="h-5 w-5 text-red-400 opacity-50" />
                </motion.div>

                {/* Avatar / Icon */}
                <div className="shrink-0 mt-0.5 relative">
                    {actors.length > 0 && actors[0]?.avatar ? (
                        <div className="relative">
                            <Avatar className="h-10 w-10 border-2 border-white/10">
                                <AvatarImage src={actors[0].avatar} />
                                <AvatarFallback className="bg-indigo-600/30 text-indigo-300 text-xs">
                                    {actors[0].name?.[0] || '?'}
                                </AvatarFallback>
                            </Avatar>
                            {/* Stacked second avatar */}
                            {actors.length > 1 && actors[1]?.avatar && (
                                <Avatar className="h-6 w-6 absolute -bottom-1 -right-1 border-2 border-[#0f1318]">
                                    <AvatarImage src={actors[1].avatar} />
                                    <AvatarFallback className="bg-purple-600/30 text-purple-300 text-[8px]">
                                        {actors[1].name?.[0] || '?'}
                                    </AvatarFallback>
                                </Avatar>
                            )}
                            {/* Count badge for 3+ actors */}
                            {actorCount > 2 && (
                                <div className="absolute -bottom-1 -right-1 h-5 min-w-[20px] px-1 rounded-full bg-indigo-600 text-white text-[8px] font-bold flex items-center justify-center border-2 border-[#0f1318]">
                                    +{actorCount - 1}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center">
                            {getActionIcon(notification.action_type)}
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <p className={cn(
                        "text-[12px] leading-relaxed",
                        !notification.is_read ? "text-white font-semibold" : "text-slate-300"
                    )}>
                        {notification.title}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {notification.message}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-[10px] text-slate-600">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: fr })}
                        </p>
                        {notification.priority === 'high' && (
                            <span className="text-[8px] text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full font-bold uppercase">
                                urgent
                            </span>
                        )}
                    </div>
                </div>

                {/* Unread dot */}
                {!notification.is_read && (
                    <div className="h-2.5 w-2.5 rounded-full bg-indigo-500 shrink-0 mt-3 shadow-lg shadow-indigo-500/30" />
                )}
            </motion.div>
        );
    }
);

SwipeableNotificationItem.displayName = 'SwipeableNotificationItem';

// ── Icon mapping by action_type ──────────────────────────

function getActionIcon(actionType: string) {
    switch (actionType) {
        case 'prayer_prayed':
        case 'friend_prayed':
        case 'prayer_no_response':
            return <Heart className="h-5 w-5 text-pink-400" />;
        case 'new_prayer_published':
        case 'prayer_comment':
            return <Sparkles className="h-5 w-5 text-amber-400" />;
        case 'group_access_request':
        case 'group_access_approved':
        case 'group_invitation':
            return <Users className="h-5 w-5 text-purple-400" />;
        case 'group_new_message':
        case 'dm_new_message':
        case 'group_mention':
            return <MessageSquare className="h-5 w-5 text-blue-400" />;
        case 'admin_new_group':
            return <Sparkles className="h-5 w-5 text-indigo-400" />;
        case 'friend_request_received':
        case 'friend_request_accepted':
            return <Users className="h-5 w-5 text-green-400" />;
        default:
            return <Bell className="h-5 w-5 text-slate-400" />;
    }
}

// ── Group notifications by time sections ─────────────────

interface Section {
    label: string;
    items: NotificationItem[];
}

function groupByTimeSections(notifications: NotificationItem[]): Section[] {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 86400000);

    const sections: Section[] = [];
    const todayItems: NotificationItem[] = [];
    const weekItems: NotificationItem[] = [];
    const olderItems: NotificationItem[] = [];

    for (const n of notifications) {
        const d = new Date(n.created_at);
        if (d >= today) {
            todayItems.push(n);
        } else if (d >= weekAgo) {
            weekItems.push(n);
        } else {
            olderItems.push(n);
        }
    }

    if (todayItems.length > 0) sections.push({ label: "Aujourd'hui", items: todayItems });
    if (weekItems.length > 0) sections.push({ label: 'Cette semaine', items: weekItems });
    if (olderItems.length > 0) sections.push({ label: 'Plus ancien', items: olderItems });

    return sections;
}

export default NotificationCenter;
