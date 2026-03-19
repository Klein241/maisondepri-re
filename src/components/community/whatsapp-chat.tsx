'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Send, ArrowLeft, Users, Search, MoreVertical, Phone, Video,
    Image, Check,
    Circle, MessageSquare, Plus, X, Loader2, User,
    Shield, UserPlus, UserMinus, Camera, Settings, Crown,
    BookOpen, CalendarDays, Megaphone, Pin, ArrowRightLeft, Calendar, ChevronsUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { WebRTCCall } from './webrtc-call';
import { IncomingCallOverlay, initiateCall, CallSignal } from './call-system';
import { GroupToolsPanel } from './group-tools';
import { GroupAdminDialogs } from './group-admin-dialogs';
import { EventCalendarButton } from './event-calendar';
import { CallHistory } from './call-history';
import { VoiceSalon } from './voice-salon';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { EmojiPicker } from '@/components/ui/emoji-picker';
import { notifyDirectMessage, notifyGroupNewMessage } from '@/lib/notifications';
import { useAppStore } from '@/lib/store';
import { cacheMessages, getCachedGroupMessages, getCachedConversationMessages, evictOldMedia, CachedMessage } from '@/lib/local-storage-service';
import type { ChatUser, Conversation, ChatGroup, GroupMember, Message, TypingUser, WhatsAppChatProps, GameSession } from './chat-types';
// VoiceMessagePlayer — now used inside ChatMessageBubble
import { BibleShareDialog } from './bible-share-dialog';
import { ChatMessageBubble } from './chat-message-bubble';
import { ChatInputBar } from './chat-input-bar';
import { GroupGameDialog } from './group-game-dialog';
import { FloatingBubbles } from './floating-bubbles';
import { getInitials, formatTime, getMemberColor, normalizeBibleBookName } from './chat-utils';

export function WhatsAppChat({ user, onHideNav, activeGroupId, activeConversationId }: WhatsAppChatProps & { activeGroupId?: string | null; activeConversationId?: string | null }) {
    // View State
    const [view, setView] = useState<'list' | 'conversation' | 'group' | 'call_history'>('list');

    // Notify parent to hide/show bottom nav based on view
    useEffect(() => {
        onHideNav?.(view !== 'list');
    }, [view, onHideNav]);
    const [activeTab, setActiveTab] = useState<'conversations' | 'groups' | 'admin_groups'>('conversations');

    // Ref to track pending group to open (from external navigation)
    const pendingGroupIdRef = useRef<string | null>(null);

    // Data State
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [groups, setGroups] = useState<ChatGroup[]>([]);
    const [adminGroups, setAdminGroups] = useState<ChatGroup[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [allUsers, setAllUsers] = useState<ChatUser[]>([]);
    const [onlineUsers, setOnlineUsers] = useState<Record<string, boolean>>({});
    const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
    const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
    const [showGroupMembers, setShowGroupMembers] = useState(false);

    // UI State
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [selectedGroup, setSelectedGroup] = useState<ChatGroup | null>(null);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showNewConversation, setShowNewConversation] = useState(false);
    const [userSearchQuery, setUserSearchQuery] = useState('');

    // Voice Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [isUploadingVoice, setIsUploadingVoice] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const recordingTimeRef = useRef(0);

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const presenceChannelRef = useRef<any>(null);

    // Debounced reload ref to avoid excessive API calls
    const reloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Group Admin & Tools State
    const [showGroupTools, setShowGroupTools] = useState(false);
    const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
    const [addMemberSearch, setAddMemberSearch] = useState('');
    const [isUploadingGroupPhoto, setIsUploadingGroupPhoto] = useState(false);
    const groupPhotoInputRef = useRef<HTMLInputElement>(null);

    // @mention state
    const [showMentions, setShowMentions] = useState(false);
    const [mentionFilter, setMentionFilter] = useState('');

    // Bible sharing tool state
    const [showBibleTool, setShowBibleTool] = useState(false);
    const [bibleReference, setBibleReference] = useState('');
    const [bibleContent, setBibleContent] = useState('');
    const [bibleVersion, setBibleVersion] = useState('LSG');
    const [isFetchingBible, setIsFetchingBible] = useState(false);
    const [showBibleShareDialog, setShowBibleShareDialog] = useState(false);

    // Fasting program tool state
    const [showFastingTool, setShowFastingTool] = useState(false);
    const [fastingTheme, setFastingTheme] = useState('');
    const [fastingDuration, setFastingDuration] = useState(3);
    const [fastingDays, setFastingDays] = useState<Array<{
        title: string; theme: string; reference: string; passage: string;
        meditation: string; action: string; prayers: string;
    }>>([]);

    // WebRTC call state
    const [activeCall, setActiveCall] = useState<{
        type: 'audio' | 'video';
        mode: 'private' | 'group';
        isIncoming?: boolean;
    } | null>(null);
    const [incomingCall, setIncomingCall] = useState<CallSignal | null>(null);

    // Announcement state
    const [showAnnouncementTool, setShowAnnouncementTool] = useState(false);
    const [announcementText, setAnnouncementText] = useState('');

    // Pinned prayer state
    const [pinnedPrayer, setPinnedPrayer] = useState<string | null>(null);
    const [showPinTool, setShowPinTool] = useState(false);
    const [pinText, setPinText] = useState('');

    // Feature 4: Reply state
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);

    // Thread/comment state - private comments on a message
    const [threadMessage, setThreadMessage] = useState<Message | null>(null);
    const [threadComments, setThreadComments] = useState<any[]>([]);
    const [threadInput, setThreadInput] = useState('');

    // Feature 5: Group tool unread badge
    const [groupToolUnread, setGroupToolUnread] = useState(0);

    // Feature 7: File sharing state
    const [isUploadingFile, setIsUploadingFile] = useState(false);

    // Event planning state
    const [showEventTool, setShowEventTool] = useState(false);
    const [eventTitle, setEventTitle] = useState('');
    const [eventDate, setEventDate] = useState('');
    const [eventTime, setEventTime] = useState('');
    const [eventDescription, setEventDescription] = useState('');

    // "Lire la suite" expanded messages tracker
    const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());

    // Migrate members state
    const [showMigrateTool, setShowMigrateTool] = useState(false);
    const [migrateTargetName, setMigrateTargetName] = useState('');
    const [isMigratingMembers, setIsMigratingMembers] = useState(false);

    // Voice Salon state (Discord-style group audio)
    const [showVoiceSalon, setShowVoiceSalon] = useState(false);

    // Group search filter
    const [groupSearchQuery, setGroupSearchQuery] = useState('');

    // Scroll-to-top state
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const [showScrollTop, setShowScrollTop] = useState(false);

    // Group Game state
    const [showGroupGame, setShowGroupGame] = useState(false);

    // Feature 11: Floating bubbles for prayers/tools
    const [floatingItems, setFloatingItems] = useState<Array<{
        id: string;
        type: 'prayer' | 'tool' | 'group' | 'bible';
        title: string;
        icon?: string;
        content?: string;
        onClick?: () => void;
    }>>([]);
    const [activeGameSession, setActiveGameSession] = useState<{
        startedBy: string;
        startedByName: string;
        groupId: string;
        players: string[];
    } | null>(null);
    const [hasQuitGame, setHasQuitGame] = useState(false);

    // Create group dialog state (replaces window.prompt)
    const [showCreateGroupDialog, setShowCreateGroupDialog] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);

    // Pagination state for loading older messages
    const [hasMoreMessages, setHasMoreMessages] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // Group message polling fallback ref
    const groupPollRef = useRef<NodeJS.Timeout | null>(null);

    // Refs to hold current values without causing re-subscriptions
    const selectedConversationRef = useRef(selectedConversation);
    const selectedGroupRef = useRef(selectedGroup);

    // Keep refs in sync with state
    useEffect(() => {
        selectedConversationRef.current = selectedConversation;
    }, [selectedConversation]);

    useEffect(() => {
        selectedGroupRef.current = selectedGroup;
    }, [selectedGroup]);

    // Effect to handle external group selection
    // IMPORTANT: Must be AFTER all useState declarations to avoid TDZ in production builds
    useEffect(() => {
        if (activeGroupId && (groups.length > 0 || adminGroups.length > 0)) {
            const group = groups.find(g => g.id === activeGroupId) || adminGroups.find(g => g.id === activeGroupId);
            if (group) {
                if (selectedGroup?.id !== group.id || view !== 'group') {
                    console.log('[WhatsAppChat] Pending group from activeGroupId:', group.name);
                    pendingGroupIdRef.current = activeGroupId;
                    setSelectedGroup(group);
                    setSelectedConversation(null);
                    setView('group');
                }
            } else {
                console.log('[WhatsAppChat] Group not in local list, fetching directly:', activeGroupId);
                pendingGroupIdRef.current = activeGroupId;
                (async () => {
                    try {
                        const { data } = await supabase
                            .from('prayer_groups')
                            .select('*')
                            .eq('id', activeGroupId)
                            .single();
                        if (data) {
                            setSelectedGroup(data);
                            setSelectedConversation(null);
                            setView('group');
                        }
                    } catch (e) {
                        console.error('[WhatsAppChat] Error fetching group:', e);
                    }
                })();
            }
        }
    }, [activeGroupId, groups, adminGroups]);

    // Handle activeConversationId deep-link (from notification click)
    useEffect(() => {
        if (!activeConversationId || !user) return;
        (async () => {
            try {
                const { data: conv } = await supabase
                    .from('conversations')
                    .select('*')
                    .eq('id', activeConversationId)
                    .single();
                if (!conv) return;
                const partnerId = conv.participant1_id === user.id ? conv.participant2_id : conv.participant1_id;
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('id, full_name, avatar_url, is_online, last_seen')
                    .eq('id', partnerId)
                    .single();
                const conversation: Conversation = {
                    id: conv.id,
                    participantId: partnerId,
                    participant: profile || { id: partnerId, full_name: 'Utilisateur', avatar_url: null },
                    lastMessage: conv.last_message || '',
                    lastMessageAt: conv.last_message_at || conv.created_at,
                    unreadCount: 0,
                };
                setSelectedConversation(conversation);
                setSelectedGroup(null);
                setView('conversation');
                loadMessages('conversation', conv.id);
            } catch (e) {
                console.error('[WhatsAppChat] Error opening conversation from notification:', e);
            }
        })();
    }, [activeConversationId, user]);

    // Manual refresh function
    const handleManualRefresh = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        await Promise.all([loadConversations(), loadGroups()]);
        setIsLoading(false);
        toast.success('Actualisé');
    }, [user]);

    // Load initial data - only once on mount
    useEffect(() => {
        if (!user) return;

        // Load data once on mount
        const initData = async () => {
            setIsLoading(true);
            await Promise.all([loadConversations(), loadGroups(), loadAllUsers()]);
            setIsLoading(false);
        };
        initData();

        const cleanup = setupPresenceChannel();

        // Disable polling - rely on realtime subscriptions only
        // This was causing the continuous refresh issue
        // const pollInterval = setInterval(...)

        return () => {
            cleanup?.();
            if (reloadTimeoutRef.current) {
                clearTimeout(reloadTimeoutRef.current);
            }
            if (groupPollRef.current) {
                clearInterval(groupPollRef.current);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]); // Only re-run if user ID changes, not user object

    // RLS workaround: listen for DM refresh signals from the notification system
    const dmRefreshSignal = useAppStore(s => s.dmRefreshSignal);
    useEffect(() => {
        if (!dmRefreshSignal || !user) return;
        const currentConv = selectedConversationRef.current;
        if (currentConv && currentConv.id === dmRefreshSignal.conversationId) {
            // Reload messages for the current conversation
            loadMessages('conversation', currentConv.id);
        } else if (view === 'list') {
            // If on list view, reload conversations to update last message / unread
            loadConversations();
        }
    }, [dmRefreshSignal]);

    // Realtime subscriptions - STABLE, only depends on user.id
    // Uses refs to access current conversation/group without recreating subscriptions
    useEffect(() => {
        if (!user?.id) return;

        // Use a single stable channel name per user session
        const sessionId = Math.random().toString(36).substring(7);

        // Subscribe to new direct messages
        const dmChannel = supabase
            .channel(`dm_${user.id}_${sessionId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'direct_messages',
            }, async (payload) => {
                if (payload.eventType === 'INSERT') {
                    const msg = payload.new as any;
                    const currentConv = selectedConversationRef.current;
                    // Check if this message belongs to the currently open conversation
                    const isRelevant = currentConv && msg.conversation_id === currentConv.id;
                    if (isRelevant) {
                        // Message is for the conversation we're viewing — add it live
                        const { data: sender } = await supabase
                            .from('profiles')
                            .select('id, full_name, avatar_url')
                            .eq('id', msg.sender_id)
                            .single();

                        setMessages(prev => {
                            if (prev.find(m => m.id === msg.id)) return prev;
                            return [...prev, { ...msg, sender }];
                        });

                        // Mark as read if from other person
                        if (msg.sender_id !== user.id) {
                            await supabase
                                .from('direct_messages')
                                .update({ is_read: true })
                                .eq('id', msg.id);
                        }
                    } else {
                        // Message is for a different conversation — refresh the conversation list
                        // so the user sees updated last message and unread count
                        if (msg.sender_id !== user.id) {
                            loadConversations();
                        }
                    }
                } else if (payload.eventType === 'UPDATE') {
                    setMessages(prev => prev.map(m =>
                        m.id === payload.new.id ? { ...m, is_read: payload.new.is_read } : m
                    ));
                }
            })
            .subscribe();

        // Subscribe to group messages — listen for ALL inserts, filter by current group
        const groupChannel = supabase
            .channel(`grp_${user.id}_${sessionId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'prayer_group_messages',
            }, async (payload) => {
                const msg = payload.new as any;
                const currentGroup = selectedGroupRef.current;
                if (currentGroup && msg.group_id === currentGroup.id) {
                    // Skip if we already have this message (optimistic add)
                    // Use a small delay to let optimistic add settle
                    if (msg.user_id === user.id) {
                        // Own message — already added optimistically, just skip
                        setMessages(prev => {
                            if (prev.find(m => m.id === msg.id)) return prev;
                            // If not found (edge case), add it
                            return [...prev, {
                                ...msg,
                                sender_id: msg.user_id,
                                sender: { id: user.id, full_name: user.name, avatar_url: user.avatar || null },
                                is_read: true
                            }];
                        });
                        return;
                    }

                    // Other user's message — fetch sender profile and add
                    const { data: sender } = await supabase
                        .from('profiles')
                        .select('id, full_name, avatar_url')
                        .eq('id', msg.user_id)
                        .single();

                    setMessages(prev => {
                        if (prev.find(m => m.id === msg.id)) return prev;
                        return [...prev, {
                            ...msg,
                            sender_id: msg.user_id,
                            sender,
                            is_read: true
                        }];
                    });

                    // Messenger-style: increment badge for admin tool messages
                    const isAdminTool = msg.content?.includes('📢') || msg.content?.includes('📌')
                        || msg.content?.includes('📅') || msg.content?.includes('🕐')
                        || msg.content?.includes('**ANNONCE') || msg.content?.includes('**ÉVÉNEMENT')
                        || msg.content?.includes('**SUJET DE PRIÈRE');
                    if (isAdminTool) {
                        setGroupToolUnread(prev => prev + 1);
                    }
                } else if (!currentGroup) {
                    // User is on the list view — update groups + show toast
                    loadGroups();
                    // Messenger-style toast for messages in other groups
                    const { data: senderProfile } = await supabase
                        .from('profiles')
                        .select('full_name')
                        .eq('id', msg.user_id)
                        .single();
                    const { data: groupInfo } = await supabase
                        .from('prayer_groups')
                        .select('name')
                        .eq('id', msg.group_id)
                        .single();
                    if (senderProfile && groupInfo) {
                        toast.info(`💬 ${senderProfile.full_name} dans ${groupInfo.name}`, {
                            description: msg.content?.substring(0, 60) + (msg.content?.length > 60 ? '...' : ''),
                            duration: 4000,
                        });
                    }
                }
            })
            .subscribe();

        // Typing indicators
        const typingChannel = supabase
            .channel(`typing_${user.id}_${sessionId}`)
            .on('broadcast', { event: 'typing' }, (payload) => {
                if (payload.payload.userId !== user.id) {
                    setTypingUsers(prev => {
                        const exists = prev.find(u => u.userId === payload.payload.userId);
                        if (!exists) {
                            return [...prev, { userId: payload.payload.userId, userName: payload.payload.userName }];
                        }
                        return prev;
                    });
                    setTimeout(() => {
                        setTypingUsers(prev => prev.filter(u => u.userId !== payload.payload.userId));
                    }, 3000);
                }
            })
            .subscribe();

        // Listen for group deletions (admin deletes a group)
        const groupDeleteChannel = supabase
            .channel(`group_delete_${user.id}_${sessionId}`)
            .on('postgres_changes', {
                event: 'DELETE',
                schema: 'public',
                table: 'prayer_groups',
            }, (payload) => {
                const deletedId = (payload.old as any)?.id;
                if (deletedId) {
                    // Remove from groups list
                    setGroups(prev => prev.filter(g => g.id !== deletedId));
                    setAdminGroups(prev => prev.filter(g => g.id !== deletedId));
                    // If viewing this group, go back to list
                    const currentGroup = selectedGroupRef.current;
                    if (currentGroup && currentGroup.id === deletedId) {
                        setSelectedGroup(null);
                        setView('list');
                        toast.info('Ce groupe a été supprimé par un administrateur');
                    }
                }
            })
            .subscribe();

        // Feature 7+8: Realtime subscription for reactions & comment_count on group messages
        const msgUpdateChannel = supabase
            .channel(`msg_reactions_${user.id}_${sessionId}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'prayer_group_messages',
            }, (payload) => {
                const updated = payload.new as any;
                if (updated?.id) {
                    setMessages(prev => prev.map(m => {
                        if (m.id === updated.id) {
                            return {
                                ...m,
                                reactions: typeof updated.reactions === 'string'
                                    ? JSON.parse(updated.reactions || '{}')
                                    : (updated.reactions || {}),
                                comment_count: updated.comment_count ?? m.comment_count,
                            };
                        }
                        return m;
                    }));
                }
            })
            .subscribe();

        return () => {
            dmChannel.unsubscribe();
            groupChannel.unsubscribe();
            typingChannel.unsubscribe();
            groupDeleteChannel.unsubscribe();
            msgUpdateChannel.unsubscribe();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]); // Only user.id - refs are used for conversation/group

    // Bug 4 FIX: Auto-close groups whose 24h timer has expired
    useEffect(() => {
        if (!user) return;

        const checkAutoCloseGroups = async () => {
            try {
                // Find groups marked as closed (is_open = false) with auto-close description
                const { data: closedGroups } = await supabase
                    .from('prayer_groups')
                    .select('id, description, name')
                    .eq('is_open', false);

                if (!closedGroups || closedGroups.length === 0) return;

                const now = new Date();
                for (const group of closedGroups) {
                    const desc = group.description || '';
                    // Match: "📌 🎉 PRIÈRE EXAUCÉE - Fermeture auto le DD/MM/YYYY à HH:MM"
                    if (!desc.includes('PRIÈRE EXAUCÉE') || !desc.includes('Fermeture auto')) continue;

                    // Parse date from description: "le DD/MM/YYYY à HH:MM"
                    const dateMatch = desc.match(/le (\d{2})\/(\d{2})\/(\d{4}) à (\d{2}):(\d{2})/);
                    if (!dateMatch) continue;

                    const [, day, month, year, hour, minute] = dateMatch;
                    const closeDate = new Date(
                        parseInt(year), parseInt(month) - 1, parseInt(day),
                        parseInt(hour), parseInt(minute)
                    );

                    // If close date has passed, delete the group
                    if (now >= closeDate) {
                        console.log(`Auto-deleting group "${group.name}" (24h expired)`);

                        // Delete messages first
                        await supabase
                            .from('prayer_group_messages')
                            .delete()
                            .eq('group_id', group.id);

                        // Delete members
                        await supabase
                            .from('prayer_group_members')
                            .delete()
                            .eq('group_id', group.id);

                        // Delete group
                        await supabase
                            .from('prayer_groups')
                            .delete()
                            .eq('id', group.id);

                        // If user was viewing this group, go back to list
                        if (selectedGroupRef.current?.id === group.id) {
                            setView('list');
                            setSelectedGroup(null);
                            toast.info(`🕊️ Le groupe "${group.name}" a été archivé (prière exaucée).`);
                        }

                        // Refresh group list
                        loadGroups();
                    }
                }
            } catch (e) {
                console.error('Auto-close check error:', e);
            }
        };

        checkAutoCloseGroups();
        const interval = setInterval(checkAutoCloseGroups, 300000); // Every 5 min
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Setup presence channel for online status
    const setupPresenceChannel = () => {
        if (!user) return;

        // CRITICAL: All users MUST be on the SAME channel to see each other's presence
        const channel = supabase.channel('global_presence');
        presenceChannelRef.current = channel;

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                const online: Record<string, boolean> = {};
                Object.values(state).forEach((presences: any) => {
                    presences.forEach((p: any) => {
                        online[p.user_id] = true;
                    });
                });
                setOnlineUsers(online);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({ user_id: user.id });
                    // Also update last_seen in profiles
                    supabase.from('profiles')
                        .update({ last_seen: new Date().toISOString() })
                        .eq('id', user.id)
                        .then(() => { });
                }
            });

        // Periodically update last_seen
        const lastSeenInterval = setInterval(() => {
            supabase.from('profiles')
                .update({ last_seen: new Date().toISOString() })
                .eq('id', user.id)
                .then(() => { });
        }, 60000); // Every minute

        return () => {
            clearInterval(lastSeenInterval);
            channel.unsubscribe();
        };
    };

    // Load functions
    const loadConversations = async () => {
        if (!user) return;
        try {
            // Use the conversations table which has participant1_id and participant2_id
            const { data: convData, error } = await supabase
                .from('conversations')
                .select('*')
                .or(`participant1_id.eq.${user.id},participant2_id.eq.${user.id}`)
                .order('last_message_at', { ascending: false });

            if (error) {
                console.log('Conversations table may not exist:', error.message);
                setConversations([]);
                return;
            }

            if (!convData || convData.length === 0) {
                setConversations([]);
                return;
            }

            // Fetch profile for each conversation partner
            const formattedConversations = await Promise.all(
                convData.map(async (conv: any) => {
                    const partnerId = conv.participant1_id === user.id ? conv.participant2_id : conv.participant1_id;
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('id, full_name, avatar_url, is_online, last_seen')
                        .eq('id', partnerId)
                        .single();

                    // Get unread count
                    const { count } = await supabase
                        .from('direct_messages')
                        .select('*', { count: 'exact', head: true })
                        .eq('conversation_id', conv.id)
                        .neq('sender_id', user.id)
                        .eq('is_read', false);

                    return {
                        id: conv.id,
                        participantId: partnerId,
                        participant: profile || { id: partnerId, full_name: 'Utilisateur', avatar_url: null },
                        lastMessage: conv.last_message || '',
                        lastMessageAt: conv.last_message_at || conv.created_at,
                        unreadCount: count || 0
                    } as Conversation;
                })
            );

            setConversations(formattedConversations);
        } catch (e) {
            console.error('Error loading conversations:', e);
        }
        setIsLoading(false);
    };

    const loadGroups = async () => {
        if (!user) return;
        try {
            // Get groups user is member of
            const { data: memberGroups, error: memberError } = await supabase
                .from('prayer_group_members')
                .select('group_id')
                .eq('user_id', user.id);

            if (memberError) throw memberError;

            const groupIds = (memberGroups || []).map(m => m.group_id);

            if (groupIds.length > 0) {
                const { data: groupData, error: groupError } = await supabase
                    .from('prayer_groups')
                    .select('*')
                    .in('id', groupIds);

                if (groupError) throw groupError;

                // PERF: Batch all member counts in parallel instead of sequential
                const countPromises = (groupData || []).map(g =>
                    supabase
                        .from('prayer_group_members')
                        .select('*', { count: 'exact', head: true })
                        .eq('group_id', g.id)
                        .then(res => ({ id: g.id, count: res.count || g.member_count || 0 }))
                );
                const counts = await Promise.all(countPromises);
                const countMap = Object.fromEntries(counts.map(c => [c.id, c.count]));

                // Separate admin-created from prayer-request groups
                const userGroups: ChatGroup[] = [];
                const adminGroupsList: ChatGroup[] = [];

                for (const g of (groupData || [])) {
                    const group: ChatGroup = {
                        id: g.id,
                        name: g.name,
                        description: g.description,
                        is_urgent: g.is_urgent || false,
                        member_count: countMap[g.id] || 0,
                        unreadCount: 0,
                        is_admin_created: !g.prayer_request_id,
                        prayer_request_id: g.prayer_request_id,
                        avatar_url: g.avatar_url || null,
                        created_by: g.created_by,
                        created_at: g.created_at,
                    };

                    if (g.prayer_request_id) {
                        userGroups.push(group);
                    } else {
                        adminGroupsList.push(group);
                    }
                }

                setGroups(userGroups);
                setAdminGroups(adminGroupsList);
            } else {
                setGroups([]);
                setAdminGroups([]);
            }
        } catch (e) {
            console.error('Error loading groups:', e);
        }
    };

    // Load group members with online status
    const loadGroupMembers = async (groupId: string) => {
        try {
            // Direct separate queries (embedded join fails — no FK between tables)
            const { data: memberRows, error: memberError } = await supabase
                .from('prayer_group_members')
                .select('user_id, role')
                .eq('group_id', groupId);

            if (memberError) throw memberError;
            if (!memberRows || memberRows.length === 0) {
                setGroupMembers([]);
                return;
            }

            const userIds = memberRows.map(m => m.user_id);
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, is_online')
                .in('id', userIds);

            const profileMap = new Map((profiles || []).map(p => [p.id, p]));
            const members: GroupMember[] = memberRows.map((m: any) => {
                const profile = profileMap.get(m.user_id);
                return {
                    id: profile?.id || m.user_id,
                    full_name: profile?.full_name || 'Utilisateur',
                    avatar_url: profile?.avatar_url || null,
                    is_online: profile?.is_online || onlineUsers[m.user_id] || false,
                    role: m.role || 'member',
                };
            });
            setGroupMembers(members);
        } catch (e) {
            console.error('Error loading group members:', e);
        }
    };

    const loadAllUsers = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, is_online, last_seen')
                .neq('id', user?.id)
                .order('full_name');

            if (error) throw error;
            setAllUsers(data || []);
        } catch (e) {
            console.error('Error loading users:', e);
        }
    };

    const loadMessages = async (type: 'conversation' | 'group', id: string) => {
        // Feature 11: Load from local cache first for instant display
        try {
            const cached = type === 'group'
                ? await getCachedGroupMessages(id)
                : await getCachedConversationMessages(id);
            if (cached.length > 0) {
                setMessages(cached.map(m => ({
                    id: m.id,
                    content: m.content,
                    type: m.type as any,
                    voice_url: m.voice_url,
                    voice_duration: m.voice_duration,
                    file_url: m.file_url,
                    file_name: m.file_name,
                    file_type: m.file_type,
                    sender_id: m.sender_id || m.user_id,
                    sender: { id: m.sender_id || m.user_id, full_name: m.sender_name || null, avatar_url: m.sender_avatar || null },
                    created_at: m.created_at,
                    is_read: true,
                })));
            } else {
                setMessages([]);
            }
        } catch { setMessages([]); }

        // Fetch fresh from server
        try {
            if (type === 'conversation') {
                const { data, error } = await supabase
                    .from('direct_messages')
                    .select('*')
                    .eq('conversation_id', id)
                    .order('created_at', { ascending: true });

                if (error) throw error;

                // Fetch sender profiles — batch unique sender IDs
                const senderIds = [...new Set((data || []).map((m: any) => m.sender_id))];
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, full_name, avatar_url')
                    .in('id', senderIds);
                const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));

                const messagesWithSenders = (data || []).map((msg: any) => ({
                    ...msg,
                    sender: profileMap[msg.sender_id] || null,
                    is_read: msg.is_read || msg.sender_id === user?.id
                }));
                setMessages(messagesWithSenders);

                // Feature 11: Cache messages locally
                const toCacheDM: CachedMessage[] = messagesWithSenders.map((m: any) => ({
                    id: m.id,
                    conversation_id: id,
                    user_id: m.sender_id,
                    sender_id: m.sender_id,
                    content: m.content,
                    type: m.type,
                    voice_url: m.voice_url,
                    voice_duration: m.voice_duration,
                    file_url: m.file_url,
                    file_name: m.file_name,
                    file_type: m.file_type,
                    created_at: m.created_at,
                    sender_name: m.sender?.full_name,
                    sender_avatar: m.sender?.avatar_url,
                }));
                cacheMessages(toCacheDM).catch(() => { });

                // Mark messages from others as read
                await supabase
                    .from('direct_messages')
                    .update({ is_read: true })
                    .eq('conversation_id', id)
                    .neq('sender_id', user?.id)
                    .eq('is_read', false);
            } else {
                // PERF: Only load last 50 messages for fast initial render
                // NOTE: Don't use join (sender:user_id) — no FK between prayer_group_messages and profiles
                const { data, error } = await supabase
                    .from('prayer_group_messages')
                    .select('*')
                    .eq('group_id', id)
                    .order('created_at', { ascending: false })
                    .limit(50);

                // Reverse so messages display oldest first
                if (error) throw error;
                if (data) data.reverse();

                // Batch-load sender profiles
                const senderIds = [...new Set((data || []).map((m: any) => m.user_id))];
                const { data: profiles } = senderIds.length > 0
                    ? await supabase
                        .from('profiles')
                        .select('id, full_name, avatar_url')
                        .in('id', senderIds)
                    : { data: [] };
                const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));

                // Track if there are more messages to load
                setHasMoreMessages((data || []).length >= 50);
                const mapped = (data || []).map((m: any) => ({
                    ...m,
                    sender_id: m.user_id,
                    sender: profileMap[m.user_id] || null,
                    is_read: true
                }));
                setMessages(mapped);

                // Feature 11: Cache group messages locally
                const toCacheGroup: CachedMessage[] = mapped.map((m: any) => ({
                    id: m.id,
                    group_id: id,
                    user_id: m.user_id,
                    sender_id: m.user_id,
                    content: m.content,
                    type: m.type,
                    voice_url: m.voice_url,
                    voice_duration: m.voice_duration,
                    file_url: m.file_url,
                    file_name: m.file_name,
                    file_type: m.file_type,
                    created_at: m.created_at,
                    sender_name: m.sender?.full_name,
                    sender_avatar: m.sender?.avatar_url,
                }));
                cacheMessages(toCacheGroup).catch(() => { });
            }
        } catch (e) {
            console.error('Error loading messages:', e);
        }
        setIsLoading(false);
    };

    // Load older messages when user scrolls/clicks "Load more"
    const loadOlderMessages = async () => {
        if (!selectedGroup || messages.length === 0 || isLoadingMore) return;
        setIsLoadingMore(true);
        try {
            const oldestMsg = messages[0];
            const { data, error } = await supabase
                .from('prayer_group_messages')
                .select('*')
                .eq('group_id', selectedGroup.id)
                .lt('created_at', oldestMsg.created_at)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            if (data) data.reverse();

            // Batch-load sender profiles
            const senderIds = [...new Set((data || []).map((m: any) => m.user_id))];
            const { data: profiles } = senderIds.length > 0
                ? await supabase.from('profiles').select('id, full_name, avatar_url').in('id', senderIds)
                : { data: [] };
            const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));

            setHasMoreMessages((data || []).length >= 50);
            const mapped = (data || []).map((m: any) => ({
                ...m,
                sender_id: m.user_id,
                sender: profileMap[m.user_id] || null,
                is_read: true
            }));
            setMessages(prev => [...mapped, ...prev]);
        } catch (e) {
            console.error('Error loading older messages:', e);
        }
        setIsLoadingMore(false);
    };

    // Send message — Feature 4: reply support
    const sendMessage = async () => {
        if (!newMessage.trim() || !user) return;

        const msgContent = replyingTo
            ? `↩️ **Réponse à ${replyingTo.sender?.full_name || 'message'}:**\n> ${replyingTo.content.slice(0, 100)}${replyingTo.content.length > 100 ? '...' : ''}\n\n${newMessage.trim()}`
            : newMessage.trim();
        setNewMessage('');
        setReplyingTo(null);
        setIsSending(true);
        try {
            if (view === 'conversation' && selectedConversation) {
                const { data, error } = await supabase
                    .from('direct_messages')
                    .insert({
                        conversation_id: selectedConversation.id,
                        sender_id: user.id,
                        content: msgContent,
                        type: 'text',
                        is_read: false
                    })
                    .select('*')
                    .single();

                if (error) throw error;

                // Update conversation's last message
                await supabase
                    .from('conversations')
                    .update({ last_message: msgContent, last_message_at: new Date().toISOString() })
                    .eq('id', selectedConversation.id);

                // Optimistic local add
                if (data) {
                    setMessages(prev => {
                        if (prev.find(m => m.id === data.id)) return prev;
                        return [...prev, {
                            ...data,
                            sender: { id: user.id, full_name: user.name, avatar_url: user.avatar || null }
                        }];
                    });
                }

                // Send notification to the conversation partner
                notifyDirectMessage({
                    recipientId: selectedConversation.participantId,
                    senderId: user.id,
                    senderName: user.name || 'Utilisateur',
                    messagePreview: msgContent,
                    conversationId: selectedConversation.id,
                });
            } else if (view === 'group' && selectedGroup) {
                const { data, error } = await supabase
                    .from('prayer_group_messages')
                    .insert({
                        group_id: selectedGroup.id,
                        user_id: user.id,
                        content: msgContent,
                        type: 'text'
                    })
                    .select('*')
                    .single();

                if (error) throw error;

                // Optimistic local add
                if (data) {
                    setMessages(prev => {
                        if (prev.find(m => m.id === data.id)) return prev;
                        return [...prev, {
                            ...data,
                            sender_id: data.user_id,
                            sender: { id: user.id, full_name: user.name, avatar_url: user.avatar || null },
                            is_read: true
                        }];
                    });
                }

                // Send notification to group members
                notifyGroupNewMessage({
                    groupId: selectedGroup.id,
                    groupName: selectedGroup.name,
                    senderId: user.id,
                    senderName: user.name || 'Utilisateur',
                    senderAvatar: user.avatar || undefined,
                    messagePreview: msgContent,
                }).catch(console.error);
            }

            inputRef.current?.focus();
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        } catch (e: any) {
            console.error('Error sending message:', e);
            toast.error('Erreur lors de l\'envoi');
            setNewMessage(msgContent);
        }
        setIsSending(false);
    };

    // Feature 7: Multi-file upload handler with progress
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
    // Feature 9: download permission toggle for shared files
    const [fileDownloadable, setFileDownloadable] = useState(true);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !user) return;
        e.target.value = ''; // Reset input

        const fileArray = Array.from(files);

        // Validate all files
        const validFiles = fileArray.filter(file => {
            if (file.size > 20 * 1024 * 1024) {
                toast.error(`${file.name} trop volumineux (max 20 Mo)`);
                return false;
            }
            return true;
        });

        if (validFiles.length === 0) return;

        // Feature 9: Ask the sender about download permissions
        const allowDownload = window.confirm(
            `📁 Envoyer ${validFiles.length} fichier(s) ?\n\nOK = Téléchargeable par tous\nAnnuler = Consultation uniquement (pas de téléchargement)`
        );
        setFileDownloadable(allowDownload);

        setIsUploadingFile(true);

        // Initialize progress for all files
        const initialProgress: Record<string, number> = {};
        validFiles.forEach(f => { initialProgress[f.name] = 0; });
        setUploadProgress(initialProgress);

        // Upload all files simultaneously
        const uploadPromises = validFiles.map(async (file) => {
            try {
                const ext = file.name.split('.').pop();
                const isImage = file.type.startsWith('image/');
                const timestamp = Date.now();
                const bucket = 'chat-files';
                const path = `${user.id}/${timestamp}_${Math.random().toString(36).slice(2)}.${ext}`;

                // Simulate progress via chunked tracking
                const progressInterval = setInterval(() => {
                    setUploadProgress(prev => {
                        const current = prev[file.name] || 0;
                        if (current < 90) {
                            return { ...prev, [file.name]: current + Math.random() * 15 };
                        }
                        return prev;
                    });
                }, 200);

                const { error: uploadErr } = await supabase.storage.from(bucket).upload(path, file, {
                    cacheControl: '3600',
                    upsert: false,
                });

                clearInterval(progressInterval);

                if (uploadErr) {
                    // Fallback to avatars bucket
                    const fallbackPath = `chat_files/${user.id}_${timestamp}_${Math.random().toString(36).slice(2)}.${ext}`;
                    const { error: fallbackErr } = await supabase.storage.from('avatars').upload(fallbackPath, file, {
                        cacheControl: '3600',
                        upsert: false,
                    });
                    if (fallbackErr) throw fallbackErr;
                    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fallbackPath);
                    setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
                    await sendFileMessage(urlData.publicUrl, file.name, file.type, isImage);
                } else {
                    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
                    setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
                    await sendFileMessage(urlData.publicUrl, file.name, file.type, isImage);
                }
            } catch (err) {
                console.error(`Error uploading ${file.name}:`, err);
                setUploadProgress(prev => ({ ...prev, [file.name]: -1 })); // -1 = error
                toast.error(`Erreur: ${file.name}`);
            }
        });

        await Promise.all(uploadPromises);

        const successCount = Object.values(uploadProgress).filter(v => v === 100).length;
        if (successCount > 0) {
            toast.success(`${validFiles.length} fichier(s) envoyé(s) !`);
        }

        // Clear progress after a delay
        setTimeout(() => setUploadProgress({}), 2000);
        setIsUploadingFile(false);
    };

    // Helper to send a file/image message — Feature 9: includes downloadable flag
    const sendFileMessage = async (fileUrl: string, fileName: string, fileType: string, isImage: boolean) => {
        if (!user) return;
        const msgType = isImage ? 'image' : 'file';
        const downloadLabel = fileDownloadable ? '' : ' 🔒';
        const content = isImage ? `🖼️ Image: ${fileName}${downloadLabel}` : `📎 ${fileName}${downloadLabel}`;

        if (view === 'conversation' && selectedConversation) {
            const { data, error } = await supabase
                .from('direct_messages')
                .insert({
                    conversation_id: selectedConversation.id,
                    sender_id: user.id,
                    content,
                    type: msgType,
                    image_url: isImage ? fileUrl : undefined,
                    is_read: false,
                })
                .select('*')
                .single();
            if (error) throw error;
            if (data) {
                setMessages(prev => [...prev, {
                    ...data,
                    file_url: fileUrl,
                    file_name: fileName,
                    file_type: fileType,
                    is_downloadable: fileDownloadable,
                    sender: { id: user.id, full_name: user.name, avatar_url: user.avatar || null },
                }]);
            }
            await supabase.from('conversations').update({ last_message: content, last_message_at: new Date().toISOString() }).eq('id', selectedConversation.id);
        } else if (view === 'group' && selectedGroup) {
            const { data, error } = await supabase
                .from('prayer_group_messages')
                .insert({
                    group_id: selectedGroup.id,
                    user_id: user.id,
                    content,
                    type: msgType,
                    image_url: isImage ? fileUrl : undefined,
                })
                .select('*')
                .single();
            if (error) throw error;
            if (data) {
                setMessages(prev => [...prev, {
                    ...data,
                    file_url: fileUrl,
                    file_name: fileName,
                    file_type: fileType,
                    is_downloadable: fileDownloadable,
                    sender_id: data.user_id,
                    sender: { id: user.id, full_name: user.name, avatar_url: user.avatar || null },
                    is_read: true,
                }]);
            }
        }
    };

    // Send voice message
    const sendVoiceMessage = async (audioBlob: Blob, duration: number) => {
        if (!user) return;

        setIsUploadingVoice(true);
        try {
            // Create unique filename
            const filename = `voice_${user.id}_${Date.now()}.webm`;
            const filePath = `voice-messages/${filename}`;

            // Upload to Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('chat-media')
                .upload(filePath, audioBlob, {
                    contentType: 'audio/webm',
                    cacheControl: '3600'
                });

            if (uploadError) {
                console.error('Upload error:', uploadError);
                // If bucket doesn't exist, create it first
                if (uploadError.message.includes('Bucket not found')) {
                    toast.error('Le stockage n\'est pas configuré. Contactez l\'administrateur.');
                    return;
                }
                throw uploadError;
            }

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('chat-media')
                .getPublicUrl(filePath);

            // Send message with voice URL
            if (view === 'conversation' && selectedConversation) {
                const { error } = await supabase
                    .from('direct_messages')
                    .insert({
                        conversation_id: selectedConversation.id,
                        sender_id: user.id,
                        content: '🎤 Message vocal',
                        type: 'voice',
                        voice_url: publicUrl,
                        voice_duration: duration,
                        is_read: false
                    });

                if (error) throw error;

                // Update conversation's last message
                await supabase
                    .from('conversations')
                    .update({ last_message: '🎤 Message vocal', last_message_at: new Date().toISOString() })
                    .eq('id', selectedConversation.id);

                // Send notification to conversation partner
                notifyDirectMessage({
                    recipientId: selectedConversation.participantId,
                    senderId: user.id,
                    senderName: user.name || 'Utilisateur',
                    messagePreview: '🎤 Message vocal',
                    conversationId: selectedConversation.id,
                });
            } else if (view === 'group' && selectedGroup) {
                const { error } = await supabase
                    .from('prayer_group_messages')
                    .insert({
                        group_id: selectedGroup.id,
                        user_id: user.id,
                        content: '🎤 Message vocal',
                        type: 'voice',
                        voice_url: publicUrl,
                        voice_duration: duration
                    });

                if (error) throw error;
            }

            toast.success('Message vocal envoyé!');
        } catch (e: any) {
            console.error('Error sending voice message:', e);
            toast.error('Erreur lors de l\'envoi du message vocal');
        }
        setIsUploadingVoice(false);
    };

    // Handle typing indicator
    const handleTyping = () => {
        if (!user) return;

        // Broadcast typing event
        const channelId = selectedConversation
            ? `conv_${[user.id, selectedConversation.participant.id].sort().join('_')}`
            : selectedGroup
                ? `group_${selectedGroup.id}`
                : null;

        if (channelId) {
            supabase.channel(`typing_${user.id}`).send({
                type: 'broadcast',
                event: 'typing',
                payload: { userId: user.id, userName: user.name, channelId }
            });
        }

        // Clear existing timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
    };

    // Handle emoji select
    const handleEmojiSelect = (emoji: string) => {
        setNewMessage(prev => prev + emoji);
        setShowEmojiPicker(false);
        inputRef.current?.focus();
    };

    // Voice recording
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];
            recordingTimeRef.current = 0;

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    audioChunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                stream.getTracks().forEach(track => track.stop());

                // Use ref to get real duration (state is stale in this closure)
                const duration = recordingTimeRef.current;
                if (audioBlob.size > 0 && duration > 0) {
                    await sendVoiceMessage(audioBlob, duration);
                }
            };

            mediaRecorder.start(100); // Collect data every 100ms
            setIsRecording(true);
            setRecordingTime(0);

            // Track recording time - sync both state and ref
            recordingIntervalRef.current = setInterval(() => {
                recordingTimeRef.current += 1;
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (e) {
            console.error('Error starting recording:', e);
            toast.error('Impossible d\'accéder au microphone');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setIsPaused(false);

            if (recordingIntervalRef.current) {
                clearInterval(recordingIntervalRef.current);
                recordingIntervalRef.current = null;
            }
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            audioChunksRef.current = []; // Clear chunks to not send
            setIsRecording(false);
            setIsPaused(false);
            setRecordingTime(0);

            if (recordingIntervalRef.current) {
                clearInterval(recordingIntervalRef.current);
                recordingIntervalRef.current = null;
            }

            toast.info('Enregistrement annulé');
        }
    };

    // Pause / Resume recording
    const pauseRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.pause();
            setIsPaused(true);
            if (recordingIntervalRef.current) {
                clearInterval(recordingIntervalRef.current);
                recordingIntervalRef.current = null;
            }
        }
    };

    const resumeRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
            mediaRecorderRef.current.resume();
            setIsPaused(false);
            recordingIntervalRef.current = setInterval(() => {
                recordingTimeRef.current += 1;
                setRecordingTime(prev => prev + 1);
            }, 1000);
        }
    };

    // Delete message (WhatsApp style)
    const deleteMessage = async (msg: Message, forEveryone: boolean) => {
        if (!user) return;
        try {
            if (forEveryone) {
                // Delete for everyone — only sender can do this
                if (msg.sender_id !== user.id) {
                    toast.error('Vous ne pouvez supprimer que vos propres messages pour tout le monde');
                    return;
                }
                const table = view === 'group' ? 'prayer_group_messages' : 'direct_messages';
                await supabase.from(table).delete().eq('id', msg.id);
                setMessages(prev => prev.filter(m => m.id !== msg.id));
                toast.success('Message supprimé pour tout le monde');
            } else {
                // Delete for me — just remove from local view
                setMessages(prev => prev.filter(m => m.id !== msg.id));
                toast.success('Message supprimé chez vous');
            }
        } catch (e: any) {
            toast.error('Erreur : ' + (e.message || 'Impossible de supprimer'));
        }
    };

    // Open conversation
    const openConversation = (conv: Conversation) => {
        setSelectedConversation(conv);
        setSelectedGroup(null);
        setView('conversation');
        loadMessages('conversation', conv.id);
    };

    // Open group — Feature 6: Parallel loading with Promise.all
    const openGroup = (group: ChatGroup) => {
        setSelectedGroup(group);
        setSelectedConversation(null);
        setView('group');
        setShowGroupTools(false);
        setGroupToolUnread(0);
        setReplyingTo(null);

        // Feature 6: Load messages AND members in parallel
        Promise.all([
            loadMessages('group', group.id),
            loadGroupMembers(group.id)
        ]);

        // Load pinned prayer from group description
        if (group.description?.startsWith('📌')) {
            setPinnedPrayer(group.description.replace('📌 ', ''));
        } else {
            setPinnedPrayer(null);
        }

        // Start polling fallback for group messages (every 5s, was 3s — less CPU)
        if (groupPollRef.current) clearInterval(groupPollRef.current);
        groupPollRef.current = setInterval(async () => {
            try {
                const { data, error } = await supabase
                    .from('prayer_group_messages')
                    .select('*')
                    .eq('group_id', group.id)
                    .order('created_at', { ascending: true });
                if (!error && data) {
                    // Batch-load sender profiles for poll
                    const ids = [...new Set(data.map((m: any) => m.user_id))];
                    const { data: profs } = ids.length > 0
                        ? await supabase.from('profiles').select('id, full_name, avatar_url').in('id', ids)
                        : { data: [] };
                    const pMap = Object.fromEntries((profs || []).map((p: any) => [p.id, p]));
                    setMessages(prev => {
                        const prevLastId = prev.length > 0 ? prev[prev.length - 1].id : null;
                        const newLastId = data.length > 0 ? data[data.length - 1].id : null;
                        if (prevLastId === newLastId && data.length === prev.length) return prev;
                        return data.map((m: any) => ({
                            ...m,
                            sender_id: m.user_id,
                            sender: pMap[m.user_id] || null,
                            is_read: true
                        }));
                    });
                }
            } catch { }
        }, 5000);
    };

    // Effect to handle deferred group opening (runs after loadMessages/loadGroupMembers are defined)
    useEffect(() => {
        if (pendingGroupIdRef.current && selectedGroup && selectedGroup.id === pendingGroupIdRef.current && view === 'group') {
            const gId = pendingGroupIdRef.current;
            pendingGroupIdRef.current = null;
            console.log('[WhatsAppChat] Loading messages & members for deferred group:', selectedGroup.name);
            loadMessages('group', gId);
            loadGroupMembers(gId);
            setShowGroupTools(false);

            // Load pinned prayer from group description
            if (selectedGroup.description?.startsWith('📌')) {
                setPinnedPrayer(selectedGroup.description.replace('📌 ', ''));
            } else {
                setPinnedPrayer(null);
            }

            // Feature 11: Detect tool/prayer messages and create floating bubbles with content
            setFloatingItems([]); // Clear previous group's bubbles
            (async () => {
                try {
                    const { data: recentMsgs } = await supabase
                        .from('prayer_group_messages')
                        .select('id, content, type, created_at')
                        .eq('group_id', gId)
                        .order('created_at', { ascending: false })
                        .limit(50);

                    if (recentMsgs) {
                        const bubbles: typeof floatingItems = [];
                        for (const m of recentMsgs) {
                            const c = m.content || '';
                            // Pinned prayer
                            if (c.includes('📌') && c.includes('SUJET DE PRIÈRE')) {
                                bubbles.push({ id: `bubble-${m.id}`, type: 'prayer', title: 'Sujet de prière épinglé', icon: '🙏', content: c });
                            }
                            // Bible passage
                            else if (c.startsWith('📖')) {
                                bubbles.push({ id: `bubble-${m.id}`, type: 'bible', title: 'Passage Bible partagé', icon: '📖', content: c });
                            }
                            // Announcement
                            else if (c.includes('📢') && c.includes('ANNONCE')) {
                                bubbles.push({ id: `bubble-${m.id}`, type: 'tool', title: 'Annonce du groupe', icon: '📢', content: c });
                            }
                            // Fasting program
                            else if (c.includes('🕐') && c.includes('PROGRAMME DE JEÛNE')) {
                                bubbles.push({ id: `bubble-${m.id}`, type: 'tool', title: 'Programme de jeûne', icon: '🕐', content: c });
                            }
                            // Event
                            else if (c.includes('📅') && c.includes('ÉVÉNEMENT')) {
                                bubbles.push({ id: `bubble-${m.id}`, type: 'group', title: 'Événement planifié', icon: '📅', content: c });
                            }
                            // Meet link (just the URL)
                            else if (c.includes('meet.google.com/')) {
                                bubbles.push({ id: `bubble-${m.id}`, type: 'group', title: 'Réunion Meet', icon: '📹', content: c });
                            }
                            if (bubbles.length >= 5) break; // Max 5 bubbles
                        }
                        setFloatingItems(bubbles);
                    }
                } catch { /* ignore */ }
            })();

            // Start polling fallback for group messages
            if (groupPollRef.current) clearInterval(groupPollRef.current);
            groupPollRef.current = setInterval(async () => {
                try {
                    const { data, error } = await supabase
                        .from('prayer_group_messages')
                        .select('*')
                        .eq('group_id', gId)
                        .order('created_at', { ascending: true });
                    if (!error && data) {
                        // Batch-load sender profiles for poll
                        const ids = [...new Set(data.map((m: any) => m.user_id))];
                        const { data: profs } = ids.length > 0
                            ? await supabase.from('profiles').select('id, full_name, avatar_url').in('id', ids)
                            : { data: [] };
                        const pMap = Object.fromEntries((profs || []).map((p: any) => [p.id, p]));
                        setMessages(prev => {
                            const prevLastId = prev.length > 0 ? prev[prev.length - 1].id : null;
                            const newLastId = data.length > 0 ? data[data.length - 1].id : null;
                            if (prevLastId === newLastId && data.length === prev.length) return prev;
                            return data.map((m: any) => ({
                                ...m,
                                sender_id: m.user_id,
                                sender: pMap[m.user_id] || null,
                                is_read: true
                            }));
                        });
                    }
                } catch { }
            }, 3000);
        }
    }, [selectedGroup, view]);

    // Incoming call listener - listen for calls from other users
    useEffect(() => {
        if (!user?.id) return;

        const callSignalChannel = supabase.channel(`call_signal_${user.id}`, {
            config: { broadcast: { self: false } }
        });

        callSignalChannel.on('broadcast', { event: 'incoming-call' }, ({ payload }) => {
            console.log('[WhatsAppChat] Incoming call from:', payload.callerName);
            setIncomingCall({
                callerName: payload.callerName,
                callerAvatar: payload.callerAvatar,
                callType: payload.callType || 'audio',
                callerId: payload.callerId,
                mode: payload.mode || (payload.groupId ? 'group' : 'private'),
                conversationId: payload.conversationId,
                groupId: payload.groupId,
                groupName: payload.groupName,
            });
        });

        callSignalChannel.on('broadcast', { event: 'call-cancelled' }, ({ payload }) => {
            if (payload.callerId) {
                setIncomingCall(null);
            }
        });

        callSignalChannel.subscribe();

        return () => {
            supabase.removeChannel(callSignalChannel);
        };
    }, [user?.id]);

    // Cleanup polling when going back
    const goBackToList = () => {
        if (groupPollRef.current) {
            clearInterval(groupPollRef.current);
            groupPollRef.current = null;
        }
        setView('list');
        setShowGroupTools(false);
        setShowGroupMembers(false);
    };

    // Start new conversation - creates it in Supabase
    const startNewConversation = async (targetUser: ChatUser) => {
        if (!user) return;
        try {
            let convId: string | null = null;

            // Try RPC first
            const { data: rpcData, error: rpcError } = await supabase
                .rpc('get_or_create_conversation', { other_user_id: targetUser.id });

            if (!rpcError && rpcData) {
                convId = rpcData;
            } else {
                // Fallback: check if conversation exists
                const { data: existing } = await supabase
                    .from('conversations')
                    .select('id')
                    .or(`and(participant1_id.eq.${user.id},participant2_id.eq.${targetUser.id}),and(participant1_id.eq.${targetUser.id},participant2_id.eq.${user.id})`)
                    .maybeSingle();

                if (existing) {
                    convId = existing.id;
                } else {
                    // Create new conversation
                    const { data: newConv, error: insertError } = await supabase
                        .from('conversations')
                        .insert({
                            participant1_id: user.id,
                            participant2_id: targetUser.id,
                            last_message_at: new Date().toISOString()
                        })
                        .select('id')
                        .single();

                    if (insertError) throw insertError;
                    convId = newConv?.id || null;
                }
            }

            if (!convId) {
                toast.error('Impossible de créer la conversation');
                return;
            }

            const conv: Conversation = {
                id: convId,
                participantId: targetUser.id,
                participant: targetUser,
                lastMessage: '',
                lastMessageAt: new Date().toISOString(),
                unreadCount: 0
            };
            setSelectedConversation(conv);
            setView('conversation');
            setShowNewConversation(false);
            setMessages([]);
        } catch (e) {
            console.error('Error creating conversation:', e);
            toast.error('Erreur lors de la création de la conversation');
        }
    };

    // renderMessageContent — now handled by ChatMessageBubble component

    // Count online members — ONLY use Presence channel (onlineUsers), NOT stale DB is_online
    const onlineMembersCount = groupMembers.filter(m => onlineUsers[m.id]).length;

    // Check if current user is admin/creator
    const isGroupAdmin = selectedGroup && (
        selectedGroup.created_by === user?.id ||
        groupMembers.find(m => m.id === user?.id)?.role === 'admin'
    );

    // Upload group photo
    const handleGroupPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedGroup || !user) return;
        // Only admin/creator can change group photo
        if (!isGroupAdmin) {
            toast.error('Seul l\'administrateur peut changer la photo du groupe');
            return;
        }
        setIsUploadingGroupPhoto(true);
        try {
            const ext = file.name.split('.').pop();
            const path = `group_avatars/${selectedGroup.id}.${ext}`;
            const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
            if (uploadErr) throw uploadErr;
            const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
            const avatarUrl = urlData.publicUrl + `?t=${Date.now()}`;
            await supabase.from('prayer_groups').update({ avatar_url: avatarUrl }).eq('id', selectedGroup.id);
            setSelectedGroup({ ...selectedGroup, avatar_url: avatarUrl });
            toast.success('Photo du groupe mise à jour!');
        } catch (err) {
            console.error('Error uploading group photo:', err);
            toast.error('Erreur lors de l\'upload');
        }
        setIsUploadingGroupPhoto(false);
    };

    // Remove member from group
    const handleRemoveMember = async (memberId: string) => {
        if (!selectedGroup || !user) return;
        if (memberId === user.id) { toast.error('Vous ne pouvez pas vous retirer vous-même'); return; }
        try {
            await supabase.from('prayer_group_members').delete()
                .eq('group_id', selectedGroup.id).eq('user_id', memberId);
            setGroupMembers(prev => prev.filter(m => m.id !== memberId));
            toast.success('Membre retiré');
        } catch (err) {
            toast.error('Erreur lors du retrait');
        }
    };

    // Add member to group
    const handleAddMember = async (userId: string) => {
        if (!selectedGroup) return;
        try {
            const existing = groupMembers.find(m => m.id === userId);
            if (existing) { toast.info('Déjà membre'); return; }
            await supabase.from('prayer_group_members').insert({
                group_id: selectedGroup.id,
                user_id: userId,
                role: 'member'
            });
            await loadGroupMembers(selectedGroup.id);
            toast.success('Membre ajouté!');
        } catch (err) {
            toast.error('Erreur lors de l\'ajout');
        }
    };

    // Promote member to admin
    const handlePromoteAdmin = async (memberId: string) => {
        if (!selectedGroup) return;
        try {
            await supabase.from('prayer_group_members')
                .update({ role: 'admin' })
                .eq('group_id', selectedGroup.id).eq('user_id', memberId);
            setGroupMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: 'admin' } : m));
            toast.success('Membre promu admin!');
        } catch (err) {
            toast.error('Erreur lors de la promotion');
        }
    };

    // Insert @mention into message
    const insertMention = (memberName: string) => {
        const mentionText = `@${memberName} `;
        const curVal = newMessage;
        const atIdx = curVal.lastIndexOf('@');
        const newVal = atIdx >= 0 ? curVal.slice(0, atIdx) + mentionText : curVal + mentionText;
        setNewMessage(newVal);
        setShowMentions(false);
        inputRef.current?.focus();
    };

    // Handle message input change with @mention detection
    const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setNewMessage(val);
        handleTyping();
        // Detect @mention
        const lastAt = val.lastIndexOf('@');
        if (lastAt >= 0 && view === 'group') {
            const afterAt = val.slice(lastAt + 1);
            if (!afterAt.includes(' ') && afterAt.length <= 30) {
                setMentionFilter(afterAt.toLowerCase());
                setShowMentions(true);
                return;
            }
        }
        setShowMentions(false);
    };

    // Bible tool: fetch passage from local /bible/ files
    const fetchBiblePassage = async () => {
        if (!bibleReference.trim()) { toast.error('Entrez une référence (ex: Jean 3:16)'); return; }
        setIsFetchingBible(true);
        try {
            // Parse reference: "Jean 3:16" => book=jean, chapter=3, verse=16
            // Also handle "Jean 3:16-18" and "Jean 3" (whole chapter)
            const refMatch = bibleReference.trim().match(/^(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/i);
            if (!refMatch) {
                setBibleContent('[Référence invalide. Utilisez le format: Livre Chapitre:Verset (ex: Jean 3:16)]');
                setIsFetchingBible(false);
                return;
            }

            const bookRaw = refMatch[1].trim();
            const chapter = refMatch[2];
            const verseStart = refMatch[3] ? parseInt(refMatch[3]) : null;
            const verseEnd = refMatch[4] ? parseInt(refMatch[4]) : verseStart;

            // Normalize book name for file lookup
            const bookKey = normalizeBibleBookName(bookRaw);
            const fileName = `${bookKey}_${chapter}.txt`;

            const res = await fetch(`/bible/${fileName}`);
            if (!res.ok) {
                setBibleContent(`[Passage non trouvé. Vérifiez le livre "${bookRaw}" et le chapitre ${chapter}.]`);
                setIsFetchingBible(false);
                return;
            }

            const text = await res.text();
            const lines = text.split('\n').filter(l => l.trim());

            if (verseStart !== null && verseEnd !== null) {
                // Extract specific verses
                const selectedVerses = lines.filter(line => {
                    const vMatch = line.match(/^(\d+)\s/);
                    if (!vMatch) return false;
                    const vNum = parseInt(vMatch[1]);
                    return vNum >= verseStart && vNum <= verseEnd;
                });
                setBibleContent(selectedVerses.length > 0 ? selectedVerses.join('\n') : 'Verset(s) non trouvé(s)');
            } else {
                // Whole chapter
                setBibleContent(lines.join('\n'));
            }
        } catch (e) {
            console.error('Error fetching Bible passage:', e);
            setBibleContent(`[Passage non trouvé ou erreur. Vérifiez la référence.]`);
            toast.error("Impossible de récupérer le passage. Vérifiez la référence.");
        }
        setIsFetchingBible(false);
    };

    // Bible tool: share passage to group
    const shareBiblePassage = async () => {
        if (!bibleContent || !selectedGroup || !user) return;
        const msgContent = `📖 **${bibleReference}** (${bibleVersion})\n\n${bibleContent}`;
        try {
            const { data, error } = await supabase
                .from('prayer_group_messages')
                .insert({
                    group_id: selectedGroup.id,
                    user_id: user.id,
                    content: msgContent,
                    type: 'text'
                })
                .select('*')
                .single();
            if (error) throw error;
            if (data) {
                setMessages(prev => [...prev, {
                    ...data,
                    sender_id: data.user_id,
                    sender: { id: user.id, full_name: user.name, avatar_url: user.avatar || null },
                    is_read: true
                }]);
            }
            setShowBibleTool(false);
            setBibleReference('');
            setBibleContent('');
            toast.success('Passage partagé dans le groupe !');
        } catch { toast.error('Erreur lors du partage'); }
    };

    // Bible share dialog: send verse to conversation or group
    const handleBibleShareVerse = async (text: string) => {
        if (!user) return;
        try {
            if (view === 'conversation' && selectedConversation) {
                const { data, error } = await supabase
                    .from('direct_messages')
                    .insert({
                        conversation_id: selectedConversation.id,
                        sender_id: user.id,
                        content: text,
                        type: 'text',
                        is_read: false
                    })
                    .select('*')
                    .single();
                if (error) throw error;
                if (data) {
                    setMessages(prev => {
                        if (prev.find(m => m.id === data.id)) return prev;
                        return [...prev, {
                            ...data,
                            sender: { id: user.id, full_name: user.name, avatar_url: user.avatar || null }
                        }];
                    });
                }
                await supabase.from('conversations')
                    .update({ last_message: text.substring(0, 100), last_message_at: new Date().toISOString() })
                    .eq('id', selectedConversation.id);
                notifyDirectMessage({
                    recipientId: selectedConversation.participantId,
                    senderId: user.id,
                    senderName: user.name || 'Utilisateur',
                    messagePreview: '📖 Verset biblique partagé',
                    conversationId: selectedConversation.id,
                });
                toast.success('Verset partagé !');
            } else if (view === 'group' && selectedGroup) {
                const { data, error } = await supabase
                    .from('prayer_group_messages')
                    .insert({
                        group_id: selectedGroup.id,
                        user_id: user.id,
                        content: text,
                        type: 'text'
                    })
                    .select('*')
                    .single();
                if (error) throw error;
                if (data) {
                    setMessages(prev => {
                        if (prev.find(m => m.id === data.id)) return prev;
                        return [...prev, {
                            ...data,
                            sender_id: data.user_id,
                            sender: { id: user.id, full_name: user.name, avatar_url: user.avatar || null },
                            is_read: true
                        }];
                    });
                }
                toast.success('Verset partagé dans le groupe !');
            }
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        } catch (e) {
            console.error('Error sharing Bible verse:', e);
            toast.error('Erreur lors du partage');
        }
    };

    // Initialize fasting days
    const initFastingDays = (count: number) => {
        const days = Array.from({ length: count }, (_, i) => ({
            title: `Jour ${i + 1}`,
            theme: '',
            reference: '',
            passage: '',
            meditation: '',
            action: '',
            prayers: ''
        }));
        setFastingDays(days);
    };

    // Share fasting program to group
    const shareFastingProgram = async () => {
        if (!fastingTheme || !selectedGroup || !user) return;
        let content = `🕊️ **PROGRAMME DE JEÛNE ET PRIÈRE**\n\n`;
        content += `📌 Thème: ${fastingTheme}\n`;
        content += `⏱️ Durée: ${fastingDuration} jours\n\n`;
        content += `---\n\n`;

        for (const day of fastingDays) {
            if (day.theme || day.reference) {
                content += `📅 **${day.title}**\n`;
                if (day.theme) content += `🎯 Thème: ${day.theme}\n`;
                if (day.reference) content += `📖 Référence: ${day.reference}\n`;
                if (day.passage) content += `✍️ Passage: ${day.passage}\n`;
                if (day.meditation) content += `🧘 Méditation: ${day.meditation}\n`;
                if (day.action) content += `💪 Action pratique: ${day.action}\n`;
                if (day.prayers) content += `🙏 Sujets de prière: ${day.prayers}\n`;
                content += `\n`;
            }
        }

        try {
            const { data, error } = await supabase
                .from('prayer_group_messages')
                .insert({
                    group_id: selectedGroup.id,
                    user_id: user.id,
                    content,
                    type: 'text'
                })
                .select('*')
                .single();
            if (error) throw error;
            if (data) {
                setMessages(prev => [...prev, {
                    ...data,
                    sender_id: data.user_id,
                    sender: { id: user.id, full_name: user.name, avatar_url: user.avatar || null },
                    is_read: true
                }]);
            }
            setShowFastingTool(false);
            setFastingTheme('');
            setFastingDays([]);
            toast.success('Programme de jeûne partagé !');
        } catch { toast.error('Erreur lors du partage'); }
    };

    // Send announcement to group
    const sendAnnouncement = async () => {
        if (!announcementText.trim() || !selectedGroup || !user) return;
        const content = `📢 **ANNONCE IMPORTANTE** 📢\n\n${announcementText.trim()}\n\n— ${user.name || 'Admin'}`;
        try {
            const { data, error } = await supabase
                .from('prayer_group_messages')
                .insert({
                    group_id: selectedGroup.id,
                    user_id: user.id,
                    content,
                    type: 'text'
                })
                .select('*')
                .single();
            if (error) throw error;
            if (data) {
                setMessages(prev => [...prev, {
                    ...data,
                    sender_id: data.user_id,
                    sender: { id: user.id, full_name: user.name, avatar_url: user.avatar || null },
                    is_read: true
                }]);
            }
            setShowAnnouncementTool(false);
            setAnnouncementText('');
            toast.success('Annonce envoyée !');
        } catch { toast.error("Erreur lors de l'envoi"); }
    };

    // Pin a prayer subject
    const setPinnedPrayerSubject = async () => {
        if (!pinText.trim() || !selectedGroup || !user) return;
        try {
            await supabase.from('prayer_groups').update({
                description: `📌 ${pinText.trim()}`
            }).eq('id', selectedGroup.id);

            setPinnedPrayer(pinText.trim());

            const content = `📌 **SUJET DE PRIÈRE ÉPINGLÉ** 📌\n\n🙏 ${pinText.trim()}\n\nPriez pour ce sujet !`;
            const { data, error } = await supabase
                .from('prayer_group_messages')
                .insert({
                    group_id: selectedGroup.id,
                    user_id: user.id,
                    content,
                    type: 'text'
                })
                .select('*')
                .single();
            if (error) throw error;
            if (data) {
                setMessages(prev => [...prev, {
                    ...data,
                    sender_id: data.user_id,
                    sender: { id: user.id, full_name: user.name, avatar_url: user.avatar || null },
                    is_read: true
                }]);
            }
            setShowPinTool(false);
            toast.success('Sujet de prière épinglé !');
        } catch { toast.error("Erreur lors de l'épinglage"); }
    };

    // Create a new prayer group (replaces window.prompt)
    const handleCreateGroup = async () => {
        if (!newGroupName.trim() || !user) return;
        setIsCreatingGroup(true);
        try {
            const { data, error } = await supabase
                .from('prayer_groups')
                .insert({
                    name: newGroupName.trim(),
                    created_by: user.id,
                    is_open: true,
                    member_count: 1,
                })
                .select('*')
                .single();
            if (error) throw error;
            if (data) {
                // Add creator as admin member
                await supabase.from('prayer_group_members').insert({
                    group_id: data.id,
                    user_id: user.id,
                    role: 'admin',
                });
                setGroups(prev => [data, ...prev]);
                toast.success('Groupe créé ! 🎉');
            }
            setShowCreateGroupDialog(false);
            setNewGroupName('');
        } catch (e: any) {
            console.error('Error creating group:', e);
            toast.error('Erreur: ' + (e?.message || 'Impossible de créer le groupe'));
        } finally {
            setIsCreatingGroup(false);
        }
    };

    // Send event to group
    const sendEventToGroup = async () => {
        if (!eventTitle.trim() || !eventDate || !selectedGroup || !user) return;
        const dateStr = new Date(eventDate).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        let content = `📅 **ÉVÉNEMENT PLANIFIÉ** 📅\n\n`;
        content += `📌 ${eventTitle.trim()}\n`;
        content += `🗓️ Date: ${dateStr}\n`;
        if (eventTime) content += `🕐 Heure: ${eventTime}\n`;
        if (eventDescription.trim()) content += `\n📝 ${eventDescription.trim()}\n`;
        content += `\n👥 Tous les membres sont invités !`;

        try {
            const { data, error } = await supabase
                .from('prayer_group_messages')
                .insert({
                    group_id: selectedGroup.id,
                    user_id: user.id,
                    content,
                    type: 'text'
                })
                .select('*')
                .single();
            if (error) throw error;
            if (data) {
                setMessages(prev => [...prev, {
                    ...data,
                    sender_id: data.user_id,
                    sender: { id: user.id, full_name: user.name, avatar_url: user.avatar || null },
                    is_read: true
                }]);
            }
            setShowEventTool(false);
            toast.success('Événement planifié et partagé !');
        } catch { toast.error("Erreur lors du partage"); }
    };

    // Migrate all members from current group to a target group
    const migrateGroupMembers = async () => {
        if (!migrateTargetName.trim() || !selectedGroup || !user) return;
        setIsMigratingMembers(true);
        try {
            const { data: targetGroups, error: findErr } = await supabase
                .from('prayer_groups')
                .select('id, name')
                .ilike('name', `%${migrateTargetName.trim()}%`)
                .limit(1);

            if (findErr || !targetGroups || targetGroups.length === 0) {
                toast.error('Groupe cible introuvable');
                setIsMigratingMembers(false);
                return;
            }

            const targetGroup = targetGroups[0];
            if (targetGroup.id === selectedGroup.id) {
                toast.error('Impossible de migrer vers le même groupe');
                setIsMigratingMembers(false);
                return;
            }

            const { data: currentMembers } = await supabase
                .from('prayer_group_members')
                .select('user_id')
                .eq('group_id', selectedGroup.id);

            const { data: existingMembers } = await supabase
                .from('prayer_group_members')
                .select('user_id')
                .eq('group_id', targetGroup.id);

            const existingIds = new Set((existingMembers || []).map((m: any) => m.user_id));
            const toMigrate = (currentMembers || []).filter((m: any) => !existingIds.has(m.user_id));

            if (toMigrate.length === 0) {
                toast.info('Tous les membres sont déjà dans le groupe cible');
                setIsMigratingMembers(false);
                return;
            }

            const { error: insertErr } = await supabase
                .from('prayer_group_members')
                .insert(toMigrate.map((m: any) => ({
                    group_id: targetGroup.id,
                    user_id: m.user_id,
                    role: 'member'
                })));

            if (insertErr) throw insertErr;

            const content = `🔄 **MIGRATION** 🔄\n\n${toMigrate.length} membres ont été migrés vers "${targetGroup.name}".`;
            await supabase.from('prayer_group_messages').insert({
                group_id: selectedGroup.id,
                user_id: user.id,
                content,
                type: 'text'
            });

            setShowMigrateTool(false);
            setMigrateTargetName('');
            toast.success(`${toMigrate.length} membres migrés !`);
        } catch (err: any) {
            toast.error('Erreur: ' + (err.message || ''));
        }
        setIsMigratingMembers(false);
    };

    if (!user) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">Connectez-vous pour accéder au chat</p>
            </div>
        );
    }

    // Conversation/Group View — declare early to avoid 'used before declaration' errors
    const currentRecipient = view === 'conversation' ? selectedConversation?.participant : null;
    const currentGroup = view === 'group' ? selectedGroup : null;

    // List View (WhatsApp-style)
    // Call history view
    if (view === 'call_history') {
        return (
            <div className="flex flex-col h-full w-full max-w-full overflow-hidden">
                <CallHistory
                    userId={user.id}
                    userName={user.name || 'Utilisateur'}
                    onBack={() => setView('list')}
                    onCall={(type, contactId, contactName, contactAvatar) => {
                        // Find or create a conversation with this user, then start the call
                        const conv = conversations.find(c => c.participantId === contactId);
                        if (conv) {
                            setSelectedConversation(conv);
                        }
                        setActiveCall({ type, mode: 'private' });
                        setView('conversation');
                    }}
                />

                {/* WebRTC Call Overlay */}
                {activeCall && (
                    <WebRTCCall
                        user={{ id: user.id, name: user.name || 'Utilisateur', avatar: user.avatar }}
                        callType={activeCall.type}
                        mode={activeCall.mode}
                        remoteUser={activeCall.mode === 'private' && currentRecipient ? {
                            id: currentRecipient.id,
                            name: currentRecipient.full_name || 'Utilisateur',
                            avatar: currentRecipient.avatar_url || undefined
                        } : undefined}
                        conversationId={activeCall.mode === 'private' ? selectedConversation?.id : undefined}
                        groupId={activeCall.mode === 'group' ? currentGroup?.id : undefined}
                        groupName={activeCall.mode === 'group' ? currentGroup?.name : undefined}
                        groupMembers={activeCall.mode === 'group' ? groupMembers.map(m => ({ id: m.id, full_name: m.full_name || 'Membre', avatar_url: m.avatar_url })) : undefined}
                        isIncoming={activeCall.isIncoming}
                        onEnd={() => setActiveCall(null)}
                    />
                )}

                {/* Incoming Call Notification */}
                {incomingCall && !activeCall && (
                    <IncomingCallOverlay
                        call={incomingCall}
                        onAccept={() => {
                            setActiveCall({
                                type: incomingCall.callType,
                                mode: 'private',
                                isIncoming: true
                            });
                            setIncomingCall(null);
                        }}
                        onReject={() => setIncomingCall(null)}
                    />
                )}
            </div>
        );
    }


    if (view === 'list') {
        return (
            <div className="flex flex-col h-full w-full max-w-full overflow-hidden bg-linear-to-b from-slate-900 to-slate-950">
                {/* Header */}
                <div className="p-4 border-b border-white/10">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-white">Messages</h2>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setView('call_history')}
                                className="text-slate-400 hover:text-green-400 hover:bg-green-500/10 rounded-full"
                                title="Historique des appels"
                            >
                                <Phone className="h-5 w-5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleManualRefresh}
                                disabled={isLoading}
                                className="text-slate-400 hover:text-white"
                            >
                                <Loader2 className={cn("h-5 w-5", isLoading && "animate-spin")} />
                            </Button>
                        </div>
                    </div>

                    {/* Tabs - responsive scroll on mobile */}
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
                        <Button
                            variant={activeTab === 'conversations' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setActiveTab('conversations')}
                            className={cn(
                                "rounded-full shrink-0 text-xs sm:text-sm",
                                activeTab === 'conversations' && "bg-indigo-600"
                            )}
                        >
                            <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                            Privés
                            {conversations.reduce((acc, c) => acc + c.unreadCount, 0) > 0 && (
                                <Badge className="ml-1 bg-red-500 text-white h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px]">
                                    {conversations.reduce((acc, c) => acc + c.unreadCount, 0)}
                                </Badge>
                            )}
                        </Button>
                        <Button
                            variant={activeTab === 'groups' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setActiveTab('groups')}
                            className={cn(
                                "rounded-full shrink-0 text-xs sm:text-sm",
                                activeTab === 'groups' && "bg-indigo-600"
                            )}
                        >
                            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                            Groupes
                        </Button>
                        <Button
                            variant={activeTab === 'admin_groups' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setActiveTab('admin_groups')}
                            className={cn(
                                "rounded-full shrink-0 text-xs sm:text-sm",
                                activeTab === 'admin_groups' && "bg-purple-600"
                            )}
                        >
                            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                            Officiels
                        </Button>
                    </div>
                </div>

                {/* Content */}
                <ScrollArea className="flex-1">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                        </div>
                    ) : activeTab === 'conversations' ? (
                        <div className="divide-y divide-white/5">
                            {/* New conversation button */}
                            <button
                                onClick={() => {
                                    setShowNewConversation(true);
                                    loadAllUsers();
                                }}
                                className="w-full p-4 flex items-center gap-3 hover:bg-white/5 transition-colors"
                            >
                                <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center">
                                    <Plus className="h-6 w-6 text-white" />
                                </div>
                                <span className="text-indigo-400 font-medium">Nouvelle conversation</span>
                            </button>

                            {conversations.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                    <p>Aucune conversation</p>
                                </div>
                            ) : (
                                conversations.map(conv => (
                                    <button
                                        key={conv.id}
                                        onClick={() => openConversation(conv)}
                                        className="w-full p-3 sm:p-4 flex items-center gap-3 hover:bg-white/5 transition-colors text-left overflow-hidden"
                                    >
                                        <div className="relative">
                                            <Avatar className="h-12 w-12">
                                                <AvatarImage src={conv.participant.avatar_url || undefined} />
                                                <AvatarFallback className="bg-linear-to-br from-indigo-500 to-purple-500 text-white">
                                                    {getInitials(conv.participant.full_name)}
                                                </AvatarFallback>
                                            </Avatar>
                                            {onlineUsers[conv.participant.id] && (
                                                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-900" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0 overflow-hidden">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-medium text-white truncate text-sm sm:text-base">
                                                    {conv.participant.full_name || 'Utilisateur'}
                                                </span>
                                                <span className="text-[10px] sm:text-xs text-slate-500 shrink-0">
                                                    {formatTime(conv.lastMessageAt)}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-xs sm:text-sm text-slate-400 truncate">
                                                    {conv.lastMessage}
                                                </p>
                                                {conv.unreadCount > 0 && (
                                                    <Badge className="bg-indigo-600 text-white h-5 min-w-5 flex items-center justify-center rounded-full text-xs shrink-0">
                                                        {conv.unreadCount}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    ) : activeTab === 'groups' ? (
                        <div className="p-3 space-y-4">
                            {/* Search bar for groups */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Rechercher un groupe..."
                                    value={groupSearchQuery}
                                    onChange={(e) => setGroupSearchQuery(e.target.value)}
                                    className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-slate-500 h-10 rounded-xl"
                                />
                                {groupSearchQuery && (
                                    <button
                                        onClick={() => setGroupSearchQuery('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                            {/* Create group button */}
                            <button
                                onClick={() => {
                                    setNewGroupName('');
                                    setShowCreateGroupDialog(true);
                                }}
                                className="w-full p-4 flex items-center gap-3 hover:bg-white/5 transition-colors rounded-xl"
                            >
                                <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center">
                                    <Plus className="h-6 w-6 text-white" />
                                </div>
                                <span className="text-green-400 font-medium">Créer un Groupe</span>
                            </button>

                            {groups.filter(g => !groupSearchQuery || g.name.toLowerCase().includes(groupSearchQuery.toLowerCase())).length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                    <p>{groupSearchQuery ? 'Aucun groupe trouvé' : 'Aucune chambre haute'}</p>
                                    <p className="text-xs mt-1">{groupSearchQuery ? 'Essayez un autre mot-clé' : 'Créez un groupe ou rejoignez-en un'}</p>
                                </div>
                            ) : (
                                <>
                                    {/* Groups created by user */}
                                    {groups.filter(g => g.created_by === user.id && (!groupSearchQuery || g.name.toLowerCase().includes(groupSearchQuery.toLowerCase()))).length > 0 && (
                                        <div>
                                            <h3 className="text-sm font-bold text-white mb-2 px-1">
                                                📌 Les groupes créés par vous
                                                {groups.filter(g => g.created_by === user.id)[0]?.created_at && (
                                                    <span className="text-slate-500 font-normal text-xs ml-1">
                                                        le {new Date(groups.filter(g => g.created_by === user.id)[0].created_at!).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                    </span>
                                                )}
                                            </h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {groups.filter(g => g.created_by === user.id && (!groupSearchQuery || g.name.toLowerCase().includes(groupSearchQuery.toLowerCase()))).map(group => (
                                                    <button
                                                        key={group.id}
                                                        onClick={() => openGroup(group)}
                                                        className="w-full p-3 rounded-xl bg-linear-to-br from-white/5 to-white/2 border border-white/10 hover:border-green-500/30 hover:bg-white/10 transition-all text-left group/card"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={cn(
                                                                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden",
                                                                group.is_urgent
                                                                    ? "bg-linear-to-br from-red-500 to-orange-500"
                                                                    : "bg-linear-to-br from-green-500 to-teal-500"
                                                            )}>
                                                                {group.avatar_url ? (
                                                                    <img src={group.avatar_url} alt="" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <Users className="h-6 w-6 text-white" />
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="font-semibold text-white truncate text-sm">{group.name}</span>
                                                                    {group.is_urgent && (
                                                                        <Badge className="bg-red-500/20 text-red-400 text-[9px] shrink-0">URGENT</Badge>
                                                                    )}
                                                                    <Crown className="h-3 w-3 text-amber-400 shrink-0" />
                                                                </div>
                                                                <p className="text-xs text-slate-400 truncate">{group.description || 'Chambre haute'}</p>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                                                        <Users className="h-2.5 w-2.5" /> {group.member_count} membres
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Groups joined by user */}
                                    {groups.filter(g => g.created_by !== user.id && (!groupSearchQuery || g.name.toLowerCase().includes(groupSearchQuery.toLowerCase()))).length > 0 && (
                                        <div>
                                            <h3 className="text-sm font-bold text-white mb-2 px-1">
                                                🤝 Les groupes rejoints par vous
                                            </h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {groups.filter(g => g.created_by !== user.id && (!groupSearchQuery || g.name.toLowerCase().includes(groupSearchQuery.toLowerCase()))).map(group => (
                                                    <button
                                                        key={group.id}
                                                        onClick={() => openGroup(group)}
                                                        className="w-full p-3 rounded-xl bg-linear-to-br from-white/5 to-white/2 border border-white/10 hover:border-indigo-500/30 hover:bg-white/10 transition-all text-left"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={cn(
                                                                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden",
                                                                group.is_urgent
                                                                    ? "bg-linear-to-br from-red-500 to-orange-500"
                                                                    : "bg-linear-to-br from-indigo-500 to-blue-500"
                                                            )}>
                                                                {group.avatar_url ? (
                                                                    <img src={group.avatar_url} alt="" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <Users className="h-6 w-6 text-white" />
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="font-semibold text-white truncate text-sm">{group.name}</span>
                                                                    {group.is_urgent && (
                                                                        <Badge className="bg-red-500/20 text-red-400 text-[9px] shrink-0">URGENT</Badge>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs text-slate-400 truncate">{group.description || 'Chambre haute'}</p>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                                                        <Users className="h-2.5 w-2.5" /> {group.member_count} membres
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="p-3 space-y-4">
                            {adminGroups.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                    <p>Aucun groupe officiel</p>
                                </div>
                            ) : (
                                <>
                                    <h3 className="text-sm font-bold text-white px-1">
                                        🏛️ Groupes Officiels
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {adminGroups.map(group => (
                                            <button
                                                key={group.id}
                                                onClick={() => openGroup(group)}
                                                className="w-full p-3 rounded-xl bg-linear-to-br from-purple-500/10 to-indigo-500/5 border border-purple-500/20 hover:border-purple-400/40 hover:bg-purple-500/10 transition-all text-left"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden",
                                                        group.is_urgent
                                                            ? "bg-linear-to-br from-red-500 to-orange-500"
                                                            : "bg-linear-to-br from-purple-500 to-indigo-500"
                                                    )}>
                                                        {group.avatar_url ? (
                                                            <img src={group.avatar_url} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <Shield className="h-6 w-6 text-white" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-semibold text-white truncate text-sm">{group.name}</span>
                                                            {group.is_urgent && (
                                                                <Badge className="bg-red-500/20 text-red-400 text-[9px] shrink-0">URGENT</Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-slate-400 truncate">{group.description || 'Groupe officiel'}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                                                <Users className="h-2.5 w-2.5" /> {group.member_count} membres
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </ScrollArea>

                {/* New Conversation Modal */}
                <AnimatePresence>
                    {showNewConversation && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900 z-50"
                        >
                            <div className="p-4 border-b border-white/10 flex items-center gap-3">
                                <Button variant="ghost" size="icon" onClick={() => setShowNewConversation(false)}>
                                    <ArrowLeft className="h-5 w-5" />
                                </Button>
                                <h3 className="font-medium">Nouvelle conversation</h3>
                            </div>
                            <div className="p-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Rechercher un utilisateur..."
                                        value={userSearchQuery}
                                        onChange={(e) => setUserSearchQuery(e.target.value)}
                                        className="pl-10 bg-white/5 border-white/10"
                                    />
                                </div>
                            </div>
                            <ScrollArea className="h-[calc(100%-120px)]">
                                <div className="divide-y divide-white/5">
                                    {allUsers
                                        .filter(u =>
                                            userSearchQuery === '' ||
                                            u.full_name?.toLowerCase().includes(userSearchQuery.toLowerCase())
                                        )
                                        .map(targetUser => (
                                            <button
                                                key={targetUser.id}
                                                onClick={() => startNewConversation(targetUser)}
                                                className="w-full p-4 flex items-center gap-3 hover:bg-white/5 transition-colors text-left"
                                            >
                                                <div className="relative">
                                                    <Avatar className="h-10 w-10">
                                                        <AvatarImage src={targetUser.avatar_url || undefined} />
                                                        <AvatarFallback className="bg-linear-to-br from-indigo-500 to-purple-500 text-white text-sm">
                                                            {getInitials(targetUser.full_name)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    {onlineUsers[targetUser.id] && (
                                                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-slate-900" />
                                                    )}
                                                </div>
                                                <div>
                                                    <span className="font-medium text-white">
                                                        {targetUser.full_name || 'Utilisateur'}
                                                    </span>
                                                    <p className="text-xs text-slate-500">
                                                        {onlineUsers[targetUser.id] ? 'En ligne' : 'Hors ligne'}
                                                    </p>
                                                </div>
                                            </button>
                                        ))
                                    }
                                </div>
                            </ScrollArea>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    }


    return (
        <div className="flex flex-col h-full w-full max-w-full overflow-hidden bg-linear-to-b from-slate-900 to-slate-950 relative">
            {/* Chat Header — fixed, never scrolls */}
            <div className="p-2 sm:p-3 border-b border-white/10 flex items-center gap-2 sm:gap-3 bg-slate-900/95 backdrop-blur-md shrink-0 z-20">
                <Button variant="ghost" size="icon" onClick={goBackToList} className="shrink-0 h-8 w-8 sm:h-9 sm:w-9">
                    <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>

                {currentRecipient && (
                    <>
                        <div className="relative">
                            <Avatar className="h-10 w-10">
                                <AvatarImage src={currentRecipient.avatar_url || undefined} />
                                <AvatarFallback className="bg-linear-to-br from-indigo-500 to-purple-500 text-white">
                                    {getInitials(currentRecipient.full_name)}
                                </AvatarFallback>
                            </Avatar>
                            {onlineUsers[currentRecipient.id] && (
                                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-900" />
                            )}
                        </div>
                        <div className="flex-1">
                            <p className="font-medium text-white">{currentRecipient.full_name}</p>
                            <p className="text-xs text-slate-400">
                                {onlineUsers[currentRecipient.id] ? (
                                    <span className="text-green-400">En ligne</span>
                                ) : (
                                    'Hors ligne'
                                )}
                            </p>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="rounded-full text-slate-400 hover:text-green-400 hover:bg-green-500/10"
                                onClick={() => setActiveCall({ type: 'audio', mode: 'private' })}
                                title="Appel vocal"
                            >
                                <Phone className="h-5 w-5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="rounded-full text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"
                                onClick={() => setActiveCall({ type: 'video', mode: 'private' })}
                                title="Appel vidéo"
                            >
                                <Video className="h-5 w-5" />
                            </Button>
                        </div>
                    </>
                )}

                {currentGroup && (
                    <>
                        <div className={cn(
                            "w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-full flex items-center justify-center overflow-hidden",
                            currentGroup.is_urgent
                                ? "bg-linear-to-br from-red-500 to-orange-500"
                                : "bg-linear-to-br from-indigo-500 to-purple-500"
                        )}>
                            {currentGroup.avatar_url ? (
                                <img src={currentGroup.avatar_url} alt={currentGroup.name} className="w-full h-full object-cover" />
                            ) : (
                                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0 overflow-hidden" onClick={() => setShowGroupMembers(!showGroupMembers)}>
                            <p className="font-medium text-white flex items-center gap-1 sm:gap-2 text-xs sm:text-base truncate cursor-pointer">
                                <span className="truncate">{currentGroup.name}</span>
                                {currentGroup.is_urgent && (
                                    <Badge className="bg-red-500/20 text-red-400 text-[8px] sm:text-[10px] shrink-0">URGENT</Badge>
                                )}
                            </p>
                            <p className="text-[9px] sm:text-xs text-slate-400 flex items-center gap-1">
                                <span>{groupMembers.length} membres</span>
                                {onlineMembersCount > 0 && (
                                    <span className="flex items-center gap-0.5">
                                        <span className="text-slate-500">•</span>
                                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block animate-pulse" />
                                        <span className="text-green-400">{onlineMembersCount} en ligne</span>
                                    </span>
                                )}
                            </p>
                        </div>
                        {/* Feature 2: Bigger buttons — more visible on mobile */}
                        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                            <div className="relative">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="rounded-full text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 h-10 w-10 sm:h-11 sm:w-11"
                                    onClick={() => { setShowGroupTools(true); setGroupToolUnread(0); loadAllUsers(); loadGroupMembers(currentGroup!.id); }}
                                    title="Outils de groupe"
                                >
                                    <Settings className="h-5 w-5 sm:h-5 sm:w-5" />
                                </Button>
                                {/* Feature 5: Group tool unread badge */}
                                {groupToolUnread > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white animate-pulse">
                                        {groupToolUnread}
                                    </span>
                                )}
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="rounded-full text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 h-10 w-10 sm:h-11 sm:w-11"
                                onClick={() => setShowGroupMembers(!showGroupMembers)}
                                title="Voir les membres"
                            >
                                <Users className="h-5 w-5 sm:h-5 sm:w-5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="rounded-full text-slate-400 hover:text-green-400 hover:bg-green-500/10 h-10 w-10 sm:h-11 sm:w-11"
                                onClick={() => setShowVoiceSalon(true)}
                                title="Salon vocal"
                            >
                                <Phone className="h-5 w-5 sm:h-5 sm:w-5" />
                            </Button>
                            {/* Feature 4: Google Meet video — generates unique room link */}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="rounded-full text-slate-400 hover:text-purple-400 hover:bg-purple-500/10 h-10 w-10 sm:h-11 sm:w-11"
                                onClick={() => {
                                    // Generate a unique meeting code: abc-defg-hij
                                    const chars = 'abcdefghijklmnopqrstuvwxyz';
                                    const seg = (len: number) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
                                    const meetCode = `${seg(3)}-${seg(4)}-${seg(3)}`;
                                    const meetUrl = `https://meet.google.com/${meetCode}`;

                                    // Open the meet link for the initiator
                                    window.open(meetUrl, '_blank', 'noopener,noreferrer');

                                    if (currentGroup && user) {
                                        // Send ONLY the link in group chat
                                        supabase.from('prayer_group_messages').insert({
                                            group_id: currentGroup.id,
                                            user_id: user.id,
                                            content: meetUrl,
                                            type: 'text'
                                        }).then(({ data }) => {
                                            if (data) {
                                                setMessages(prev => [...prev, {
                                                    ...(data as any),
                                                    sender_id: (data as any).user_id,
                                                    sender: { id: user.id, full_name: user.name, avatar_url: user.avatar || null },
                                                    is_read: true
                                                }]);
                                            }
                                        });
                                        toast.success('Lien Meet envoyé dans le groupe');
                                    }
                                }}
                                title="Appel vidéo Google Meet"
                            >
                                <Video className="h-4 w-4 sm:h-5 sm:w-5" />
                            </Button>
                            {/* Group Game button — blinks when a session is active */}
                            {!hasQuitGame && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                        "rounded-full h-9 w-9 sm:h-11 sm:w-11",
                                        activeGameSession
                                            ? "text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10 animate-pulse"
                                            : "text-slate-400 hover:text-yellow-400 hover:bg-yellow-500/10"
                                    )}
                                    onClick={() => {
                                        if (!activeGameSession && currentGroup && user) {
                                            // Start new session
                                            setActiveGameSession({
                                                startedBy: user.id,
                                                startedByName: user.name || 'Quelqu\'un',
                                                groupId: currentGroup.id,
                                                players: [user.id],
                                            });
                                            supabase.from('prayer_group_messages').insert({
                                                group_id: currentGroup.id,
                                                user_id: user.id,
                                                content: `🎮 **JEU DE GROUPE LANCÉ !** 🎮\n\n${user.name || 'Un membre'} a lancé un jeu biblique !\n\nCliquez sur le bouton 🎮 clignotant pour rejoindre !`,
                                                type: 'text'
                                            });
                                            toast.success('Jeu de groupe lancé !');
                                        }
                                        setShowGroupGame(true);
                                    }}
                                    title={activeGameSession ? "Rejoindre le jeu en cours" : "Lancer un jeu de groupe"}
                                >
                                    <span className="text-base">🎮</span>
                                </Button>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Group Members Panel */}
            <AnimatePresence>
                {showGroupMembers && currentGroup && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-b border-white/10 bg-slate-800/50 overflow-hidden"
                    >
                        <div className="p-3 max-h-40 overflow-y-auto">
                            <div className="flex flex-wrap gap-2">
                                {groupMembers.map(member => (
                                    <div key={member.id} className="flex items-center gap-1.5 bg-white/5 rounded-full px-2 py-1">
                                        <div className="relative">
                                            <Avatar className="h-5 w-5">
                                                <AvatarImage src={member.avatar_url || undefined} />
                                                <AvatarFallback className="text-[8px] bg-slate-600">
                                                    {getInitials(member.full_name)}
                                                </AvatarFallback>
                                            </Avatar>
                                            {(member.is_online || onlineUsers[member.id]) && (
                                                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-slate-800" />
                                            )}
                                        </div>
                                        <span className="text-[10px] text-slate-300 max-w-[80px] truncate">{member.full_name}</span>
                                        {member.role === 'admin' && (
                                            <span className="text-[8px] text-amber-400">👑</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Pinned Prayer Subject Banner — compact with clear unpin button */}
            {currentGroup && (pinnedPrayer || currentGroup.description?.startsWith('📌')) && (
                <div className="mx-2 sm:mx-4 mt-1 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2 shrink-0">
                    <Pin className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <p className="text-[11px] text-amber-200 flex-1 line-clamp-1">
                        <span className="font-semibold">Prière :</span>{' '}
                        {pinnedPrayer || currentGroup.description?.replace('📌 ', '')}
                    </p>
                    {isGroupAdmin && (
                        <button
                            onClick={async () => {
                                try {
                                    await supabase.from('prayer_groups').update({ description: null }).eq('id', currentGroup.id);
                                    setPinnedPrayer(null);
                                    toast.success('Sujet dé-épinglé');
                                } catch { toast.error('Erreur'); }
                            }}
                            className="text-amber-400 hover:text-red-400 shrink-0 bg-amber-500/20 hover:bg-red-500/20 rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors flex items-center gap-1"
                            title="Dé-épingler"
                        >
                            <X className="h-3 w-3" />
                            Retirer
                        </button>
                    )}
                </div>
            )}

            {/* Messages — only this area scrolls */}
            <ScrollArea className="flex-1 min-h-0 overflow-hidden" ref={scrollAreaRef}
                onScrollCapture={(e: any) => {
                    const target = e.target as HTMLElement;
                    setShowScrollTop(target.scrollTop > 400);
                }}
            >
                <div className="p-2 sm:p-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <MessageSquare className="h-12 w-12 mb-3 opacity-50" />
                            <p>Aucun message</p>
                            <p className="text-sm">Envoyez le premier message!</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {/* Load older messages button */}
                            {hasMoreMessages && view === 'group' && (
                                <div className="flex justify-center py-2">
                                    <button
                                        onClick={loadOlderMessages}
                                        disabled={isLoadingMore}
                                        className="px-4 py-1.5 text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-full transition-colors flex items-center gap-1.5"
                                    >
                                        {isLoadingMore ? (
                                            <><Loader2 className="h-3 w-3 animate-spin" /> Chargement...</>
                                        ) : (
                                            <>↑ Charger les messages précédents</>
                                        )}
                                    </button>
                                </div>
                            )}
                            {messages.map((msg, idx) => {
                                const isOwn = msg.sender_id === user.id;
                                const showAvatar = !isOwn && (idx === 0 || messages[idx - 1].sender_id !== msg.sender_id);
                                return (
                                    <ChatMessageBubble
                                        key={msg.id}
                                        msg={msg}
                                        isOwn={isOwn}
                                        showAvatar={showAvatar}
                                        view={view as 'conversation' | 'group'}
                                        userId={user.id}
                                        expandedMessages={expandedMessages}
                                        onToggleExpand={(id, expand) => {
                                            setExpandedMessages(prev => {
                                                const n = new Set(prev);
                                                if (expand) n.add(id); else n.delete(id);
                                                return n;
                                            });
                                        }}
                                        onReply={setReplyingTo}
                                        onThread={setThreadMessage}
                                        onDelete={deleteMessage}
                                        onReaction={(msgId, _emoji, newReactions) => {
                                            // Optimistic local update FIRST (instant feedback)
                                            setMessages(prev => prev.map(m =>
                                                m.id === msgId ? { ...m, reactions: newReactions as any } : m
                                            ));
                                            // Then persist to DB — send as JSONB object, NOT string
                                            const table = view === 'group' ? 'prayer_group_messages' : 'direct_messages';
                                            supabase.from(table)
                                                .update({ reactions: newReactions })
                                                .eq('id', msgId)
                                                .then(({ error }) => {
                                                    if (error) console.error('Reaction update error:', error);
                                                });
                                        }}
                                    />
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>
                    )}

                    {/* Typing indicator */}
                    {typingUsers.length > 0 && (
                        <div className="flex items-center gap-2 text-sm text-slate-400 mt-2">
                            <div className="flex gap-1">
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                            <span>{typingUsers.map(u => u.userName).join(', ')} écrit...</span>
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Scroll to top button */}
            <AnimatePresence>
                {showScrollTop && (
                    <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        onClick={() => {
                            const scrollEl = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
                            if (scrollEl) scrollEl.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="absolute right-4 bottom-24 z-30 w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30 flex items-center justify-center transition-colors"
                        title="Remonter au début"
                    >
                        <ChevronsUp className="h-5 w-5" />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Feature 11: Floating draggable bubbles for prayers/tools in group */}
            {view === 'group' && floatingItems.length > 0 && (
                <FloatingBubbles
                    items={floatingItems}
                    onRemove={(id) => setFloatingItems(prev => prev.filter(item => item.id !== id))}
                />
            )}

            {/* Input Area — ChatInputBar component */}
            <ChatInputBar
                view={view as 'conversation' | 'group'}
                userId={user.id}
                newMessage={newMessage}
                isSending={isSending}
                replyingTo={replyingTo}
                showMentions={showMentions}
                mentionFilter={mentionFilter}
                groupMembers={groupMembers}
                onlineUsers={onlineUsers}
                showEmojiPicker={showEmojiPicker}
                isRecording={isRecording}
                isPaused={isPaused}
                isUploadingVoice={isUploadingVoice}
                recordingTime={recordingTime}
                isUploadingFile={isUploadingFile}
                uploadProgress={uploadProgress}
                onMessageChange={handleMessageChange}
                onSendMessage={sendMessage}
                onEmojiSelect={handleEmojiSelect}
                onToggleEmojiPicker={() => setShowEmojiPicker(!showEmojiPicker)}
                onToggleMentions={() => { setShowMentions(!showMentions); setMentionFilter(''); }}
                onInsertMention={insertMention}
                onFileUpload={handleFileUpload}
                onStartRecording={startRecording}
                onStopRecording={stopRecording}
                onCancelRecording={cancelRecording}
                onPauseRecording={pauseRecording}
                onResumeRecording={resumeRecording}
                onClearReply={() => setReplyingTo(null)}
                onOpenBibleShare={() => setShowBibleShareDialog(true)}
                inputRef={inputRef}
            />

            {/* Group Tools Dialog - Full Integration — responsive on mobile */}
            <Dialog open={showGroupTools} onOpenChange={setShowGroupTools}>
                <DialogContent className="max-w-lg w-[95vw] sm:w-full max-h-[90vh] sm:max-h-[85vh] overflow-y-auto bg-slate-900 border-white/10 p-0">
                    <DialogHeader className="p-3 sm:p-4 pb-0">
                        <DialogTitle className="flex items-center gap-2 text-white text-sm sm:text-base">
                            <Settings className="h-4 w-4 sm:h-5 sm:w-5 text-amber-400" />
                            Outils de groupe
                        </DialogTitle>
                    </DialogHeader>

                    {currentGroup && (
                        <div className="space-y-4 p-4 pt-2">
                            {/* Group Photo & Info */}
                            <div className="flex items-center gap-4">
                                <div
                                    className="relative w-14 h-14 rounded-full overflow-hidden cursor-pointer group bg-linear-to-br from-indigo-500 to-purple-500 flex items-center justify-center shrink-0"
                                    onClick={() => groupPhotoInputRef.current?.click()}
                                >
                                    {currentGroup.avatar_url ? (
                                        <img src={currentGroup.avatar_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <Users className="h-7 w-7 text-white" />
                                    )}
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        {isUploadingGroupPhoto ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : <Camera className="h-5 w-5 text-white" />}
                                    </div>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-white truncate">{currentGroup.name}</p>
                                    <p className="text-[10px] text-slate-400">{groupMembers.length} membres • Cliquez la photo pour la changer</p>
                                </div>
                            </div>
                            <input ref={groupPhotoInputRef} type="file" accept="image/*" className="hidden" onChange={handleGroupPhotoUpload} />

                            {/* ===== INTEGRATED GROUP TOOLS PANEL ===== */}
                            <GroupToolsPanel
                                groupId={currentGroup.id}
                                userId={user.id}
                                userName={user.name || 'Utilisateur'}
                                isCreator={!!isGroupAdmin}
                                isOpen={true}
                                onClose={() => { }}
                            />

                            {/* Google Calendar Integration */}
                            <EventCalendarButton
                                groupId={currentGroup.id}
                                groupName={currentGroup.name}
                                className="w-full"
                            />

                            {/* Separator */}
                            <div className="border-t border-white/5 pt-3">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Actions rapides</p>
                            </div>

                            {/* Quick Actions */}
                            <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-2">
                                {/* Add Member */}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-white/10 text-white hover:bg-white/5 h-9 text-xs"
                                    onClick={() => { setShowAddMemberDialog(true); setAddMemberSearch(''); }}
                                >
                                    <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                                    Ajouter membre
                                </Button>

                                {/* Pin Prayer Subject */}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-amber-500/20 text-amber-400 hover:bg-amber-500/10 h-9 text-xs"
                                    onClick={() => { setShowPinTool(true); setShowGroupTools(false); setPinText(pinnedPrayer || ''); }}
                                >
                                    <Pin className="h-3.5 w-3.5 mr-1.5" />
                                    Épingler sujet
                                </Button>

                                {/* Bible Tool */}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 h-9 text-xs"
                                    onClick={() => { setShowBibleTool(true); setShowGroupTools(false); }}
                                >
                                    <BookOpen className="h-3.5 w-3.5 mr-1.5" />
                                    Passage Bible
                                </Button>

                                {/* Plan Event */}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-blue-500/20 text-blue-400 hover:bg-blue-500/10 h-9 text-xs"
                                    onClick={() => { setShowEventTool(true); setShowGroupTools(false); setEventTitle(''); setEventDate(''); setEventTime(''); setEventDescription(''); }}
                                >
                                    <Calendar className="h-3.5 w-3.5 mr-1.5" />
                                    Événement
                                </Button>
                            </div>

                            {/* Admin-only actions */}
                            {isGroupAdmin && (
                                <div className="space-y-2">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Admin</p>
                                    <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="border-red-500/20 text-red-400 hover:bg-red-500/10 h-9 text-xs"
                                            onClick={() => { setShowAnnouncementTool(true); setShowGroupTools(false); setAnnouncementText(''); }}
                                        >
                                            <Megaphone className="h-3.5 w-3.5 mr-1.5" />
                                            Annonce
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="border-purple-500/20 text-purple-400 hover:bg-purple-500/10 h-9 text-xs"
                                            onClick={() => { setShowFastingTool(true); setShowGroupTools(false); initFastingDays(fastingDuration); }}
                                        >
                                            <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
                                            Jeûne
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/10 h-9 text-xs col-span-2"
                                            onClick={() => { setShowMigrateTool(true); setShowGroupTools(false); }}
                                        >
                                            <ArrowRightLeft className="h-3.5 w-3.5 mr-1.5" />
                                            Migrer les membres
                                        </Button>
                                    </div>

                                    {/* Auto-close 24h button */}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full border-orange-500/20 text-orange-400 hover:bg-orange-500/10 h-9 text-xs"
                                        onClick={async () => {
                                            if (!currentGroup) return;
                                            const confirmClose = window.confirm(
                                                `🙏 Prière exaucée !\n\nLe groupe "${currentGroup.name}" sera archivé et supprimé automatiquement dans 24 heures.\n\nUn message sera envoyé aux membres. Continuer ?`
                                            );
                                            if (!confirmClose) return;

                                            try {
                                                // Send celebration message
                                                await supabase.from('prayer_group_messages').insert({
                                                    group_id: currentGroup.id,
                                                    user_id: user.id,
                                                    content: `🎉✨ **PRIÈRE EXAUCÉE !** ✨🎉\n\nGloire à Dieu ! La prière de ce groupe a été exaucée !\n\n⏰ Ce groupe sera automatiquement archivé dans 24 heures.\nMerci à tous pour vos prières fidèles ! 🙏`,
                                                    type: 'text'
                                                });

                                                // Mark group for auto-deletion in 24h
                                                const closeAt = new Date();
                                                closeAt.setHours(closeAt.getHours() + 24);

                                                await supabase
                                                    .from('prayer_groups')
                                                    .update({
                                                        description: `📌 🎉 PRIÈRE EXAUCÉE - Fermeture auto le ${closeAt.toLocaleDateString('fr-FR')} à ${closeAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
                                                        is_open: false
                                                    })
                                                    .eq('id', currentGroup.id);

                                                // Schedule deletion via a scheduled_deletions table or flag
                                                await supabase.from('scheduled_group_deletions').upsert({
                                                    group_id: currentGroup.id,
                                                    delete_at: closeAt.toISOString(),
                                                    reason: 'prayer_answered'
                                                }, { onConflict: 'group_id' }).then(res => {
                                                    if (res.error) {
                                                        // Table may not exist — fallback: just update the group
                                                        console.log('scheduled_group_deletions table not found, using description flag');
                                                    }
                                                });

                                                toast.success('🎉 Prière exaucée ! Le groupe sera archivé dans 24h.');
                                                setShowGroupTools(false);
                                                loadMessages('group', currentGroup.id);
                                            } catch (e: any) {
                                                console.error('Error marking prayer as answered:', e);
                                                toast.error('Erreur : ' + (e.message || 'Impossible de marquer'));
                                            }
                                        }}
                                    >
                                        🎉 Prière exaucée (fermeture auto 24h)
                                    </Button>
                                </div>
                            )}

                            {/* Members List */}
                            <div className="border-t border-white/5 pt-3 space-y-1">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1 mb-2">Membres ({groupMembers.length})</p>
                                <div className="max-h-48 overflow-y-auto space-y-1">
                                    {groupMembers.map(member => (
                                        <div key={member.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5">
                                            <div className="relative">
                                                <Avatar className="h-7 w-7">
                                                    <AvatarImage src={member.avatar_url || undefined} />
                                                    <AvatarFallback className="text-[9px] bg-slate-600">{getInitials(member.full_name)}</AvatarFallback>
                                                </Avatar>
                                                {onlineUsers[member.id] && (
                                                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-slate-900" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs text-white truncate">{member.full_name || 'Utilisateur'}</p>
                                                <p className="text-[9px] text-slate-500">
                                                    {member.role === 'admin' ? '👑 Admin' : 'Membre'}
                                                    {onlineUsers[member.id] && ' • 🟢'}
                                                </p>
                                            </div>
                                            {isGroupAdmin && member.id !== user.id && member.role !== 'admin' && (
                                                <div className="flex gap-0.5 shrink-0">
                                                    <Button
                                                        variant="ghost" size="icon"
                                                        className="h-6 w-6 text-amber-400 hover:bg-amber-500/10"
                                                        onClick={() => handlePromoteAdmin(member.id)}
                                                        title="Nommer admin"
                                                    >
                                                        <Crown className="h-3 w-3" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost" size="icon"
                                                        className="h-6 w-6 text-red-400 hover:bg-red-500/10"
                                                        onClick={() => handleRemoveMember(member.id)}
                                                        title="Retirer"
                                                    >
                                                        <UserMinus className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Add Member Dialog */}
            <Dialog open={showAddMemberDialog} onOpenChange={setShowAddMemberDialog}>
                <DialogContent className="max-w-sm max-h-[70vh] overflow-hidden bg-slate-900 border-white/10">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-white">
                            <UserPlus className="h-5 w-5 text-green-400" />
                            Ajouter des membres
                        </DialogTitle>
                    </DialogHeader>
                    <Input
                        placeholder="Rechercher..."
                        value={addMemberSearch}
                        onChange={e => setAddMemberSearch(e.target.value)}
                        className="bg-white/5 border-white/10"
                    />
                    <ScrollArea className="max-h-[40vh]">
                        <div className="space-y-1">
                            {allUsers
                                .filter(u => !groupMembers.find(m => m.id === u.id) && (
                                    !addMemberSearch || u.full_name?.toLowerCase().includes(addMemberSearch.toLowerCase())
                                ))
                                .map(u => (
                                    <button
                                        key={u.id}
                                        onClick={() => handleAddMember(u.id)}
                                        className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 text-left"
                                    >
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={u.avatar_url || undefined} />
                                            <AvatarFallback className="text-xs bg-slate-600">{getInitials(u.full_name)}</AvatarFallback>
                                        </Avatar>
                                        <span className="text-sm text-white flex-1 truncate">{u.full_name || 'Utilisateur'}</span>
                                        <Plus className="h-4 w-4 text-green-400 shrink-0" />
                                    </button>
                                ))
                            }
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>

            {/* Admin Dialogs — extracted component */}
            <GroupAdminDialogs
                user={user}
                currentGroup={currentGroup}
                groupMembers={groupMembers}
                showBibleTool={showBibleTool}
                setShowBibleTool={setShowBibleTool}
                bibleVersion={bibleVersion}
                setBibleVersion={setBibleVersion}
                bibleReference={bibleReference}
                setBibleReference={setBibleReference}
                bibleContent={bibleContent}
                isFetchingBible={isFetchingBible}
                fetchBiblePassage={fetchBiblePassage}
                shareBiblePassage={shareBiblePassage}
                showFastingTool={showFastingTool}
                setShowFastingTool={setShowFastingTool}
                fastingTheme={fastingTheme}
                setFastingTheme={setFastingTheme}
                fastingDuration={fastingDuration}
                setFastingDuration={setFastingDuration}
                fastingDays={fastingDays}
                setFastingDays={setFastingDays}
                initFastingDays={initFastingDays}
                shareFastingProgram={shareFastingProgram}
                showAnnouncementTool={showAnnouncementTool}
                setShowAnnouncementTool={setShowAnnouncementTool}
                announcementText={announcementText}
                setAnnouncementText={setAnnouncementText}
                sendAnnouncement={sendAnnouncement}
                showPinTool={showPinTool}
                setShowPinTool={setShowPinTool}
                pinText={pinText}
                setPinText={setPinText}
                setPinnedPrayerSubject={setPinnedPrayerSubject}
                showEventTool={showEventTool}
                setShowEventTool={setShowEventTool}
                eventTitle={eventTitle}
                setEventTitle={setEventTitle}
                eventDate={eventDate}
                setEventDate={setEventDate}
                eventTime={eventTime}
                setEventTime={setEventTime}
                eventDescription={eventDescription}
                setEventDescription={setEventDescription}
                sendEventToGroup={sendEventToGroup}
                showMigrateTool={showMigrateTool}
                setShowMigrateTool={setShowMigrateTool}
                migrateTargetName={migrateTargetName}
                setMigrateTargetName={setMigrateTargetName}
                isMigratingMembers={isMigratingMembers}
                migrateGroupMembers={migrateGroupMembers}
                threadMessage={threadMessage}
                setThreadMessage={setThreadMessage}
                threadComments={threadComments}
                setThreadComments={setThreadComments}
                formatTime={formatTime}
            />

            {/* VoiceSalon — Discord-style group audio room */}
            {showVoiceSalon && currentGroup && (
                <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md">
                    <VoiceSalon
                        groupId={currentGroup.id}
                        groupName={currentGroup.name}
                        user={{ id: user.id, name: user.name || 'Utilisateur', avatar: user.avatar || undefined }}
                        onClose={() => setShowVoiceSalon(false)}
                    />
                </div>
            )}

            <GroupGameDialog
                open={showGroupGame}
                onOpenChange={setShowGroupGame}
                activeGameSession={activeGameSession}
                setActiveGameSession={setActiveGameSession}
                setHasQuitGame={setHasQuitGame}
                userId={user.id}
                userName={user.name || 'Utilisateur'}
                currentGroup={currentGroup}
            />

            {/* Bible Share Dialog — for sharing verses in private & group chats */}
            <BibleShareDialog
                open={showBibleShareDialog}
                onOpenChange={setShowBibleShareDialog}
                onShareVerse={handleBibleShareVerse}
            />

            {/* Create Group Dialog (replaces window.prompt) */}
            <Dialog open={showCreateGroupDialog} onOpenChange={setShowCreateGroupDialog}>
                <DialogContent className="max-w-sm bg-[#0F1219] border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-white">
                            <div className="w-9 h-9 rounded-xl bg-green-600 flex items-center justify-center">
                                <Users className="h-4 w-4 text-white" />
                            </div>
                            🚪 Créer une chambre haute
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div>
                            <label className="text-xs text-slate-400 mb-1.5 block">Nom du groupe *</label>
                            <Input
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                placeholder="Ex: Prière du matin"
                                className="bg-white/5 border-white/10 text-white"
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter' && newGroupName.trim()) {
                                        handleCreateGroup();
                                    }
                                }}
                                autoFocus
                            />
                        </div>
                        <div className="flex gap-2 justify-end">
                            <Button
                                variant="ghost"
                                className="text-slate-400"
                                onClick={() => setShowCreateGroupDialog(false)}
                            >
                                Annuler
                            </Button>
                            <Button
                                className="bg-green-600 hover:bg-green-700 text-white"
                                disabled={!newGroupName.trim() || isCreatingGroup}
                                onClick={handleCreateGroup}
                            >
                                {isCreatingGroup ? (
                                    <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Création...</>
                                ) : (
                                    <><Plus className="h-4 w-4 mr-1" /> Créer</>
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
