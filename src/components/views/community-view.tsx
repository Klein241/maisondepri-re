'use client';

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import {
    MessageSquare, Heart, Send, Plus, ChevronRight, Users, Check, Search, Pin, Shield, BellRing,
    Filter, X, Camera, Bookmark, MoreVertical, Share2, Flag, Sparkles,
    Lock, CheckCircle2, Loader2, ArrowLeft, Bell, Settings,
    MessageCircle, UserPlus, ChevronDown, Crown, Trash2, Smile, Mic, MicOff, Play, Pause, Video, Globe, UserCheck, Gamepad2, LogIn
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAppStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { PRAYER_CATEGORIES, PrayerCategory, PrayerRequest, Testimonial, PrayerGroup, PrayerGroupJoinRequest } from "@/lib/types";
import { PhotoUpload, PhotoGallery } from "@/components/ui/photo-upload";
import { WhatsAppChat } from "@/components/community/whatsapp-chat";
import { PrayerGroupManager } from "@/components/community/prayer-group-manager";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import { GroupCallManager } from "@/components/community/group-call-manager";
import { FriendSystem } from "@/components/community/friend-system";
import { NotificationBell } from "@/components/notification-bell";
import { IncomingCallOverlay, useCallListener, DMCallButtons } from "@/components/community/call-system";
import { EventCalendarButton } from "@/components/community/event-calendar";
import { PrayerCard } from "@/components/community/prayer-card";
import { TestimonyCard } from "@/components/community/testimony-card";
import { ChatMessage } from "@/components/community/chat-message";
import { VoiceMessagePlayer } from "@/components/community/voice-message-player";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { notifyNewPrayer, notifyPrayerPrayed, notifyGroupNewMessage, notifyGroupAccessRequest, notifyGroupAccessApproved, notifyDirectMessage } from "@/lib/notifications";

type ViewState = 'main' | 'chat' | 'groups' | 'group-detail' | 'messages' | 'conversation' | 'group-call' | 'friends';

// VoiceMessagePlayer extracted to @/components/community/voice-message-player.tsx

interface CommunityViewProps {
    onHideNav?: (hide: boolean) => void;
}

export function CommunityView({ onHideNav }: CommunityViewProps = {}) {
    const {
        prayerRequests, addPrayerRequest, prayForRequest,
        testimonials, addTestimonial, likeTestimonial,
        user
    } = useAppStore();
    const setGlobalActiveTab = useAppStore(s => s.setActiveTab);
    const setBibleViewTarget = useAppStore(s => s.setBibleViewTarget);
    const pendingNavigation = useAppStore(s => s.pendingNavigation);
    const setPendingNavigation = useAppStore(s => s.setPendingNavigation);

    // UI State
    const [viewState, setViewState] = useState<ViewState>('main');
    const [activeTab, setActiveTab] = useState<'prayers' | 'testimonials' | 'chat'>('prayers');
    const [selectedCategory, setSelectedCategory] = useState<PrayerCategory | 'all'>('all');
    const [showAnsweredOnly, setShowAnsweredOnly] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogType, setDialogType] = useState<'prayer' | 'testimonial'>('prayer');

    // Form State
    const [newContent, setNewContent] = useState('');
    const [newCategory, setNewCategory] = useState<PrayerCategory>('other');
    const [newPhotos, setNewPhotos] = useState<string[]>([]);
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Chat State
    const [chatMessages, setChatMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loadingMessages, setLoadingMessages] = useState(false);
    const chatScrollRef = useRef<HTMLDivElement>(null);

    // Groups State
    const [groups, setGroups] = useState<PrayerGroup[]>([]);
    const [selectedGroup, setSelectedGroup] = useState<PrayerGroup | null>(null);
    const [groupMessages, setGroupMessages] = useState<any[]>([]);
    const [loadingGroupMessages, setLoadingGroupMessages] = useState(false);

    // Private Messages State
    const [conversations, setConversations] = useState<any[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<any | null>(null);
    const [directMessages, setDirectMessages] = useState<any[]>([]);
    const [loadingConversations, setLoadingConversations] = useState(false);
    const [loadingDMs, setLoadingDMs] = useState(false);
    const [allUsers, setAllUsers] = useState<any[]>([]); // For selecting new conversation partner
    const [showCreateGroupDialog, setShowCreateGroupDialog] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupDescription, setNewGroupDescription] = useState('');
    const [creatingGroup, setCreatingGroup] = useState(false);
    const [userGroups, setUserGroups] = useState<string[]>([]); // Groups user has joined
    const [onlineUsers, setOnlineUsers] = useState<Record<string, boolean>>({});
    const [userLastSeen, setUserLastSeen] = useState<Record<string, string>>({});

    // Search state for Messages view
    const [showMessageSearch, setShowMessageSearch] = useState(false);
    const [messageSearchQuery, setMessageSearchQuery] = useState('');

    // Emoji picker states
    const [showDMEmojiPicker, setShowDMEmojiPicker] = useState(false);
    const [showGroupEmojiPicker, setShowGroupEmojiPicker] = useState(false);

    // Voice recording states
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [isUploadingVoice, setIsUploadingVoice] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Create group with prayer request
    const [createGroupWithPrayer, setCreateGroupWithPrayer] = useState(false);

    // Group join request system
    const [groupJoinRequests, setGroupJoinRequests] = useState<PrayerGroupJoinRequest[]>([]);
    const [pendingRequestCounts, setPendingRequestCounts] = useState<Record<string, number>>({});
    const [showMembersPanel, setShowMembersPanel] = useState(false);
    const [groupMembers, setGroupMembers] = useState<any[]>([]);
    const [showPinnedPrayer, setShowPinnedPrayer] = useState(false);

    // User friends for suggestions
    const [userFriends, setUserFriends] = useState<string[]>([]);
    const [isFriendWithChatPartner, setIsFriendWithChatPartner] = useState(false);

    // Guest auth prompt
    const [showAuthPrompt, setShowAuthPrompt] = useState(false);
    const requireAuth = (callback?: () => void) => {
        if (!user) {
            setShowAuthPrompt(true);
            return false;
        }
        callback?.();
        return true;
    };

    // Notify parent to hide/show bottom nav based on viewState
    useEffect(() => {
        const fullScreenViews: ViewState[] = ['conversation', 'group-detail', 'group-call'];
        onHideNav?.(fullScreenViews.includes(viewState));
    }, [viewState, onHideNav]);

    // Handle deep-linking from notifications
    useEffect(() => {
        if (!pendingNavigation) return;

        const nav = pendingNavigation;
        setPendingNavigation(null); // Consume it

        // Navigate to the right community sub-tab
        if (nav.communityTab) {
            const tabMap: Record<string, 'prayers' | 'testimonials' | 'chat'> = {
                prieres: 'prayers',
                prayers: 'prayers',
                temoignages: 'testimonials',
                testimonials: 'testimonials',
                chat: 'chat',
            };
            if (tabMap[nav.communityTab]) {
                setActiveTab(tabMap[nav.communityTab]);
            }
        }

        // Navigate to a specific viewState (e.g., group-detail, groups, conversation)
        if (nav.viewState) {
            const vs = nav.viewState as ViewState;

            // If navigating to a group-detail, load the group
            if (vs === 'group-detail' && nav.groupId) {
                setViewState(vs);
                const group = groups.find((g: any) => g.id === nav.groupId);
                if (group) {
                    setSelectedGroup(group);
                } else {
                    // Load the specific group
                    supabase
                        .from('prayer_groups')
                        .select('*, profiles:created_by(full_name, avatar_url)')
                        .eq('id', nav.groupId)
                        .single()
                        .then(({ data }) => {
                            if (data) {
                                setSelectedGroup(data as any);
                            }
                        });
                }
            }
            // If navigating to a DM conversation, open the chat tab and load conversation
            else if (vs === 'conversation' && nav.conversationId) {
                setActiveTab('chat');
                // Load the conversation details and open it
                supabase
                    .from('conversations')
                    .select('*')
                    .eq('id', nav.conversationId)
                    .single()
                    .then(async ({ data: conv }) => {
                        if (!conv || !user) return;
                        const partnerId = conv.participant1_id === user.id ? conv.participant2_id : conv.participant1_id;
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('id, full_name, avatar_url, is_online, last_seen')
                            .eq('id', partnerId)
                            .single();

                        const conversation = {
                            id: conv.id,
                            otherUser: profile || { id: partnerId, full_name: 'Utilisateur', avatar_url: null },
                            lastMessage: conv.last_message || '',
                            lastMessageAt: conv.last_message_at || conv.created_at,
                            unreadCount: 0,
                        };
                        setSelectedConversation(conversation);
                        loadDirectMessages(conv.id);
                        setViewState('conversation');
                        if (onHideNav) onHideNav(true);
                    });
            }
            // Otherwise, navigate to the specified viewState
            else {
                setViewState(vs);
            }
        }
    }, [pendingNavigation]);

    // Watch for DM refresh signals (RLS workaround: when notification arrives, reload messages)
    const dmRefreshSignal = useAppStore(s => s.dmRefreshSignal);
    useEffect(() => {
        if (!dmRefreshSignal) return;
        // If we're viewing the conversation that just got a new message, reload messages
        if (viewState === 'conversation' && selectedConversation && selectedConversation.id === dmRefreshSignal.conversationId) {
            loadDirectMessages(dmRefreshSignal.conversationId);
        }
        // Also reload conversation list to update unread counts
        if (viewState === 'messages' && user) {
            // Debounce to avoid excessive reloads
            const timer = setTimeout(() => {
                loadConversations();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [dmRefreshSignal]);

    // Track online presence with robust updates
    useEffect(() => {
        if (!user) return;

        // Set user online when component mounts
        const setOnline = async () => {
            try {
                await supabase
                    .from('profiles')
                    .update({ is_online: true, last_seen: new Date().toISOString() })
                    .eq('id', user.id);
            } catch (e) {
                console.log('Online status columns may not exist yet');
            }
        };

        const setOffline = async () => {
            try {
                await supabase
                    .from('profiles')
                    .update({ is_online: false, last_seen: new Date().toISOString() })
                    .eq('id', user.id);
            } catch (e) {
                // Ignore
            }
        };

        setOnline();

        // Fetch ALL profiles with online status + auto-cleanup stale users
        const fetchOnlineUsers = async () => {
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, is_online, last_seen');

                if (!error && data) {
                    const onlineMap: Record<string, boolean> = {};
                    const lastSeenMap: Record<string, string> = {};
                    const twoMinutesAgo = Date.now() - 2 * 60 * 1000;

                    data.forEach(u => {
                        // Auto-cleanup: if user hasn't been seen in 2 min, consider offline
                        const lastSeenTime = u.last_seen ? new Date(u.last_seen).getTime() : 0;
                        const isReallyOnline = u.is_online === true && lastSeenTime > twoMinutesAgo;
                        onlineMap[u.id] = isReallyOnline;
                        if (u.last_seen) lastSeenMap[u.id] = u.last_seen;
                    });
                    setOnlineUsers(onlineMap);
                    setUserLastSeen(lastSeenMap);
                }
            } catch (e) {
                console.log('Online status feature not available yet');
            }
        };
        fetchOnlineUsers();

        // Heartbeat: update last_seen every 30s to prove we're still online
        const heartbeatInterval = setInterval(async () => {
            try {
                await supabase
                    .from('profiles')
                    .update({ is_online: true, last_seen: new Date().toISOString() })
                    .eq('id', user.id);
            } catch (e) {
                // Ignore
            }
        }, 30000);

        // Subscribe to presence changes via realtime
        const presenceChannel = supabase.channel('online-users-presence')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles'
            }, (payload) => {
                const profile = payload.new as any;
                if (profile.id) {
                    // Check if last_seen is recent (within 2 min)
                    const lastSeenTime = profile.last_seen ? new Date(profile.last_seen).getTime() : 0;
                    const isReallyOnline = profile.is_online === true && lastSeenTime > (Date.now() - 2 * 60 * 1000);
                    setOnlineUsers(prev => ({ ...prev, [profile.id]: isReallyOnline }));
                    if (profile.last_seen) {
                        setUserLastSeen(prev => ({ ...prev, [profile.id]: profile.last_seen }));
                    }
                }
            })
            .subscribe();

        // Handle page visibility changes
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                setOnline();
            } else {
                // When tab is hidden, update last_seen but keep online
                // (the heartbeat will stop if the tab is closed)
                supabase.from('profiles')
                    .update({ last_seen: new Date().toISOString() })
                    .eq('id', user.id)
                    .then(() => { });
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // CRITICAL: Handle browser/tab close - set offline immediately
        const handleBeforeUnload = () => {
            // Use sendBeacon for reliable delivery on page close
            const payload = JSON.stringify({
                is_online: false,
                last_seen: new Date().toISOString()
            });

            // Try sendBeacon first (most reliable for page unload)
            if (navigator.sendBeacon) {
                const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
                const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
                if (supabaseUrl && supabaseKey) {
                    const url = `${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}`;
                    const blob = new Blob([payload], { type: 'application/json' });
                    navigator.sendBeacon(url, blob); // May not work due to auth headers
                }
            }

            // Also try synchronous fetch (backup)
            try {
                setOffline();
            } catch (e) {
                // Ignore
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);

        // Set offline on unmount
        return () => {
            clearInterval(heartbeatInterval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            setOffline();
            presenceChannel.unsubscribe();
        };
    }, [user]);

    // Heartbeat to keep user online - every 90s to stay within the 2-minute online window
    useEffect(() => {
        if (!user) return;
        const interval = setInterval(async () => {
            try {
                await supabase.from('profiles').update({
                    is_online: true,
                    last_seen: new Date().toISOString()
                }).eq('id', user.id);
            } catch (e) {
                // Silently fail if columns don't exist
            }
        }, 90000); // Every 90 seconds - must be less than the 2-minute online window

        return () => clearInterval(interval);
    }, [user]);

    // Real-time subscription for prayer_requests deletions - sync across all clients
    useEffect(() => {
        const { removePrayerRequest } = useAppStore.getState();
        const prayerChannel = supabase.channel('prayer-realtime')
            .on('postgres_changes', {
                event: 'DELETE',
                schema: 'public',
                table: 'prayer_requests'
            }, (payload) => {
                const deletedId = (payload.old as any)?.id;
                if (deletedId) {
                    removePrayerRequest(deletedId);
                }
            })
            .subscribe();

        return () => {
            prayerChannel.unsubscribe();
        };
    }, []);

    // Load chat messages
    useEffect(() => {
        if (activeTab === 'chat') {
            loadChatMessages();
            const subscription = supabase
                .channel('community_messages_realtime')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_messages' }, async (payload) => {
                    const newMessage = payload.new;
                    // Fetch profile for the new message
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('full_name, avatar_url')
                        .eq('id', newMessage.user_id)
                        .single();

                    setChatMessages(prev => [...prev, { ...newMessage, profiles: profile }]);
                })
                .subscribe();

            return () => {
                subscription.unsubscribe();
            };
        }
    }, [activeTab]);

    // Scroll to bottom on new messages
    useEffect(() => {
        if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
    }, [chatMessages, directMessages, groupMessages]);

    const loadChatMessages = async () => {
        setLoadingMessages(true);
        try {
            const { data, error } = await supabase
                .from('community_messages')
                .select(`
                    *,
                    profiles:user_id (full_name, avatar_url)
                `)
                .order('created_at', { ascending: true })
                .limit(50);

            if (error) throw error;
            setChatMessages(data || []);
        } catch (e) {
            console.error('Error loading messages:', e);
        }
        setLoadingMessages(false);
    };

    const loadGroups = async () => {
        try {
            // First try with full query
            let { data, error } = await supabase
                .from('prayer_groups')
                .select(`
                    *,
                    profiles:created_by (full_name, avatar_url)
                `)
                .order('created_at', { ascending: false });

            if (error) {
                console.log('Groups query error, trying simpler query:', error.message);
                // Fallback to simpler query
                const simpleResult = await supabase
                    .from('prayer_groups')
                    .select('*')
                    .order('created_at', { ascending: false });
                data = simpleResult.data;
            }

            if (data) {
                // Fetch real member counts for all groups
                const groupsWithCounts = await Promise.all(data.map(async (g) => {
                    const { count } = await supabase
                        .from('prayer_group_members')
                        .select('*', { count: 'exact', head: true })
                        .eq('group_id', g.id);
                    return { ...g, memberCount: count || 0 };
                }));
                setGroups(groupsWithCounts);
            } else {
                setGroups([]);
            }
        } catch (e) {
            console.error('Error loading groups:', e);
        }
    };

    // Load private conversations
    const loadConversations = async () => {
        if (!user) return;
        setLoadingConversations(true);
        try {
            // Try with profiles join
            let { data, error } = await supabase
                .from('conversations')
                .select('*')
                .or(`participant1_id.eq.${user.id},participant2_id.eq.${user.id}`)
                .order('last_message_at', { ascending: false });

            if (!error && data) {
                // Fetch profiles separately for each conversation
                const formattedConversations = await Promise.all(data.map(async (conv) => {
                    const otherUserId = conv.participant1_id === user.id ? conv.participant2_id : conv.participant1_id;
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('id, full_name, avatar_url')
                        .eq('id', otherUserId)
                        .single();
                    return {
                        ...conv,
                        otherUser: profile || { id: otherUserId, full_name: 'Utilisateur', avatar_url: null }
                    };
                }));
                setConversations(formattedConversations);
            } else if (error) {
                console.log('Conversations table may not exist yet:', error.message);
                setConversations([]);
            }
        } catch (e) {
            console.error('Error loading conversations:', e);
            setConversations([]);
        }
        setLoadingConversations(false);
    };

    // Load users for new conversation
    const loadUsers = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url')
                .neq('id', user.id)
                .limit(50);

            if (!error && data) {
                setAllUsers(data);
            }
        } catch (e) {
            console.error('Error loading users:', e);
        }
    };

    // Load user's friends
    const loadUserFriends = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('friendships')
                .select('sender_id, receiver_id')
                .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
                .eq('status', 'accepted');

            if (!error && data) {
                const friendIds = data.map(f =>
                    f.sender_id === user.id ? f.receiver_id : f.sender_id
                );
                setUserFriends(friendIds);
            }
        } catch (e) {
            console.log('Friends not loaded:', e);
        }
    };

    // Load pending join requests for groups the user created
    const loadPendingJoinRequests = async () => {
        if (!user) return;
        try {
            // Get groups created by the user
            const { data: myGroups } = await supabase
                .from('prayer_groups')
                .select('id')
                .eq('created_by', user.id);

            if (!myGroups || myGroups.length === 0) return;

            const groupIds = myGroups.map(g => g.id);
            const { data: requests, error } = await supabase
                .from('prayer_group_join_requests')
                .select(`
                    *,
                    profiles:user_id(full_name, avatar_url)
                `)
                .in('group_id', groupIds)
                .eq('status', 'pending');

            if (!error && requests) {
                setGroupJoinRequests(requests);
                // Count per group
                const counts: Record<string, number> = {};
                requests.forEach(r => {
                    counts[r.group_id] = (counts[r.group_id] || 0) + 1;
                });
                setPendingRequestCounts(counts);
            }
        } catch (e) {
            console.log('Join requests table may not exist yet');
        }
    };

    // Request to join a group (instead of auto-join)
    const requestJoinGroup = async (groupId: string) => {
        if (!user) return;
        try {
            // Check if already requested
            const { data: existing } = await supabase
                .from('prayer_group_join_requests')
                .select('id')
                .eq('group_id', groupId)
                .eq('user_id', user.id)
                .maybeSingle();

            if (existing) {
                toast.info('Vous avez déjà envoyé une demande pour ce groupe');
                return;
            }

            const { error } = await supabase
                .from('prayer_group_join_requests')
                .insert({
                    group_id: groupId,
                    user_id: user.id,
                    status: 'pending'
                });

            if (error) {
                // Fallback: if table doesn't exist, use direct join  
                if (error.message.includes('does not exist') || error.code === '42P01') {
                    await joinGroup(groupId);
                    return;
                }
                throw error;
            }

            // Send notification to group creator via Supabase notifications
            const { data: group } = await supabase
                .from('prayer_groups')
                .select('created_by, name')
                .eq('id', groupId)
                .single();

            if (group) {
                notifyGroupAccessRequest({
                    groupOwnerId: group.created_by,
                    groupId,
                    groupName: group.name,
                    requesterName: user.name,
                }).catch(console.error);
            }

            toast.success('✅ Demande envoyée! Le créateur du groupe sera notifié.');
        } catch (e) {
            console.error('Error requesting join:', e);
            toast.error("Erreur lors de l'envoi de la demande");
        }
    };

    // Approve a join request
    const approveJoinRequest = async (requestId: string, groupId: string, userId: string) => {
        try {
            await supabase
                .from('prayer_group_join_requests')
                .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: user?.id })
                .eq('id', requestId);

            // Add the user as a member
            await supabase
                .from('prayer_group_members')
                .insert({ group_id: groupId, user_id: userId, role: 'member' });

            // Notify the user that their request was approved
            const groupData = groups.find(g => g.id === groupId);
            notifyGroupAccessApproved({
                userId,
                groupId,
                groupName: groupData?.name || selectedGroup?.name || 'Groupe de prière',
            }).catch(console.error);

            // Update local state
            setGroupJoinRequests(prev => prev.filter(r => r.id !== requestId));
            setPendingRequestCounts(prev => ({
                ...prev,
                [groupId]: Math.max(0, (prev[groupId] || 0) - 1)
            }));

            toast.success('✅ Membre approuvé!');
            loadGroups();
        } catch (e) {
            console.error('Error approving request:', e);
            toast.error("Erreur lors de l'approbation");
        }
    };

    // Reject a join request
    const rejectJoinRequest = async (requestId: string, groupId: string) => {
        try {
            await supabase
                .from('prayer_group_join_requests')
                .update({ status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: user?.id })
                .eq('id', requestId);

            setGroupJoinRequests(prev => prev.filter(r => r.id !== requestId));
            setPendingRequestCounts(prev => ({
                ...prev,
                [groupId]: Math.max(0, (prev[groupId] || 0) - 1)
            }));

            toast.info('Demande refusée');
        } catch (e) {
            console.error('Error rejecting request:', e);
        }
    };

    // Load group members  
    const loadGroupMembers = async (groupId: string) => {
        try {
            const { data, error } = await supabase
                .from('prayer_group_members')
                .select(`
                    *,
                    profiles:user_id(id, full_name, avatar_url)
                `)
                .eq('group_id', groupId);

            if (!error && data) {
                setGroupMembers(data);
            }
        } catch (e) {
            console.error('Error loading members:', e);
        }
    };

    // Remove a member from group (owner only)
    const removeGroupMember = async (groupId: string, memberId: string) => {
        if (!user) return;
        try {
            await supabase
                .from('prayer_group_members')
                .delete()
                .eq('group_id', groupId)
                .eq('user_id', memberId);

            setGroupMembers(prev => prev.filter(m => m.user_id !== memberId));
            toast.success('Membre retiré du groupe');
            loadGroups();
        } catch (e) {
            console.error('Error removing member:', e);
            toast.error("Erreur lors du retrait du membre");
        }
    };

    // Check if chat partner is a friend
    const checkFriendshipWithPartner = async (partnerId: string) => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('friendships')
                .select('id')
                .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
                .eq('status', 'accepted')
                .maybeSingle();

            setIsFriendWithChatPartner(!!data);
        } catch (e) {
            setIsFriendWithChatPartner(false);
        }
    };

    // Send friend request from DM
    const sendFriendRequestFromChat = async (partnerId: string) => {
        if (!user) return;
        try {
            // Check if already sent
            const { data: existing } = await supabase
                .from('friendships')
                .select('id')
                .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
                .maybeSingle();

            if (existing) {
                toast.info('Demande déjà envoyée ou vous êtes déjà amis');
                return;
            }

            await supabase.from('friendships').insert({
                sender_id: user.id,
                receiver_id: partnerId,
                status: 'pending'
            });

            toast.success("Demande d'ami envoyée! 🤝");
        } catch (e) {
            console.error('Error sending friend request:', e);
            toast.error("Erreur lors de l'envoi de la demande d'ami");
        }
    };


    // Load direct messages for a conversation
    const loadDirectMessages = async (conversationId: string) => {
        setLoadingDMs(true);
        try {
            const { data, error } = await supabase
                .from('direct_messages')
                .select('*')
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: true })
                .limit(100);

            if (!error && data) {
                // Fetch sender profiles separately
                const messagesWithSenders = await Promise.all(data.map(async (msg) => {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('id, full_name, avatar_url')
                        .eq('id', msg.sender_id)
                        .single();
                    return { ...msg, sender: profile };
                }));
                setDirectMessages(messagesWithSenders);
            } else {
                console.log('Direct messages error:', error?.message);
                setDirectMessages([]);
            }
        } catch (e) {
            console.error('Error loading DMs:', e);
            setDirectMessages([]);
        }
        setLoadingDMs(false);
    };

    // Send direct message with optimistic update
    const sendDirectMessage = async () => {
        if (!newMessage.trim() || !user || !selectedConversation) return;

        const messageContent = newMessage.trim();
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        // Optimistic update: add message to UI immediately
        const optimisticMessage = {
            id: tempId,
            conversation_id: selectedConversation.id,
            sender_id: user.id,
            content: messageContent,
            type: 'text',
            created_at: new Date().toISOString(),
            sender: { id: user.id, full_name: user.name || 'Moi', avatar_url: user.avatar || null }
        };

        setDirectMessages(prev => [...prev, optimisticMessage]);
        setNewMessage('');

        // Scroll to bottom immediately
        requestAnimationFrame(() => {
            if (chatScrollRef.current) {
                chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
            }
        });

        try {
            const { data, error } = await supabase
                .from('direct_messages')
                .insert({
                    conversation_id: selectedConversation.id,
                    sender_id: user.id,
                    content: messageContent,
                    type: 'text'
                })
                .select()
                .single();

            if (error) throw error;

            // Replace temp message with real one from server
            if (data) {
                setDirectMessages(prev =>
                    prev.map(m => m.id === tempId
                        ? { ...data, sender: optimisticMessage.sender }
                        : m
                    )
                );
            }

            // Update conversation's last_message timestamp
            await supabase
                .from('conversations')
                .update({ last_message_at: new Date().toISOString(), last_message: messageContent })
                .eq('id', selectedConversation.id);

            // Send notification to conversation partner
            if (selectedConversation.otherUser?.id) {
                notifyDirectMessage({
                    recipientId: selectedConversation.otherUser.id,
                    senderId: user.id,
                    senderName: user.name || 'Utilisateur',
                    messagePreview: messageContent,
                    conversationId: selectedConversation.id,
                });
            }

        } catch (e) {
            console.error('Error sending DM:', e);
            // Remove optimistic message on error
            setDirectMessages(prev => prev.filter(m => m.id !== tempId));
            setNewMessage(messageContent); // Restore the message
            toast.error("Erreur lors de l'envoi du message");
        }
    };

    // Load group messages
    const loadGroupMessages = async (groupId: string) => {
        setLoadingGroupMessages(true);
        try {
            const { data, error } = await supabase
                .from('prayer_group_messages')
                .select(`
                    *,
                    profiles:user_id(full_name, avatar_url)
                `)
                .eq('group_id', groupId)
                .order('created_at', { ascending: true })
                .limit(100);

            if (!error && data) {
                setGroupMessages(data);
            }
        } catch (e) {
            console.error('Error loading group messages:', e);
        }
        setLoadingGroupMessages(false);
    };

    // Send group message with optimistic update
    const sendGroupMessage = async () => {
        if (!newMessage.trim() || !user || !selectedGroup) return;

        const messageContent = newMessage.trim();
        const tempId = `temp_grp_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        // Optimistic update
        const optimisticMsg = {
            id: tempId,
            group_id: selectedGroup.id,
            user_id: user.id,
            content: messageContent,
            type: 'text',
            created_at: new Date().toISOString(),
            profiles: { full_name: user.name || 'Moi', avatar_url: user.avatar || null }
        };

        setGroupMessages(prev => [...prev, optimisticMsg]);
        setNewMessage('');

        // Scroll to bottom
        requestAnimationFrame(() => {
            if (chatScrollRef.current) {
                chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
            }
        });

        try {
            const { data, error } = await supabase
                .from('prayer_group_messages')
                .insert({
                    group_id: selectedGroup.id,
                    user_id: user.id,
                    content: messageContent
                })
                .select()
                .single();

            if (error) throw error;

            // Replace temp with real
            if (data) {
                setGroupMessages(prev =>
                    prev.map(m => m.id === tempId
                        ? { ...data, profiles: optimisticMsg.profiles }
                        : m
                    )
                );

                // Notify other group members of new message
                notifyGroupNewMessage({
                    groupId: selectedGroup.id,
                    groupName: selectedGroup.name || 'Groupe de prière',
                    senderId: user.id,
                    senderName: user.name,
                    messagePreview: messageContent,
                }).catch(console.error);
            }
        } catch (e) {
            console.error('Error sending group message:', e);
            setGroupMessages(prev => prev.filter(m => m.id !== tempId));
            setNewMessage(messageContent);
            toast.error("Erreur lors de l'envoi du message");
        }
    };

    // ========== VOICE RECORDING FUNCTIONS ==========

    // Start recording voice message
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.start(100); // Collect data every 100ms
            setIsRecording(true);
            setRecordingTime(0);

            // Start timer
            recordingIntervalRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

            toast.info("🎤 Enregistrement en cours...");
        } catch (error) {
            console.error('Error starting recording:', error);
            toast.error("Impossible d'accéder au microphone");
        }
    };

    // Stop recording and send
    const stopRecording = async (mode: 'dm' | 'group') => {
        if (!mediaRecorderRef.current || !isRecording) return;

        return new Promise<void>((resolve) => {
            mediaRecorderRef.current!.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const duration = recordingTime;

                // Stop all tracks
                mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());

                // Clear interval
                if (recordingIntervalRef.current) {
                    clearInterval(recordingIntervalRef.current);
                }

                setIsRecording(false);
                setRecordingTime(0);

                // Send the voice message
                if (mode === 'dm') {
                    await sendVoiceMessageDM(audioBlob, duration);
                } else {
                    await sendVoiceMessageGroup(audioBlob, duration);
                }

                resolve();
            };

            mediaRecorderRef.current!.stop();
        });
    };

    // Cancel recording
    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }

        if (recordingIntervalRef.current) {
            clearInterval(recordingIntervalRef.current);
        }

        setIsRecording(false);
        setRecordingTime(0);
        audioChunksRef.current = [];
        toast.info("Enregistrement annulé");
    };

    // Send voice message for DM
    const sendVoiceMessageDM = async (audioBlob: Blob, duration: number) => {
        if (!user || !selectedConversation) return;

        setIsUploadingVoice(true);
        try {
            // Generate unique filename
            const filename = `voice-messages/${user.id}/${Date.now()}.webm`;

            // Upload to Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('chat-media')
                .upload(filename, audioBlob, {
                    contentType: 'audio/webm',
                    upsert: false
                });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: urlData } = supabase.storage
                .from('chat-media')
                .getPublicUrl(filename);

            const voiceUrl = urlData.publicUrl;

            // Insert message with voice data
            const { error: insertError } = await supabase
                .from('direct_messages')
                .insert({
                    conversation_id: selectedConversation.id,
                    sender_id: user.id,
                    content: '🎤 Message vocal',
                    type: 'voice',
                    voice_url: voiceUrl,
                    voice_duration: duration
                });

            if (insertError) throw insertError;

            toast.success("Message vocal envoyé! 🎤");
            loadDirectMessages(selectedConversation.id);
        } catch (error) {
            console.error('Error sending voice message:', error);
            toast.error("Erreur lors de l'envoi du message vocal");
        }
        setIsUploadingVoice(false);
    };

    // Send voice message for Group
    const sendVoiceMessageGroup = async (audioBlob: Blob, duration: number) => {
        if (!user || !selectedGroup) return;

        setIsUploadingVoice(true);
        try {
            // Generate unique filename
            const filename = `voice-messages/${user.id}/${Date.now()}.webm`;

            // Upload to Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('chat-media')
                .upload(filename, audioBlob, {
                    contentType: 'audio/webm',
                    upsert: false
                });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: urlData } = supabase.storage
                .from('chat-media')
                .getPublicUrl(filename);

            const voiceUrl = urlData.publicUrl;

            // Insert message with voice data
            const { error: insertError } = await supabase
                .from('prayer_group_messages')
                .insert({
                    group_id: selectedGroup.id,
                    user_id: user.id,
                    content: '🎤 Message vocal',
                    type: 'voice',
                    voice_url: voiceUrl,
                    voice_duration: duration
                });

            if (insertError) throw insertError;

            toast.success("Message vocal envoyé! 🎤");
            loadGroupMessages(selectedGroup.id);
        } catch (error) {
            console.error('Error sending voice message:', error);
            toast.error("Erreur lors de l'envoi du message vocal");
        }
        setIsUploadingVoice(false);
    };

    // Format recording time
    const formatRecordingTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Join prayer group
    const joinGroup = async (groupId: string) => {
        if (!user) return;
        try {
            const { error } = await supabase
                .from('prayer_group_members')
                .insert({
                    group_id: groupId,
                    user_id: user.id
                });

            if (error && !error.message.includes('duplicate')) throw error;
            toast.success('Vous avez rejoint le groupe!');
            setUserGroups(prev => [...prev, groupId]);
            loadGroups(); // Refresh
        } catch (e) {
            console.error('Error joining group:', e);
            toast.error("Erreur lors de l'adhésion au groupe");
        }
    };

    // Leave prayer group
    const leaveGroup = async (groupId: string) => {
        if (!user) return;
        try {
            const { error } = await supabase
                .from('prayer_group_members')
                .delete()
                .eq('group_id', groupId)
                .eq('user_id', user.id);

            if (error) throw error;
            toast.success('Vous avez quitté le groupe');
            setUserGroups(prev => prev.filter(id => id !== groupId));
            loadGroups();
        } catch (e) {
            console.error('Error leaving group:', e);
            toast.error("Erreur lors de la désinscription du groupe");
        }
    };

    // Create prayer group - Fixed version with direct insert fallback
    const createGroup = async () => {
        if (!user || !newGroupName.trim()) return;
        setCreatingGroup(true);
        try {
            // Try RPC first
            let groupId: string | null = null;
            const { data: rpcData, error: rpcError } = await supabase.rpc('create_prayer_group', {
                group_name: newGroupName.trim(),
                group_description: newGroupDescription.trim() || null,
                is_public_group: true
            });

            if (rpcError) {
                console.log('RPC failed, using direct insert:', rpcError.message);
                // Fallback to direct insert without is_public
                const { data: insertData, error: insertError } = await supabase
                    .from('prayer_groups')
                    .insert({
                        name: newGroupName.trim(),
                        description: newGroupDescription.trim() || null,
                        created_by: user.id,
                        is_open: true
                    })
                    .select()
                    .single();

                if (insertError) throw insertError;
                groupId = insertData?.id;

                // Add creator as admin
                if (groupId) {
                    await supabase.from('prayer_group_members').insert({
                        group_id: groupId,
                        user_id: user.id,
                        role: 'admin'
                    });
                }
            } else {
                groupId = rpcData;
            }

            toast.success('🙏 Groupe de prière créé avec succès!');
            setNewGroupName('');
            setNewGroupDescription('');
            setShowCreateGroupDialog(false);
            if (groupId) {
                setUserGroups(prev => [...prev, groupId!]);
            }
            loadGroups();
        } catch (e) {
            console.error('Error creating group:', e);
            toast.error("Erreur lors de la création du groupe");
        }
        setCreatingGroup(false);
    };

    // Load user's joined groups
    const loadUserGroups = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('prayer_group_members')
                .select('group_id')
                .eq('user_id', user.id);

            if (!error && data) {
                setUserGroups(data.map(m => m.group_id));
            }
        } catch (e) {
            console.error('Error loading user groups:', e);
        }
    };

    // Setup real-time subscription for group messages
    useEffect(() => {
        if (viewState === 'group-detail' && selectedGroup) {
            const subscription = supabase
                .channel(`group_rt_${selectedGroup.id}_${Date.now()}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'prayer_group_messages',
                    filter: `group_id=eq.${selectedGroup.id}`
                }, async (payload) => {
                    const newMsg = payload.new as any;

                    // Skip if already exists (from optimistic update)
                    setGroupMessages(prev => {
                        if (prev.some(m => m.id === newMsg.id)) return prev;
                        // If own message, replace temp
                        if (newMsg.user_id === user?.id) {
                            const tempIdx = prev.findIndex(m =>
                                typeof m.id === 'string' && m.id.startsWith('temp_grp_')
                            );
                            if (tempIdx !== -1) {
                                const updated = [...prev];
                                updated[tempIdx] = { ...newMsg, profiles: prev[tempIdx].profiles };
                                return updated;
                            }
                        }
                        return prev; // Will be added after profile fetch below
                    });

                    // Fetch profile for new message from another user
                    if (newMsg.user_id !== user?.id) {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('full_name, avatar_url')
                            .eq('id', newMsg.user_id)
                            .single();

                        setGroupMessages(prev => {
                            if (prev.some(m => m.id === newMsg.id)) return prev;
                            return [...prev, { ...newMsg, profiles: profile || { full_name: 'Utilisateur', avatar_url: null } }];
                        });

                        // Scroll to see new message
                        requestAnimationFrame(() => {
                            if (chatScrollRef.current) {
                                chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
                            }
                        });
                    }
                })
                .subscribe();

            return () => {
                subscription.unsubscribe();
            };
        }
    }, [viewState, selectedGroup]);

    // Load user groups on mount + Realtime group deletion sync
    useEffect(() => {
        if (user) {
            loadUserGroups();
            loadUserFriends();
            loadPendingJoinRequests();

            // Listen for group deletions by admin
            const groupDeleteSub = supabase
                .channel('group_deletions_sync')
                .on('postgres_changes', {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'prayer_groups'
                }, (payload) => {
                    const deletedGroupId = payload.old?.id;
                    if (!deletedGroupId) return;

                    // Remove from groups list
                    setGroups((prev: PrayerGroup[]) => prev.filter(g => g.id !== deletedGroupId));
                    // Remove from user's joined groups
                    setUserGroups((prev: string[]) => prev.filter(id => id !== deletedGroupId));

                    // If user is viewing this group, redirect back
                    if (selectedGroup?.id === deletedGroupId) {
                        setViewState('main');
                        toast.info('Ce groupe a été supprimé par un administrateur');
                    }
                })
                .subscribe();

            return () => {
                groupDeleteSub.unsubscribe();
            };
        }
    }, [user, selectedGroup?.id]);

    // Load conversations and users when accessing messages view
    useEffect(() => {
        if (viewState === 'messages' && user) {
            loadConversations();
            loadUsers();
            loadGroups(); // Also load groups for the combined view
        }
    }, [viewState, user]);

    // Real-time subscription for direct messages
    useEffect(() => {
        if (viewState === 'conversation' && selectedConversation) {
            // Initial load
            loadDirectMessages(selectedConversation.id);

            // Check if chat partner is a friend
            if (selectedConversation.otherUser?.id) {
                checkFriendshipWithPartner(selectedConversation.otherUser.id);
            }

            // Setup realtime subscription
            const channelName = `dm_cv_${selectedConversation.id}_${Date.now()}`;
            const subscription = supabase
                .channel(channelName)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'direct_messages',
                    filter: `conversation_id=eq.${selectedConversation.id}`
                }, async (payload) => {
                    const newMsg = payload.new as any;

                    // Skip if we already have this message (optimistic or duplicate)
                    setDirectMessages(prev => {
                        if (prev.some(m => m.id === newMsg.id)) return prev;
                        // If this is our own message, replace the temp one
                        if (newMsg.sender_id === user?.id) {
                            const tempIdx = prev.findIndex(m =>
                                typeof m.id === 'string' && m.id.startsWith('temp_') && m.sender_id === user?.id
                            );
                            if (tempIdx !== -1) {
                                const updated = [...prev];
                                updated[tempIdx] = { ...newMsg, sender: prev[tempIdx].sender };
                                return updated;
                            }
                            // No temp found but we don't have it - add it
                            return [...prev, { ...newMsg, sender: { id: user.id, full_name: user.name || 'Moi' } }];
                        }
                        // Message from other user - add it immediately
                        return [...prev, { ...newMsg, sender: { id: newMsg.sender_id, full_name: '...' } }];
                    });

                    // If message is from other user, fetch their profile and update
                    if (newMsg.sender_id !== user?.id) {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('id, full_name, avatar_url')
                            .eq('id', newMsg.sender_id)
                            .single();

                        if (profile) {
                            setDirectMessages(prev =>
                                prev.map(m => m.id === newMsg.id ? { ...m, sender: profile } : m)
                            );
                        }

                        // Scroll to see new message
                        requestAnimationFrame(() => {
                            if (chatScrollRef.current) {
                                chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
                            }
                        });
                    }
                })
                .subscribe();

            return () => {
                subscription.unsubscribe();
            };
        }
    }, [viewState, selectedConversation?.id]);

    const sendChatMessage = async () => {
        if (!newMessage.trim() || !user) return;

        try {
            const { error } = await supabase
                .from('community_messages')
                .insert({
                    user_id: user.id,
                    content: newMessage.trim()
                });

            if (error) throw error;
            setNewMessage('');
        } catch (e) {
            console.error('Error sending message:', e);
            toast.error("Erreur lors de l'envoi du message");
        }
    };

    const handlePublish = async () => {
        if (!newContent.trim() || !user) return;

        setIsSubmitting(true);
        try {
            if (dialogType === 'prayer') {
                await addPrayerRequest(newContent, isAnonymous, newCategory, newPhotos);

                // Get the newly created prayer's ID from the store 
                const latestPrayers = useAppStore.getState().prayerRequests;
                const newPrayerId = latestPrayers.length > 0 ? latestPrayers[0].id : null;

                // If createGroupWithPrayer is toggled, also create a group
                if (createGroupWithPrayer) {
                    try {
                        const groupName = `\u{1F64F} Prière: ${newContent.substring(0, 50)}${newContent.length > 50 ? '...' : ''}`;
                        const insertData: any = {
                            name: groupName,
                            description: newContent.substring(0, 200),
                            created_by: user.id,
                            is_open: true,
                            requires_approval: true,
                        };
                        // Link prayer_request_id if we have it
                        if (newPrayerId) {
                            insertData.prayer_request_id = newPrayerId;
                        }
                        const { data: groupData, error: groupError } = await supabase
                            .from('prayer_groups')
                            .insert(insertData)
                            .select()
                            .single();

                        if (!groupError && groupData) {
                            // Add creator as admin
                            await supabase.from('prayer_group_members').insert({
                                group_id: groupData.id,
                                user_id: user.id,
                                role: 'admin'
                            });
                            setUserGroups(prev => [...prev, groupData.id]);
                            loadGroups();
                            toast.success('\u{1F64F} Demande + groupe de prière créés!');
                        }
                    } catch (ge) {
                        console.error('Error creating linked group:', ge);
                        toast.success('Demande publiée! (groupe non créé)');
                    }
                } else {
                    toast.success('Demande de prière publiée!');
                }

                // Send notification to all users about new prayer
                if (newPrayerId) {
                    notifyNewPrayer({
                        excludeUserId: user.id,
                        prayerContent: newContent,
                        userName: user.name,
                        prayerId: newPrayerId,
                        isAnonymous,
                    }).catch(console.error);
                }
            } else {
                await addTestimonial(newContent, newPhotos);
                toast.success('Témoignage publié!');
            }

            // Reset form
            setNewContent('');
            setNewPhotos([]);
            setNewCategory('other');
            setIsAnonymous(false);
            setCreateGroupWithPrayer(false);
            setIsDialogOpen(false);
        } catch (e) {
            toast.error('Erreur lors de la publication');
        }
        setIsSubmitting(false);
    };

    // Filter prayer requests
    const filteredRequests = prayerRequests.filter(req => {
        if (selectedCategory !== 'all' && req.category !== selectedCategory) return false;
        if (showAnsweredOnly && !req.isAnswered) return false;
        return true;
    });

    // Get category info
    const getCategoryInfo = (catId: PrayerCategory) => {
        return PRAYER_CATEGORIES.find(c => c.id === catId);
    };

    // ========== CALL LISTENER ==========
    const { incomingCall, acceptCall, rejectCall } = useCallListener(user?.id);

    return (
        <div className="relative min-h-screen bg-gradient-to-b from-[#0B0E14] to-[#0F1219] text-white pb-0">
            {/* Incoming Call Overlay */}
            <AnimatePresence>
                {incomingCall && (
                    <IncomingCallOverlay
                        call={incomingCall}
                        onAccept={acceptCall}
                        onReject={rejectCall}
                    />
                )}
            </AnimatePresence>

            {/* Background Effects */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] bg-pink-600/5 blur-[150px] rounded-full" />
                <div className="absolute bottom-[-20%] left-[-20%] w-[50%] h-[50%] bg-purple-600/5 blur-[150px] rounded-full" />
            </div>

            <AnimatePresence mode="wait">
                {/* ========== MAIN COMMUNITY VIEW ========== */}
                {viewState === 'main' && (
                    <motion.div
                        key="main"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="relative z-10 min-h-screen pb-24 max-w-4xl mx-auto w-full"
                    >
                        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="flex flex-col min-h-screen">
                            {/* Header - Sticky on scroll for PC & mobile */}
                            <header className="px-4 pt-10 pb-3 sticky top-0 z-30 bg-gradient-to-b from-[#0B0E14] via-[#0B0E14] to-[#0B0E14]/95 backdrop-blur-xl">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="shrink-0">
                                        <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-white via-pink-200 to-purple-200 bg-clip-text text-transparent">
                                            Communauté
                                        </h1>
                                        <p className="text-slate-500 text-xs font-medium mt-0.5">Prions ensemble</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {!user && (
                                            <Button
                                                size="sm"
                                                className="rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 border-0 gap-1.5 px-4 h-9 text-xs font-bold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all"
                                                onClick={() => setGlobalActiveTab('profile')}
                                            >
                                                <LogIn className="h-3.5 w-3.5" />
                                                Se connecter
                                            </Button>
                                        )}
                                        <NotificationBell />
                                    </div>
                                </div>
                                {/* Row 1: Social actions */}
                                <div className="flex gap-2 pb-1.5 -mx-1 px-1">
                                    <Button
                                        size="sm"
                                        className="flex-1 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 border-0 gap-1.5 px-3 h-9 text-xs font-bold"
                                        onClick={() => requireAuth(() => setViewState('friends'))}
                                    >
                                        <UserPlus className="h-3.5 w-3.5" />
                                        Amis
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 border-0 gap-1.5 px-3 h-9 text-xs font-bold"
                                        onClick={() => requireAuth(() => { loadGroups(); setViewState('groups'); })}
                                    >
                                        <Users className="h-3.5 w-3.5" />
                                        Groupes
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 border-0 gap-1.5 px-3 h-9 text-xs font-bold"
                                        onClick={() => requireAuth(() => setViewState('messages'))}
                                    >
                                        <MessageCircle className="h-3.5 w-3.5" />
                                        Messages
                                    </Button>
                                </div>
                                {/* Row 2: Content actions */}
                                <div className="flex gap-2 pb-2 -mx-1 px-1">
                                    <EventCalendarButton />
                                    <Button
                                        size="sm"
                                        className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 border-0 gap-1.5 px-3 h-9 text-xs font-bold relative overflow-hidden animate-pulse shadow-lg shadow-amber-500/30"
                                        onClick={() => { setBibleViewTarget('games'); setGlobalActiveTab('bible'); }}
                                    >
                                        <Gamepad2 className="h-3.5 w-3.5" />
                                        Jeux Bibliques
                                        <span className="absolute inset-0 bg-white/20 animate-ping rounded-xl" style={{ animationDuration: '2s' }} />
                                    </Button>
                                </div>

                                {/* Tab List - stays in header */}
                                <TabsList className="w-full bg-white/5 p-1 rounded-2xl">
                                    <TabsTrigger
                                        value="prayers"
                                        className="flex-1 data-[state=active]:bg-indigo-600 rounded-xl font-bold text-xs"
                                    >
                                        Prières
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="testimonials"
                                        className="flex-1 data-[state=active]:bg-indigo-600 rounded-xl font-bold text-xs"
                                    >
                                        Témoignages
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="chat"
                                        className="flex-1 data-[state=active]:bg-indigo-600 rounded-xl font-bold text-xs"
                                    >
                                        Chat
                                    </TabsTrigger>
                                </TabsList>
                            </header>

                            {/* Content - Naturally scrollable on PC */}
                            <div className="flex-1 px-4">
                                {/* ===== PRAYERS TAB ===== */}
                                <TabsContent value="prayers" className="mt-4 flex-1">
                                    {/* Category Filter */}
                                    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-3">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className={cn(
                                                "shrink-0 h-9 px-4 rounded-xl text-xs font-bold transition-all",
                                                selectedCategory === 'all' ? "bg-indigo-600 text-white" : "bg-white/5 text-slate-400"
                                            )}
                                            onClick={() => setSelectedCategory('all')}
                                        >
                                            Toutes
                                        </Button>
                                        {PRAYER_CATEGORIES.slice(0, 6).map(cat => (
                                            <Button
                                                key={cat.id}
                                                variant="ghost"
                                                size="sm"
                                                className={cn(
                                                    "shrink-0 h-9 px-3 rounded-xl text-xs font-bold transition-all gap-1.5",
                                                    selectedCategory === cat.id ? "text-white" : "bg-white/5 text-slate-400"
                                                )}
                                                style={{
                                                    backgroundColor: selectedCategory === cat.id ? `${cat.color}cc` : undefined
                                                }}
                                                onClick={() => setSelectedCategory(cat.id)}
                                            >
                                                <span>{cat.icon}</span>
                                                {cat.nameFr}
                                            </Button>
                                        ))}
                                    </div>

                                    {/* Answered Filter Toggle */}
                                    <div className="flex items-center justify-between py-2">
                                        <span className="text-xs text-slate-500">{filteredRequests.length} demandes</span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className={cn(
                                                "h-8 px-3 rounded-xl text-xs font-bold gap-1.5",
                                                showAnsweredOnly ? "bg-emerald-600/20 text-emerald-400" : "bg-white/5 text-slate-400"
                                            )}
                                            onClick={() => setShowAnsweredOnly(!showAnsweredOnly)}
                                        >
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                            Exaucées
                                        </Button>
                                    </div>

                                    {/* Prayer List */}
                                    <div className="space-y-4 pb-32">
                                        {filteredRequests.map((prayer) => (
                                            <PrayerCard
                                                key={prayer.id}
                                                prayer={prayer}
                                                onPray={() => prayForRequest(prayer.id)}
                                                onDelete={(id) => {
                                                    // Optimistic removal from store
                                                    useAppStore.getState().removePrayerRequest(id);
                                                }}
                                                getCategoryInfo={getCategoryInfo}
                                                userId={user?.id}
                                            />
                                        ))}

                                        {filteredRequests.length === 0 && (
                                            <div className="text-center py-12">
                                                <MessageSquare className="h-12 w-12 text-slate-700 mx-auto mb-4" />
                                                <p className="text-slate-500">Aucune demande de prière</p>
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>

                                {/* ===== TESTIMONIALS TAB ===== */}
                                <TabsContent value="testimonials" className="mt-4 flex-1">
                                    <div className="space-y-4 pb-32">
                                        {testimonials.map((testimony) => (
                                            <TestimonyCard
                                                key={testimony.id}
                                                testimony={testimony}
                                                onLike={() => likeTestimonial(testimony.id)}
                                                userId={user?.id}
                                            />
                                        ))}

                                        {testimonials.length === 0 && (
                                            <div className="text-center py-12">
                                                <Sparkles className="h-12 w-12 text-slate-700 mx-auto mb-4" />
                                                <p className="text-slate-500">Aucun témoignage</p>
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>

                                {/* ===== CHAT TAB - WhatsApp Style ===== */}
                                <TabsContent value="chat" className="mt-0 flex flex-col -mx-4">
                                    <div className="relative flex-1" style={{ height: 'calc(100dvh - 300px)', minHeight: '400px', maxHeight: 'calc(100dvh - 200px)' }}>
                                        <WhatsAppChat
                                            user={user ? {
                                                id: user.id,
                                                name: user.name || 'Utilisateur',
                                                avatar: user.avatar
                                            } : null}
                                            onHideNav={onHideNav}
                                        />
                                    </div>
                                </TabsContent>
                            </div>
                        </Tabs>

                        {/* Floating Add Button */}
                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                                <Button
                                    className="fixed bottom-24 right-6 h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 shadow-lg shadow-indigo-600/30 z-50"
                                    onClick={() => {
                                        if (!user) { setShowAuthPrompt(true); return; }
                                        setDialogType(activeTab === 'testimonials' ? 'testimonial' : 'prayer');
                                        setIsDialogOpen(true);
                                    }}
                                >
                                    <Plus className="h-6 w-6" />
                                </Button>
                            </DialogTrigger>

                            <DialogContent className="bg-[#0F1219] border-white/10 text-white max-w-md rounded-[2rem] max-h-[85vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle className="text-xl font-bold">
                                        {dialogType === 'prayer' ? 'Nouvelle demande de prière' : 'Nouveau témoignage'}
                                    </DialogTitle>
                                    <DialogDescription className="text-slate-400">
                                        Partagez avec la communauté pour recevoir du soutien.
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="space-y-6 pt-4">
                                    {/* Category Selection (Prayer only) */}
                                    {dialogType === 'prayer' && (
                                        <div className="space-y-3">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                                Catégorie
                                            </label>
                                            <div className="flex flex-wrap gap-2">
                                                {PRAYER_CATEGORIES.map(cat => (
                                                    <Button
                                                        key={cat.id}
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className={cn(
                                                            "h-9 px-3 rounded-xl text-xs font-bold gap-1.5 transition-all",
                                                            newCategory === cat.id ? "text-white ring-2 ring-white/20" : "bg-white/5"
                                                        )}
                                                        style={{
                                                            backgroundColor: newCategory === cat.id ? `${cat.color}cc` : undefined
                                                        }}
                                                        onClick={() => setNewCategory(cat.id)}
                                                    >
                                                        <span>{cat.icon}</span>
                                                        {cat.nameFr}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Content */}
                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                            {dialogType === 'prayer' ? 'Votre demande' : 'Votre témoignage'}
                                        </label>
                                        <Textarea
                                            placeholder={dialogType === 'prayer'
                                                ? "Partagez votre sujet de prière..."
                                                : "Racontez ce que Dieu a fait dans votre vie..."}
                                            value={newContent}
                                            onChange={(e) => setNewContent(e.target.value)}
                                            className="min-h-[120px] bg-white/5 border-white/10 rounded-2xl resize-none"
                                        />
                                    </div>

                                    {/* Photo Upload */}
                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                            Photos (optionnel)
                                        </label>
                                        <PhotoUpload
                                            bucket={dialogType === 'prayer' ? 'prayer-photos' : 'testimony-photos'}
                                            maxPhotos={3}
                                            onPhotosChange={setNewPhotos}
                                        />
                                    </div>

                                    {/* Anonymous Toggle (Prayer only) */}
                                    {dialogType === 'prayer' && (
                                        <div
                                            className={cn(
                                                "flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border",
                                                isAnonymous ? "bg-indigo-600/20 border-indigo-500/30" : "bg-white/5 border-white/10"
                                            )}
                                            onClick={() => setIsAnonymous(!isAnonymous)}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl flex items-center justify-center">
                                                    <Lock className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm">Publier anonymement</p>
                                                    <p className="text-xs text-slate-500">Votre nom ne sera pas visible</p>
                                                </div>
                                            </div>
                                            <div className={cn(
                                                "w-6 h-6 rounded-lg flex items-center justify-center transition-all",
                                                isAnonymous ? "bg-indigo-600" : "bg-white/10"
                                            )}>
                                                {isAnonymous && <Check className="h-4 w-4" />}
                                            </div>
                                        </div>
                                    )}

                                    {/* Create Group Toggle (Prayer only) */}
                                    {dialogType === 'prayer' && (
                                        <div
                                            className={cn(
                                                "flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border",
                                                createGroupWithPrayer ? "bg-emerald-600/20 border-emerald-500/30" : "bg-white/5 border-white/10"
                                            )}
                                            onClick={() => setCreateGroupWithPrayer(!createGroupWithPrayer)}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600/30 to-teal-600/30 flex items-center justify-center">
                                                    <Users className="h-5 w-5 text-emerald-400" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm">Créer un groupe de prière</p>
                                                    <p className="text-xs text-slate-500">D'autres pourront rejoindre pour prier ensemble</p>
                                                </div>
                                            </div>
                                            <div className={cn(
                                                "w-6 h-6 rounded-lg flex items-center justify-center transition-all",
                                                createGroupWithPrayer ? "bg-emerald-600" : "bg-white/10"
                                            )}>
                                                {createGroupWithPrayer && <Check className="h-4 w-4" />}
                                            </div>
                                        </div>
                                    )}

                                    {/* Submit Button */}
                                    <Button
                                        className="w-full h-14 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 font-bold text-lg"
                                        onClick={handlePublish}
                                        disabled={!newContent.trim() || isSubmitting}
                                    >
                                        {isSubmitting ? (
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                        ) : (
                                            <>
                                                <Send className="h-5 w-5 mr-2" />
                                                Publier
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </motion.div>
                )}

                {/* ========== GROUPS VIEW ========== */}
                {viewState === 'groups' && (
                    <motion.div
                        key="groups"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="relative z-10 flex flex-col min-h-screen pb-24 max-w-4xl mx-auto w-full overflow-x-hidden"
                    >
                        <header className="px-4 sm:px-6 pt-12 pb-4">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="shrink-0"
                                        onClick={() => setViewState('main')}
                                    >
                                        <ArrowLeft className="h-5 w-5" />
                                    </Button>
                                    <div className="min-w-0">
                                        <h1 className="text-xl sm:text-2xl font-bold truncate">Groupes</h1>
                                        <p className="text-xs text-slate-500">
                                            {groups.filter(g => userGroups.includes(g.id)).length} rejoint(s) • {groups.length} total
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    className="rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 font-bold px-4 h-9 shadow-lg shadow-emerald-600/30 transition-all border-2 border-emerald-400/30 text-xs sm:text-sm w-full sm:w-auto"
                                    onClick={() => setShowCreateGroupDialog(true)}
                                >
                                    <Plus className="h-4 w-4 mr-1.5" />
                                    Créer un groupe
                                </Button>
                            </div>
                        </header>

                        {/* Create Group Dialog */}
                        <Dialog open={showCreateGroupDialog} onOpenChange={setShowCreateGroupDialog}>
                            <DialogContent className="bg-[#0F1219] border-white/10 text-white max-w-md rounded-[2rem]">
                                <DialogHeader>
                                    <DialogTitle className="text-xl font-bold">Créer un groupe de prière</DialogTitle>
                                    <DialogDescription className="text-slate-400">
                                        Créez un espace pour prier ensemble
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 pt-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                            Nom du groupe
                                        </label>
                                        <Input
                                            placeholder="Ex: Prière pour les familles"
                                            value={newGroupName}
                                            onChange={(e) => setNewGroupName(e.target.value)}
                                            className="h-12 rounded-2xl bg-white/5 border-white/10"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                            Description (optionnel)
                                        </label>
                                        <Textarea
                                            placeholder="Décrivez l'objectif du groupe..."
                                            value={newGroupDescription}
                                            onChange={(e) => setNewGroupDescription(e.target.value)}
                                            className="min-h-[100px] bg-white/5 border-white/10 rounded-2xl resize-none"
                                        />
                                    </div>
                                    <Button
                                        className="w-full h-12 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 font-bold"
                                        onClick={createGroup}
                                        disabled={!newGroupName.trim() || creatingGroup}
                                    >
                                        {creatingGroup ? (
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                        ) : (
                                            <>
                                                <Plus className="h-5 w-5 mr-2" />
                                                Créer le groupe
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>

                        <ScrollArea className="flex-1 px-6">
                            <div className="space-y-6 pb-32">
                                {/* ===== MES GROUPES ===== */}
                                {groups.filter(g => userGroups.includes(g.id)).length > 0 && (
                                    <div>
                                        <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                            <UserCheck className="h-3.5 w-3.5" />
                                            Mes Groupes ({groups.filter(g => userGroups.includes(g.id)).length})
                                        </h3>
                                        <div className="space-y-3">
                                            {groups.filter(g => userGroups.includes(g.id)).map((group) => (
                                                <Card
                                                    key={group.id}
                                                    className="bg-emerald-500/5 border-emerald-500/10 rounded-3xl overflow-hidden hover:bg-emerald-500/10 transition-all"
                                                >
                                                    <CardContent className="p-4 sm:p-5 break-words">
                                                        <div
                                                            className="flex items-start gap-3 sm:gap-4 cursor-pointer"
                                                            onClick={() => {
                                                                setSelectedGroup(group);
                                                                loadGroupMessages(group.id);
                                                                setViewState('group-detail');
                                                            }}
                                                        >
                                                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br from-emerald-600/30 to-teal-600/30 shrink-0">
                                                                <Users className="h-7 w-7 text-emerald-400" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                                                                    <h3 className="font-bold text-white truncate">{group.name}</h3>
                                                                    <Badge className="bg-emerald-500/20 text-emerald-400 border-none text-[10px]">
                                                                        <Check className="h-3 w-3 mr-1" />
                                                                        Membre
                                                                    </Badge>
                                                                    {(group.created_by === user?.id || group.createdBy === user?.id) && (
                                                                        <Badge className="bg-amber-500/20 text-amber-400 border-none text-[10px]">
                                                                            <Crown className="h-3 w-3 mr-1" />
                                                                            Créateur
                                                                        </Badge>
                                                                    )}
                                                                    {pendingRequestCounts[group.id] > 0 && (
                                                                        <Badge className="bg-orange-500/20 text-orange-400 border-none text-[10px] animate-pulse">
                                                                            <BellRing className="h-3 w-3 mr-1" />
                                                                            {pendingRequestCounts[group.id]} demande(s)
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <p className="text-sm text-slate-400 line-clamp-1">{group.description}</p>
                                                                <div className="flex items-center gap-3 mt-2">
                                                                    <span className="text-xs text-slate-500 flex items-center gap-1">
                                                                        <Users className="h-3 w-3" />
                                                                        {group.memberCount || 0} membres
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <ChevronRight className="h-5 w-5 text-emerald-400 shrink-0" />
                                                        </div>
                                                        <div className="mt-3 pt-3 border-t border-white/5 flex gap-2">
                                                            <Button
                                                                size="sm"
                                                                className="flex-1 h-9 rounded-xl bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30"
                                                                onClick={() => {
                                                                    setSelectedGroup(group);
                                                                    loadGroupMessages(group.id);
                                                                    setViewState('group-detail');
                                                                }}
                                                            >
                                                                <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                                                                Chat du groupe
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-9 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 px-3"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    leaveGroup(group.id);
                                                                }}
                                                            >
                                                                <X className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* ===== PENDING JOIN REQUESTS (for group creators) ===== */}
                                {groupJoinRequests.length > 0 && (
                                    <div>
                                        <h3 className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                            <BellRing className="h-3.5 w-3.5" />
                                            Demandes en attente ({groupJoinRequests.length})
                                        </h3>
                                        <div className="space-y-2">
                                            {groupJoinRequests.map((request) => {
                                                const group = groups.find(g => g.id === request.group_id);
                                                return (
                                                    <Card key={request.id} className="bg-orange-500/5 border-orange-500/10 rounded-2xl">
                                                        <CardContent className="p-4">
                                                            <div className="flex items-center gap-3">
                                                                <Avatar className="h-10 w-10">
                                                                    <AvatarImage src={request.profiles?.avatar_url || undefined} />
                                                                    <AvatarFallback className="bg-orange-500/20 text-orange-400 text-xs">
                                                                        {(request.profiles?.full_name || '?').substring(0, 2).toUpperCase()}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="font-bold text-sm text-white truncate">
                                                                        {request.profiles?.full_name || 'Utilisateur'}
                                                                    </p>
                                                                    <p className="text-[10px] text-slate-500">
                                                                        Veut rejoindre: <span className="text-slate-400">{group?.name || 'Groupe'}</span>
                                                                    </p>
                                                                </div>
                                                                <div className="flex gap-1.5">
                                                                    <Button
                                                                        size="sm"
                                                                        className="h-8 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs"
                                                                        onClick={() => approveJoinRequest(request.id, request.group_id, request.user_id)}
                                                                    >
                                                                        <Check className="h-3.5 w-3.5 mr-1" />
                                                                        Accepter
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        className="h-8 px-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20"
                                                                        onClick={() => rejectJoinRequest(request.id, request.group_id)}
                                                                    >
                                                                        <X className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* ===== COMMUNAUTÉS (Groups not joined) ===== */}
                                <div>
                                    <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <Globe className="h-3.5 w-3.5" />
                                        Communautés à découvrir ({groups.filter(g => !userGroups.includes(g.id)).length})
                                    </h3>
                                    {groups.filter(g => !userGroups.includes(g.id)).length === 0 ? (
                                        <div className="text-center py-8 bg-white/5 rounded-2xl">
                                            <Sparkles className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                                            <p className="text-slate-500 text-sm">Vous avez rejoint tous les groupes !</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {groups.filter(g => !userGroups.includes(g.id)).map((group) => (
                                                <Card
                                                    key={group.id}
                                                    className="bg-white/5 border-white/5 rounded-3xl overflow-hidden hover:bg-white/10 transition-all"
                                                >
                                                    <CardContent className="p-4 sm:p-5 break-words">
                                                        <div
                                                            className="flex items-start gap-3 sm:gap-4 cursor-pointer"
                                                            onClick={() => {
                                                                setSelectedGroup(group);
                                                                loadGroupMessages(group.id);
                                                                setViewState('group-detail');
                                                            }}
                                                        >
                                                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br from-indigo-600/30 to-purple-600/30 shrink-0">
                                                                <Users className="h-7 w-7 text-indigo-400" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                                    <h3 className="font-bold text-white truncate">{group.name}</h3>
                                                                    {group.isAnswered && (
                                                                        <Badge className="bg-amber-500/20 text-amber-400 border-none text-[10px]">
                                                                            <Sparkles className="h-3 w-3 mr-1" />
                                                                            Exaucée
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <p className="text-sm text-slate-400 line-clamp-2">{group.description}</p>
                                                                <div className="flex items-center gap-3 mt-2">
                                                                    <span className="text-xs text-slate-500 flex items-center gap-1">
                                                                        <Users className="h-3 w-3" />
                                                                        {group.memberCount || 0} membres
                                                                    </span>
                                                                    {!group.isOpen && (
                                                                        <span className="text-xs text-amber-400 flex items-center gap-1">
                                                                            <Lock className="h-3 w-3" />
                                                                            Fermé
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {/* Creator name */}
                                                                <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                                                                    <Crown className="h-3 w-3 text-amber-500" />
                                                                    Créé par {(group as any).profiles?.full_name || 'Utilisateur'}
                                                                </p>
                                                            </div>
                                                            <ChevronRight className="h-5 w-5 text-slate-500 shrink-0" />
                                                        </div>

                                                        {/* Friend suggestion - show if a friend is in this group */}
                                                        {userFriends.length > 0 && (
                                                            <div className="mt-2">
                                                                <span className="text-[10px] text-pink-400 flex items-center gap-1">
                                                                    <Heart className="h-3 w-3" />
                                                                    Des amis peuvent être dans ce groupe
                                                                </span>
                                                            </div>
                                                        )}

                                                        {/* Join / Request button - always visible */}
                                                        <div className="mt-3 pt-3 border-t border-white/5">
                                                            <Button
                                                                size="sm"
                                                                className={cn(
                                                                    "w-full h-10 rounded-xl font-bold",
                                                                    group.isOpen
                                                                        ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500"
                                                                        : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500"
                                                                )}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    requestJoinGroup(group.id);
                                                                }}
                                                            >
                                                                {group.isOpen ? (
                                                                    <>
                                                                        <UserPlus className="h-4 w-4 mr-2" />
                                                                        Rejoindre le groupe
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Shield className="h-4 w-4 mr-2" />
                                                                        Demander à rejoindre
                                                                    </>
                                                                )}
                                                            </Button>
                                                            {!group.isOpen && (
                                                                <p className="text-[10px] text-slate-600 mt-1.5 text-center">
                                                                    Le créateur du groupe approuvera votre demande
                                                                </p>
                                                            )}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {groups.length === 0 && (
                                    <div className="text-center py-12">
                                        <Users className="h-12 w-12 text-slate-700 mx-auto mb-4" />
                                        <p className="text-slate-500">Aucun groupe disponible</p>
                                        <p className="text-sm text-slate-600 mt-2">Créez le premier groupe de prière!</p>
                                        <Button
                                            className="mt-4 rounded-xl bg-indigo-600"
                                            onClick={() => setShowCreateGroupDialog(true)}
                                        >
                                            <Plus className="h-4 w-4 mr-2" />
                                            Créer un groupe
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </motion.div>
                )}

                {/* ========== GROUP DETAIL VIEW ========== */}
                {viewState === 'group-detail' && selectedGroup && (
                    <motion.div
                        key="group-detail"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="relative z-10 flex flex-col h-[100dvh] pb-0 max-w-4xl mx-auto w-full"
                    >
                        <header className="px-6 pt-12 pb-4 border-b border-white/5">
                            <div className="flex items-center gap-4 mb-4">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                        setSelectedGroup(null);
                                        setShowMembersPanel(false);
                                        setViewState('groups');
                                    }}
                                >
                                    <ArrowLeft className="h-5 w-5" />
                                </Button>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h1 className="text-xl font-black truncate">{selectedGroup.name}</h1>
                                        {selectedGroup.isAnswered && (
                                            <Badge className="bg-emerald-500/20 text-emerald-400 border-none shrink-0">
                                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                                Exaucée
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500">
                                        {selectedGroup.memberCount || 0} membres
                                        {!selectedGroup.isOpen && ' • Groupe fermé'}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    {/* Members Button (for creator) */}
                                    {(selectedGroup.created_by === user?.id || selectedGroup.createdBy === user?.id) && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="relative h-10 w-10 rounded-xl bg-white/5"
                                            onClick={() => {
                                                setShowMembersPanel(!showMembersPanel);
                                                if (!showMembersPanel) loadGroupMembers(selectedGroup.id);
                                            }}
                                        >
                                            <Users className="h-4 w-4" />
                                            {pendingRequestCounts[selectedGroup.id] > 0 && (
                                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold animate-pulse">
                                                    {pendingRequestCounts[selectedGroup.id]}
                                                </span>
                                            )}
                                        </Button>
                                    )}
                                    {/* Video Call Button */}
                                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                        <Button
                                            className="rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 shadow-lg shadow-green-600/30 border-0 gap-2 px-4 h-10"
                                            onClick={() => setViewState('group-call')}
                                        >
                                            <Video className="h-4 w-4" />
                                            <span className="text-xs font-bold">Appel</span>
                                        </Button>
                                    </motion.div>
                                </div>
                            </div>

                            {/* Pinned Prayer Subject */}
                            {selectedGroup.description && (
                                <div
                                    className="bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-3 cursor-pointer hover:bg-indigo-600/15 transition-all"
                                    onClick={() => setShowPinnedPrayer(!showPinnedPrayer)}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <Pin className="h-3.5 w-3.5 text-indigo-400" />
                                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Sujet de prière</span>
                                    </div>
                                    <p className={cn(
                                        "text-sm text-slate-300 transition-all",
                                        showPinnedPrayer ? "" : "line-clamp-2"
                                    )}>
                                        {selectedGroup.description}
                                    </p>
                                </div>
                            )}

                            {/* Members Panel (for creator) */}
                            <AnimatePresence>
                                {showMembersPanel && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden mt-3"
                                    >
                                        <div className="bg-white/5 rounded-2xl p-4 space-y-3">
                                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                                Membres ({groupMembers.length})
                                            </h3>

                                            {/* Pending requests for this group */}
                                            {groupJoinRequests.filter(r => r.group_id === selectedGroup.id).length > 0 && (
                                                <div className="space-y-2 pb-2 border-b border-white/5">
                                                    <span className="text-[10px] font-bold text-orange-400 uppercase">Demandes en attente</span>
                                                    {groupJoinRequests.filter(r => r.group_id === selectedGroup.id).map(req => (
                                                        <div key={req.id} className="flex items-center gap-2">
                                                            <Avatar className="h-7 w-7">
                                                                <AvatarImage src={req.profiles?.avatar_url || undefined} />
                                                                <AvatarFallback className="bg-orange-500/20 text-orange-400 text-[9px]">
                                                                    {(req.profiles?.full_name || '?').substring(0, 2).toUpperCase()}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <span className="text-xs text-white flex-1 truncate">{req.profiles?.full_name}</span>
                                                            <Button
                                                                size="sm"
                                                                className="h-6 px-2 rounded-lg bg-emerald-600 text-[10px]"
                                                                onClick={() => approveJoinRequest(req.id, req.group_id, req.user_id)}
                                                            >
                                                                <Check className="h-3 w-3" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-6 px-2 rounded-lg bg-red-500/10 text-red-400 text-[10px]"
                                                                onClick={() => rejectJoinRequest(req.id, req.group_id)}
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Current members */}
                                            {groupMembers.map(member => (
                                                <div key={member.id} className="flex items-center gap-2">
                                                    <Avatar className="h-7 w-7">
                                                        <AvatarImage src={member.profiles?.avatar_url || undefined} />
                                                        <AvatarFallback className="bg-indigo-500/20 text-indigo-400 text-[9px]">
                                                            {(member.profiles?.full_name || '?').substring(0, 2).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="text-xs text-white flex-1 truncate">
                                                        {member.profiles?.full_name || 'Membre'}
                                                    </span>
                                                    {member.role === 'admin' && (
                                                        <Badge className="bg-amber-500/20 text-amber-400 border-none text-[9px]">
                                                            <Crown className="h-2.5 w-2.5 mr-0.5" />
                                                            Admin
                                                        </Badge>
                                                    )}
                                                    {member.user_id !== user?.id && member.role !== 'admin' && (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-6 px-2 rounded-lg bg-red-500/10 text-red-400 text-[10px]"
                                                            onClick={() => removeGroupMember(selectedGroup.id, member.user_id)}
                                                        >
                                                            <X className="h-3 w-3 mr-0.5" />
                                                            Retirer
                                                        </Button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </header>

                        {/* Group Messages */}
                        <div
                            ref={chatScrollRef}
                            className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-4"
                        >
                            {loadingGroupMessages ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                                </div>
                            ) : groupMessages.length === 0 ? (
                                <div className="text-center py-12">
                                    <MessageSquare className="h-12 w-12 text-slate-700 mx-auto mb-4" />
                                    <p className="text-slate-500">Aucun message dans ce groupe</p>
                                    <p className="text-sm text-slate-600 mt-2">Soyez le premier à encourager!</p>
                                </div>
                            ) : (
                                groupMessages.map((msg) => (
                                    <ChatMessage
                                        key={msg.id}
                                        message={{
                                            ...msg,
                                            profiles: msg.profiles
                                        }}
                                        isOwn={msg.user_id === user?.id}
                                    />
                                ))
                            )}
                        </div>

                        {/* Message Input - Enhanced */}
                        {/* Message input - always visible for group members */}
                        {(
                            <div className="px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] border-t border-white/10 bg-slate-900/95 backdrop-blur-md sticky bottom-0 z-30">
                                {/* Emoji Picker */}
                                <div className="relative">
                                    <EmojiPicker
                                        isOpen={showGroupEmojiPicker}
                                        onClose={() => setShowGroupEmojiPicker(false)}
                                        onEmojiSelect={(emoji) => {
                                            setNewMessage(prev => prev + emoji);
                                            setShowGroupEmojiPicker(false);
                                        }}
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    {/* Emoji Button */}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setShowGroupEmojiPicker(!showGroupEmojiPicker)}
                                        className="h-10 w-10 rounded-full text-slate-400 hover:text-white hover:bg-white/10"
                                        disabled={isRecording}
                                    >
                                        <Smile className="h-5 w-5" />
                                    </Button>

                                    {/* Recording UI or Text Input */}
                                    {isRecording ? (
                                        <div className="flex-1 flex items-center gap-3 bg-red-500/20 rounded-full px-4 py-2">
                                            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                                            <span className="text-red-400 font-mono flex-1">
                                                {formatRecordingTime(recordingTime)}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={cancelRecording}
                                                className="text-slate-400 hover:text-white h-8 w-8"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => stopRecording('group')}
                                                className="text-green-400 hover:text-green-300 h-8 w-8"
                                            >
                                                <Send className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ) : isUploadingVoice ? (
                                        <div className="flex-1 flex items-center justify-center gap-2 bg-indigo-500/20 rounded-full px-4 py-2">
                                            <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                                            <span className="text-indigo-400 text-sm">Envoi du message vocal...</span>
                                        </div>
                                    ) : (
                                        <Input
                                            placeholder="Écrire un message..."
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && sendGroupMessage()}
                                            className="flex-1 h-10 rounded-full bg-white/5 border-white/10 px-4"
                                        />
                                    )}

                                    {/* Send or Mic Button */}
                                    {!isRecording && !isUploadingVoice && (
                                        newMessage.trim() ? (
                                            <Button
                                                size="icon"
                                                className="h-10 w-10 rounded-full bg-indigo-600 hover:bg-indigo-500"
                                                onClick={sendGroupMessage}
                                            >
                                                <Send className="h-5 w-5" />
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-10 w-10 rounded-full text-slate-400 hover:text-white hover:bg-white/10"
                                                onClick={startRecording}
                                            >
                                                <Mic className="h-5 w-5" />
                                            </Button>
                                        )
                                    )}
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* ========== GROUP CALL VIEW ========== */}
                {viewState === 'group-call' && selectedGroup && (
                    <motion.div
                        key="group-call"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="relative z-10 flex flex-col h-screen max-w-4xl mx-auto w-full"
                    >
                        <header className="px-6 pt-12 pb-4 border-b border-white/5">
                            <div className="flex items-center gap-4">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setViewState('group-detail')}
                                    className="hover:bg-white/5 rounded-full"
                                >
                                    <ArrowLeft className="h-5 w-5" />
                                </Button>
                                <div className="flex-1 min-w-0">
                                    <h1 className="text-xl font-black">📹 Appels de groupe</h1>
                                    <p className="text-xs text-slate-500">{selectedGroup.name}</p>
                                </div>
                            </div>
                        </header>
                        <div className="flex-1 overflow-hidden">
                            <GroupCallManager
                                user={user ? { id: user.id, name: user.name || '', avatar: user.avatar } : null}
                                groupId={selectedGroup.id}
                                groupName={selectedGroup.name}
                            />
                        </div>
                    </motion.div>
                )}

                {/* ========== MESSAGES (DM) LIST VIEW (WhatsApp Style) ========== */}
                {viewState === 'messages' && (
                    <motion.div
                        key="messages"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="relative z-10 flex flex-col h-[100dvh] bg-[#0F1219] max-w-4xl mx-auto w-full overflow-hidden"
                    >
                        <header className="px-4 pt-12 pb-4 border-b border-white/5 bg-[#0F1219]/80 backdrop-blur-md sticky top-0 z-20">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => { setViewState('main'); setShowMessageSearch(false); setMessageSearchQuery(''); }}
                                        className="hover:bg-white/5 rounded-full"
                                    >
                                        <ArrowLeft className="h-6 w-6" />
                                    </Button>
                                    <h1 className="text-xl font-bold">Discussions</h1>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className={cn(
                                            "rounded-full transition-colors",
                                            showMessageSearch ? "text-indigo-400 bg-indigo-500/20" : "text-slate-400 hover:text-white"
                                        )}
                                        onClick={() => {
                                            setShowMessageSearch(!showMessageSearch);
                                            if (showMessageSearch) setMessageSearchQuery('');
                                        }}
                                    >
                                        <Search className="h-5 w-5" />
                                    </Button>
                                </div>
                            </div>

                            {/* Search Bar - Animated */}
                            <AnimatePresence>
                                {showMessageSearch && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden mb-3"
                                    >
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                                            <Input
                                                autoFocus
                                                placeholder="Rechercher une conversation..."
                                                value={messageSearchQuery}
                                                onChange={(e) => setMessageSearchQuery(e.target.value)}
                                                className="pl-10 h-10 rounded-xl bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                                            />
                                            {messageSearchQuery && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-slate-400 hover:text-white rounded-full"
                                                    onClick={() => setMessageSearchQuery('')}
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Start New Chat Button */}
                            <motion.div
                                animate={{ scale: [1, 1.02, 1], boxShadow: ["0 0 0 0 rgba(99, 102, 241, 0.4)", "0 0 0 10px rgba(99, 102, 241, 0)", "0 0 0 0 rgba(99, 102, 241, 0)"] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className="rounded-full"
                            >
                                <Button
                                    className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 text-white rounded-full h-12 font-bold text-base shadow-xl shadow-indigo-600/40 mb-2 border-2 border-white/20"
                                    onClick={() => {
                                        const element = document.getElementById('start-new-chat');
                                        element?.scrollIntoView({ behavior: 'smooth' });
                                    }}
                                >
                                    <Plus className="h-5 w-5 mr-2" />
                                    Démarrer une conversation privée
                                </Button>
                            </motion.div>
                        </header>

                        <div className="flex-1 overflow-y-auto">
                            <div className="pb-32">
                                {/* User's Joined Groups Section */}
                                {userGroups.length > 0 && (
                                    <div className="mb-4">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-4 pt-4">
                                            Mes Groupes de Prière
                                        </h3>
                                        {groups.filter(g => userGroups.includes(g.id)).filter(g => !messageSearchQuery || g.name.toLowerCase().includes(messageSearchQuery.toLowerCase())).map((group) => (
                                            <div
                                                key={group.id}
                                                className="flex items-center gap-4 px-4 py-3 hover:bg-white/5 cursor-pointer transition-colors border-b border-white/5"
                                                onClick={() => {
                                                    setSelectedGroup(group);
                                                    loadGroupMessages(group.id);
                                                    setViewState('group-detail');
                                                }}
                                            >
                                                <div className="relative">
                                                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                                                        <Users className="h-6 w-6 text-white" />
                                                    </div>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-semibold text-base truncate pr-2 text-white/90">
                                                        {group.name}
                                                    </h3>
                                                    <p className="text-sm text-slate-400 truncate">
                                                        {group.memberCount || 0} membres • Groupe
                                                    </p>
                                                </div>
                                                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                                                    Groupe
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Existing Conversations */}
                                {conversations.length > 0 && (
                                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-4 pt-2">
                                        Mes Conversations
                                    </h3>
                                )}
                                {conversations.filter((conv) => {
                                    if (!messageSearchQuery) return true;
                                    const name = conv.otherUser?.full_name || '';
                                    return name.toLowerCase().includes(messageSearchQuery.toLowerCase());
                                }).map((conv) => {
                                    const user = conv.otherUser;
                                    const isOnline = user && onlineUsers[user.id];
                                    const lastSeen = user && userLastSeen[user.id];

                                    return (
                                        <div
                                            key={conv.id}
                                            className="flex items-center gap-4 px-4 py-3 hover:bg-white/5 cursor-pointer transition-colors border-b border-white/5"
                                            onClick={() => {
                                                setSelectedConversation(conv);
                                                loadDirectMessages(conv.id);
                                                setViewState('conversation');
                                                if (onHideNav) onHideNav(true);
                                            }}
                                        >
                                            <div className="relative">
                                                <Avatar className="h-12 w-12 border border-white/10">
                                                    <AvatarImage src={user?.avatar_url} />
                                                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold">
                                                        {user?.full_name?.[0]}
                                                    </AvatarFallback>
                                                </Avatar>
                                                {isOnline && (
                                                    <div className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-[#0F1219]" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-baseline mb-0.5">
                                                    <h3 className="font-semibold text-base truncate pr-2 text-white/90">
                                                        {user?.full_name || 'Utilisateur'}
                                                    </h3>
                                                    <span className="text-[11px] text-slate-500 shrink-0">
                                                        {conv.last_message_at ? formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false, locale: fr }) : ''}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-400 truncate flex items-center gap-1">
                                                    {isOnline ? (
                                                        <span className="text-green-400 text-xs">● En ligne</span>
                                                    ) : lastSeen ? (
                                                        <span className="text-xs">Vu {formatDistanceToNow(new Date(lastSeen), { addSuffix: true, locale: fr })}</span>
                                                    ) : (
                                                        conv.last_message_preview || 'Nouvelle discussion'
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}

                                {conversations.length === 0 && userGroups.length === 0 && (
                                    <div className="text-center py-12 px-6">
                                        <div className="bg-white/5 rounded-full h-20 w-20 flex items-center justify-center mx-auto mb-4">
                                            <MessageSquare className="h-10 w-10 text-slate-500" />
                                        </div>
                                        <h3 className="text-lg font-bold text-white mb-2">Pas encore de messages</h3>
                                        <p className="text-slate-400 text-sm">
                                            Commencez à discuter avec d'autres participants du marathon de prière.
                                        </p>
                                    </div>
                                )}

                                {/* Users List to Start New Chat */}
                                <div id="start-new-chat" className="px-4 py-6 mt-4">
                                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 px-2">
                                        Démarrer une conversation avec
                                    </h3>
                                    <div className="space-y-1">
                                        {allUsers.filter(profile => !messageSearchQuery || (profile.full_name || '').toLowerCase().includes(messageSearchQuery.toLowerCase())).map((profile) => {
                                            const isOnline = onlineUsers[profile.id];
                                            const lastSeen = userLastSeen[profile.id];
                                            return (
                                                <div
                                                    key={profile.id}
                                                    className="flex items-center gap-4 px-3 py-2 hover:bg-white/5 cursor-pointer rounded-xl transition-colors"
                                                    onClick={async () => {
                                                        try {
                                                            // Try RPC first, then fallback
                                                            let convId = null;
                                                            const { data, error } = await supabase
                                                                .rpc('get_or_create_conversation', { other_user_id: profile.id });

                                                            if (error) {
                                                                console.log('RPC error, trying direct insert:', error.message);
                                                                // Fallback: direct insert
                                                                const { data: newConv, error: insertError } = await supabase
                                                                    .from('conversations')
                                                                    .insert({
                                                                        participant1_id: user?.id,
                                                                        participant2_id: profile.id
                                                                    })
                                                                    .select()
                                                                    .single();

                                                                if (!insertError && newConv) {
                                                                    convId = newConv.id;
                                                                }
                                                            } else {
                                                                convId = data;
                                                            }

                                                            if (convId) {
                                                                setSelectedConversation({
                                                                    id: convId,
                                                                    otherUser: profile
                                                                });
                                                                loadDirectMessages(convId);
                                                                setViewState('conversation');
                                                                if (onHideNav) onHideNav(true);
                                                            }
                                                        } catch (e) {
                                                            console.error('Error creating conversation:', e);
                                                            toast.error("Impossible de démarrer la conversation");
                                                        }
                                                    }}
                                                >
                                                    <div className="relative">
                                                        <Avatar className="h-10 w-10 border border-white/10">
                                                            <AvatarImage src={profile.avatar_url} />
                                                            <AvatarFallback className="bg-white/10 text-slate-400">
                                                                {profile.full_name?.[0]}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        {isOnline && (
                                                            <div className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-green-500 rounded-full border-2 border-[#0F1219]" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="font-medium text-white">{profile.full_name}</p>
                                                        <p className="text-xs text-slate-500">
                                                            {isOnline ? (
                                                                <span className="text-green-400">● En ligne</span>
                                                            ) : lastSeen ? (
                                                                <span>Vu {formatDistanceToNow(new Date(lastSeen), { addSuffix: true, locale: fr })}</span>
                                                            ) : (
                                                                'Hors ligne'
                                                            )}
                                                        </p>
                                                    </div>
                                                    <UserPlus className="h-5 w-5 text-indigo-500/50" />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* ========== CONVERSATION (DM) VIEW ========== */}
                {viewState === 'conversation' && selectedConversation && (
                    <motion.div
                        key="conversation"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="relative z-10 flex flex-col h-[100dvh] pb-0"
                    >
                        <header className="px-4 pt-12 pb-4 border-b border-white/5 bg-[#0F1219]/80 backdrop-blur-md sticky top-0 z-20">
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                        setSelectedConversation(null);
                                        setViewState('messages');
                                        if (onHideNav) onHideNav(false);
                                    }}
                                    className="hover:bg-white/5 rounded-full"
                                >
                                    <ArrowLeft className="h-6 w-6" />
                                </Button>
                                <div className="flex items-center gap-3 flex-1 cursor-pointer hover:bg-white/5 p-1 rounded-lg transition-colors">
                                    <div className="relative">
                                        <Avatar className="h-10 w-10 border border-white/10">
                                            <AvatarImage src={selectedConversation.otherUser?.avatar_url} />
                                            <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold">
                                                {selectedConversation.otherUser?.full_name?.[0] || 'U'}
                                            </AvatarFallback>
                                        </Avatar>
                                        {selectedConversation.otherUser && onlineUsers[selectedConversation.otherUser.id] && (
                                            <div className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-green-500 rounded-full border-2 border-[#0F1219]" />
                                        )}
                                    </div>
                                    <div className="flex flex-col">
                                        <h1 className="text-base font-bold leading-tight text-white">
                                            {selectedConversation.otherUser?.full_name || 'Utilisateur'}
                                        </h1>
                                        <p className="text-xs text-slate-400">
                                            {selectedConversation.otherUser && onlineUsers[selectedConversation.otherUser.id]
                                                ? <span className="text-green-500 font-medium">En ligne</span>
                                                : selectedConversation.otherUser && userLastSeen[selectedConversation.otherUser.id]
                                                    ? `Vu ${formatDistanceToNow(new Date(userLastSeen[selectedConversation.otherUser.id]), { addSuffix: true, locale: fr })}`
                                                    : 'Hors ligne'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    {/* Friend Request Button - show when not friends */}
                                    {!isFriendWithChatPartner && selectedConversation.otherUser && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-pink-400 hover:text-pink-300 rounded-full h-10 w-10 hover:bg-pink-500/10"
                                            onClick={() => sendFriendRequestFromChat(selectedConversation.otherUser.id)}
                                            title="Ajouter en ami"
                                        >
                                            <UserPlus className="h-5 w-5" />
                                        </Button>
                                    )}
                                    {isFriendWithChatPartner && (
                                        <Badge className="bg-pink-500/20 text-pink-400 border-none text-[10px] self-center mr-1">
                                            <Heart className="h-3 w-3 mr-1" />
                                            Ami
                                        </Badge>
                                    )}
                                    {/* Voice & Video Call Buttons */}
                                    {user && selectedConversation.otherUser && (
                                        <DMCallButtons
                                            currentUserId={user.id}
                                            currentUserName={user.name || 'Utilisateur'}
                                            currentUserAvatar={user.avatar}
                                            otherUserId={selectedConversation.otherUser.id}
                                            otherUserName={selectedConversation.otherUser.full_name || 'Utilisateur'}
                                        />
                                    )}
                                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white rounded-full h-10 w-10">
                                        <MoreVertical className="h-5 w-5" />
                                    </Button>
                                </div>
                            </div>
                        </header>

                        {/* Messages */}
                        <div
                            ref={chatScrollRef}
                            className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
                        >
                            {loadingDMs ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                                </div>
                            ) : directMessages.length === 0 ? (
                                <div className="text-center py-12">
                                    <MessageSquare className="h-12 w-12 text-slate-700 mx-auto mb-4" />
                                    <p className="text-slate-500">Démarrez la conversation!</p>
                                </div>
                            ) : (
                                directMessages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={cn("flex gap-3", msg.sender_id === user?.id && "flex-row-reverse")}
                                    >
                                        <div className={cn(
                                            "max-w-[75%] rounded-2xl px-4 py-2.5",
                                            msg.sender_id === user?.id
                                                ? "bg-indigo-600 rounded-br-sm"
                                                : "bg-white/10 rounded-bl-sm"
                                        )}>
                                            {/* Check if it's a voice message */}
                                            {msg.type === 'voice' && msg.voice_url ? (
                                                <VoiceMessagePlayer
                                                    voiceUrl={msg.voice_url}
                                                    duration={msg.voice_duration}
                                                    isOwn={msg.sender_id === user?.id}
                                                />
                                            ) : (
                                                <p className="text-sm text-white leading-relaxed">{msg.content}</p>
                                            )}
                                            <p className="text-[10px] text-white/50 mt-1">
                                                {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: fr })}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Message Input - Enhanced */}
                        <div className="px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] border-t border-white/10 bg-slate-900/95 backdrop-blur-md sticky bottom-0 z-30">
                            {/* Emoji Picker */}
                            <div className="relative">
                                <EmojiPicker
                                    isOpen={showDMEmojiPicker}
                                    onClose={() => setShowDMEmojiPicker(false)}
                                    onEmojiSelect={(emoji) => {
                                        setNewMessage(prev => prev + emoji);
                                        setShowDMEmojiPicker(false);
                                    }}
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                {/* Emoji Button */}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setShowDMEmojiPicker(!showDMEmojiPicker)}
                                    className="h-10 w-10 rounded-full text-slate-400 hover:text-white hover:bg-white/10"
                                    disabled={isRecording}
                                >
                                    <Smile className="h-5 w-5" />
                                </Button>

                                {/* Recording UI or Text Input */}
                                {isRecording ? (
                                    <div className="flex-1 flex items-center gap-3 bg-red-500/20 rounded-full px-4 py-2">
                                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                                        <span className="text-red-400 font-mono flex-1">
                                            {formatRecordingTime(recordingTime)}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={cancelRecording}
                                            className="text-slate-400 hover:text-white h-8 w-8"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => stopRecording('dm')}
                                            className="text-green-400 hover:text-green-300 h-8 w-8"
                                        >
                                            <Send className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : isUploadingVoice ? (
                                    <div className="flex-1 flex items-center justify-center gap-2 bg-indigo-500/20 rounded-full px-4 py-2">
                                        <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                                        <span className="text-indigo-400 text-sm">Envoi du message vocal...</span>
                                    </div>
                                ) : (
                                    <Input
                                        placeholder="Écrire un message..."
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && sendDirectMessage()}
                                        className="flex-1 h-10 rounded-full bg-white/5 border-white/10 px-4"
                                    />
                                )}

                                {/* Send or Mic Button */}
                                {!isRecording && !isUploadingVoice && (
                                    newMessage.trim() ? (
                                        <Button
                                            size="icon"
                                            className="h-10 w-10 rounded-full bg-indigo-600 hover:bg-indigo-500"
                                            onClick={sendDirectMessage}
                                        >
                                            <Send className="h-5 w-5" />
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-10 w-10 rounded-full text-slate-400 hover:text-white hover:bg-white/10"
                                            onClick={startRecording}
                                        >
                                            <Mic className="h-5 w-5" />
                                        </Button>
                                    )
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* ========== FRIENDS VIEW ========== */}
                {viewState === 'friends' && (
                    <motion.div
                        key="friends"
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                    >
                        <FriendSystem
                            userId={user?.id || ''}
                            userName={user?.name || ''}
                            onClose={() => setViewState('main')}
                            onStartChat={async (friendId: string, friendName: string) => {
                                // Try to find or create a conversation with this friend
                                if (!user) return;
                                try {
                                    // USE RPC to get/create convention safely and avoid duplicates
                                    let finalConvId = null;
                                    const { data: convId, error } = await supabase
                                        .rpc('get_or_create_conversation', { other_user_id: friendId });

                                    if (!error && convId) {
                                        finalConvId = convId;
                                    } else {
                                        // Fallback manual check
                                        const { data: existing } = await supabase
                                            .from('conversations')
                                            .select('id')
                                            .or(`and(participant1_id.eq.${user.id},participant2_id.eq.${friendId}),and(participant1_id.eq.${friendId},participant2_id.eq.${user.id})`)
                                            .maybeSingle();

                                        if (existing) finalConvId = existing.id;
                                        else {
                                            const { data: newConv } = await supabase.from('conversations').insert({
                                                participant1_id: user.id,
                                                participant2_id: friendId,
                                                last_message_at: new Date().toISOString()
                                            }).select().single();
                                            if (newConv) finalConvId = newConv.id;
                                        }
                                    }

                                    if (finalConvId) {
                                        const { data: conv } = await supabase
                                            .from('conversations')
                                            .select('*')
                                            .eq('id', finalConvId)
                                            .single();

                                        const { data: profile } = await supabase
                                            .from('profiles')
                                            .select('id, full_name, avatar_url')
                                            .eq('id', friendId)
                                            .single();

                                        setSelectedConversation({
                                            ...conv,
                                            otherUser: profile || { id: friendId, full_name: friendName, avatar_url: null }
                                        });
                                        await loadDirectMessages(finalConvId);
                                        setViewState('conversation');
                                        if (onHideNav) onHideNav(true);
                                    }
                                } catch (e) {
                                    console.error('Error starting chat:', e);
                                    toast.error("Erreur lors de l'ouverture du chat");
                                }
                            }}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Guest Auth Prompt Dialog */}
            <Dialog open={showAuthPrompt} onOpenChange={setShowAuthPrompt}>
                <DialogContent className="bg-[#0F1219] border-white/10 text-white max-w-sm rounded-3xl p-0 overflow-hidden">
                    <div className="p-8 text-center">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
                            <Lock className="w-10 h-10 text-white" />
                        </div>
                        <h3 className="text-xl font-black mb-2">Connexion requise</h3>
                        <p className="text-slate-400 text-sm mb-6">
                            Connectez-vous ou créez un compte pour interagir avec la communauté.
                        </p>
                        <div className="space-y-3">
                            <Button
                                className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 border-0 font-bold text-sm"
                                onClick={() => { setShowAuthPrompt(false); setGlobalActiveTab('profile'); }}
                            >
                                Se connecter / S&apos;inscrire
                            </Button>
                            <Button
                                variant="ghost"
                                className="w-full h-10 rounded-xl text-slate-400 text-sm"
                                onClick={() => setShowAuthPrompt(false)}
                            >
                                Continuer en tant qu&apos;invité
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// PrayerCard, TestimonyCard, ChatMessage components have been extracted to:
// - @/components/community/prayer-card.tsx
// - @/components/community/testimony-card.tsx
// - @/components/community/chat-message.tsx

