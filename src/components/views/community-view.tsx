'use client';

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import {
    MessageSquare, Heart, Send, Plus, ChevronRight, Users, Check, Search, Pin, Shield, BellRing,
    Filter, X, Camera, Bookmark, MoreVertical, Share2, Flag, Sparkles,
    Lock, CheckCircle2, Loader2, ArrowLeft, Bell, Settings, Wrench,
    MessageCircle, UserPlus, ChevronDown, Crown, Trash2, Smile, Mic, MicOff, Play, Pause, Video, Globe, UserCheck, Gamepad2, LogIn,
    Radio, Eye
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
import { Switch } from "@/components/ui/switch";
import { useAppStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { PRAYER_CATEGORIES, PrayerCategory, PrayerRequest, Testimonial, PrayerGroup, PrayerGroupJoinRequest } from "@/lib/types";
import { PhotoUpload, PhotoGallery } from "@/components/ui/photo-upload";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import { NotificationBell } from "@/components/notification-bell";
import { IncomingCallOverlay, useCallListener, DMCallButtons, CallSignal } from "@/components/community/call-system";
import { WebRTCCall } from "@/components/community/webrtc-call";
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
import { usePresence } from "@/hooks/use-presence";
import { useVoiceRecording } from "@/hooks/use-voice-recording";
import { useGroups } from "@/hooks/use-groups";
import { useConversations } from "@/hooks/use-conversations";
import { useCommunityChat } from "@/hooks/use-community-chat";

// Dynamic imports for heavy components to prevent TDZ errors in production bundles
const WhatsAppChat = dynamic(() => import("@/components/community/whatsapp-chat").then(m => ({ default: m.WhatsAppChat })), { ssr: false, loading: () => <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-indigo-400" /></div> });
const PrayerGroupManager = dynamic(() => import("@/components/community/prayer-group-manager").then(m => ({ default: m.PrayerGroupManager })), { ssr: false, loading: () => <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-indigo-400" /></div> });
const GroupCallManager = dynamic(() => import("@/components/community/group-call-manager").then(m => ({ default: m.GroupCallManager })), { ssr: false });
const FriendSystem = dynamic(() => import("@/components/community/friend-system").then(m => ({ default: m.FriendSystem })), { ssr: false, loading: () => <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-indigo-400" /></div> });
const GroupToolsPanel = dynamic(() => import("@/components/community/group-tools").then(m => ({ default: m.GroupToolsPanel })), { ssr: false });
const LiveStreamButton = dynamic(() => import("@/components/community/livestream-salon").then(m => ({ default: m.LiveStreamButton })), { ssr: false });
const LiveStreamSalon = dynamic(() => import("@/components/community/livestream-salon").then(m => ({ default: m.LiveStreamSalon })), { ssr: false });
const FloatingBubbles = dynamic(() => import("@/components/community/floating-bubbles").then(m => ({ default: m.FloatingBubbles })), { ssr: false });

type ViewState = 'main' | 'chat' | 'groups' | 'group-detail' | 'group-call' | 'livestream' | 'global-live' | 'friends' | 'conversation' | 'messages';

// VoiceMessagePlayer extracted to @/components/community/voice-message-player.tsx
// GlobalLiveSalon & GlobalLiveComments extracted to @/components/community/global-live-salon.tsx
const GlobalLiveSalon = dynamic(() => import('@/components/community/global-live-salon').then(m => ({ default: m.GlobalLiveSalon })), { ssr: false });

interface CommunityViewProps {
    onHideNav?: (hide: boolean) => void;
}

export function CommunityView({ onHideNav }: CommunityViewProps = {}) {
    const {
        prayerRequests, addPrayerRequest, prayForRequest,
        testimonials, addTestimonial, likeTestimonial,
        user, appSettings
    } = useAppStore();
    const setGlobalActiveTab = useAppStore(s => s.setActiveTab);
    const setBibleViewTarget = useAppStore(s => s.setBibleViewTarget);
    const pendingNavigation = useAppStore(s => s.pendingNavigation);
    const setPendingNavigation = useAppStore(s => s.setPendingNavigation);

    // UI State
    const [viewState, setViewState] = useState<ViewState>('main');
    const [activeTab, setActiveTab] = useState<'prayers' | 'testimonials' | 'chat'>('prayers');
    // Floating bubbles for published prayers/tools
    const [floatingBubbles, setFloatingBubbles] = useState<Array<{ id: string; type: 'prayer' | 'tool' | 'group' | 'bible'; title: string; icon?: string; onClick?: () => void }>>([]);
    const [selectedCategory, setSelectedCategory] = useState<PrayerCategory | 'all'>('all');
    const [showAnsweredOnly, setShowAnsweredOnly] = useState(false);
    const [groupSearchQuery, setGroupSearchQuery] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogType, setDialogType] = useState<'prayer' | 'testimonial'>('prayer');
    const [isChatFullScreen, setIsChatFullScreen] = useState(false);

    // Form State
    const [newContent, setNewContent] = useState('');
    const [prayerSubject, setPrayerSubject] = useState('');
    const [newCategory, setNewCategory] = useState<PrayerCategory>('other');
    const [newPhotos, setNewPhotos] = useState<string[]>([]);
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [pendingFriendCount, setPendingFriendCount] = useState(0);

    // ===== CUSTOM HOOKS =====
    const userInfo = user ? { id: user.id, name: user.name || 'Utilisateur', avatar: user.avatar } : null;

    // Presence (online/offline tracking) — replaces ~140 lines + fixes duplicate heartbeat
    const { onlineUsers, userLastSeen } = usePresence(user?.id);

    // Groups management — replaces ~600 lines
    const groupsHook = useGroups(userInfo);

    // Conversations (DMs) — replaces ~400 lines
    const convoHook = useConversations(userInfo);

    // Community chat — replaces ~250 lines
    const chatHook = useCommunityChat(userInfo, activeTab);

    // Voice recording — replaces ~200 lines
    const voiceHook = useVoiceRecording();

    // Destructure for easier JSX access
    const {
        groups, setGroups, userGroups, setUserGroups, selectedGroup, setSelectedGroup,
        groupMembers, groupJoinRequests, pendingRequestCounts,
        showMembersPanel, setShowMembersPanel,
        showCreateGroupDialog, setShowCreateGroupDialog,
        newGroupName, setNewGroupName, newGroupDescription, setNewGroupDescription,
        isGroupPublic, setIsGroupPublic, creatingGroup,
        loadGroups, loadUserGroups, loadPendingJoinRequests,
        joinGroup, leaveGroup, requestJoinGroup, approveJoinRequest, rejectJoinRequest,
        loadGroupMembers, removeGroupMember, createGroup, generateSlug,
    } = groupsHook;

    const {
        conversations, selectedConversation, setSelectedConversation,
        directMessages, setDirectMessages, loadingConversations, loadingDMs, allUsers,
        userFriends, isFriendWithChatPartner,
        loadConversations, loadUsers, loadUserFriends, loadDirectMessages,
        sendDirectMessage, checkFriendshipWithPartner, sendFriendRequestFromChat,
    } = convoHook;

    const {
        chatMessages, newMessage, setNewMessage, loadingMessages,
        groupMessages, setGroupMessages, loadingGroupMessages, chatScrollRef,
        loadChatMessages, sendChatMessage, loadGroupMessages, sendGroupMessage,
    } = chatHook;

    const {
        isRecording, recordingTime, isUploadingVoice,
        startRecording, stopRecording, cancelRecording, formatRecordingTime,
    } = voiceHook;

    // Private Messages State (kept local as it's view-specific)
    const [activeLiveStream, setActiveLiveStream] = useState<any | null>(null);
    const [showGlobalLive, setShowGlobalLive] = useState(false);
    const [showLiveRegistration, setShowLiveRegistration] = useState(false);
    const [openChatGroupId, setOpenChatGroupId] = useState<string | null>(null);
    const [openChatConversationId, setOpenChatConversationId] = useState<string | null>(null);

    // Open chat for a specific group
    const handleOpenChat = (groupId: string) => {
        requireAuth(() => {
            setOpenChatGroupId(groupId);
            setActiveTab('chat');
            setViewState('main');
        });
    };

    // Search state for Messages view
    const [showMessageSearch, setShowMessageSearch] = useState(false);
    const [messageSearchQuery, setMessageSearchQuery] = useState('');

    // Emoji picker states
    const [showDMEmojiPicker, setShowDMEmojiPicker] = useState(false);
    const [showGroupEmojiPicker, setShowGroupEmojiPicker] = useState(false);

    // Global WebRTC Call State
    const [activeGlobalCall, setActiveGlobalCall] = useState<{
        type: 'audio' | 'video';
        mode: 'private' | 'group';
        isIncoming: boolean;
        remoteUser?: { id: string; name: string; avatar?: string | null };
        conversationId?: string;
        groupId?: string;
        groupName?: string;
    } | null>(null);

    // Create group with prayer request
    const [createGroupWithPrayer, setCreateGroupWithPrayer] = useState(false);
    const [groupPrivacy, setGroupPrivacy] = useState<'public' | 'private'>('public');

    // Pinned prayer
    const [showPinnedPrayer, setShowPinnedPrayer] = useState(false);
    const [showGroupTools, setShowGroupTools] = useState(false);

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
        const fullScreenViews: ViewState[] = ['conversation', 'group-detail', 'group-call', 'livestream', 'global-live'];
        onHideNav?.(fullScreenViews.includes(viewState));
    }, [viewState, onHideNav]);

    // Load pending friend request count
    useEffect(() => {
        if (!user) { setPendingFriendCount(0); return; }
        const loadCount = async () => {
            const { count } = await supabase
                .from('friendships')
                .select('*', { count: 'exact', head: true })
                .eq('receiver_id', user.id)
                .eq('status', 'pending');
            setPendingFriendCount(count || 0);
        };
        loadCount();
        const iv = setInterval(loadCount, 30000);
        const chan = supabase.channel('friend-req-' + user.id)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `receiver_id=eq.${user.id}` }, loadCount)
            .subscribe();
        return () => { clearInterval(iv); chan.unsubscribe(); };
    }, [user]);

    // Handle deep-linking from notifications
    useEffect(() => {
        if (!pendingNavigation) return;
        const nav = pendingNavigation;
        setPendingNavigation(null);

        if (nav.communityTab) {
            const tabMap: Record<string, 'prayers' | 'testimonials' | 'chat'> = {
                prieres: 'prayers', prayers: 'prayers',
                temoignages: 'testimonials', testimonials: 'testimonials',
                chat: 'chat',
            };
            if (tabMap[nav.communityTab]) setActiveTab(tabMap[nav.communityTab]);
            if (nav.communityTab === 'chat' && nav.groupId) {
                setOpenChatConversationId(null);
                handleOpenChat(nav.groupId);
                return;
            }
            if (nav.communityTab === 'chat' && nav.conversationId) {
                setOpenChatConversationId(nav.conversationId);
                setActiveTab('chat');
                return;
            }
        }

        if (nav.viewState) {
            const vs = nav.viewState as ViewState;
            if (vs === 'group-detail' && nav.groupId) {
                setViewState(vs);
                const group = groups.find((g: any) => g.id === nav.groupId);
                if (group) {
                    setSelectedGroup(group);
                } else {
                    supabase
                        .from('prayer_groups')
                        .select('*, profiles:created_by(full_name, avatar_url)')
                        .eq('id', nav.groupId)
                        .single()
                        .then(({ data }) => { if (data) setSelectedGroup(data as any); });
                }
            } else if ((vs === 'conversation' || nav.conversationId) && nav.conversationId) {
                setActiveTab('chat');
                setOpenChatConversationId(nav.conversationId);
            } else {
                setViewState(vs);
            }
        }
    }, [pendingNavigation]);

    // Watch for DM refresh signals
    const dmRefreshSignal = useAppStore(s => s.dmRefreshSignal);
    useEffect(() => {
        if (!dmRefreshSignal) return;
        if (viewState === 'conversation' && selectedConversation && selectedConversation.id === dmRefreshSignal.conversationId) {
            loadDirectMessages(dmRefreshSignal.conversationId);
        }
        if (viewState === 'messages' && user) {
            const timer = setTimeout(() => loadConversations(), 500);
            return () => clearTimeout(timer);
        }
    }, [dmRefreshSignal]);

    // Setup real-time subscription for group messages when viewing group-detail
    useEffect(() => {
        if (viewState === 'group-detail' && selectedGroup) {
            const groupId = selectedGroup.id;
            loadGroupMessages(groupId).then(() => {
                requestAnimationFrame(() => {
                    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
                });
            });

            const subscription = supabase
                .channel(`group_rt_${groupId}_${Date.now()}`)
                .on('postgres_changes', {
                    event: 'INSERT', schema: 'public', table: 'prayer_group_messages',
                    filter: `group_id=eq.${groupId}`
                }, async (payload) => {
                    const newMsg = payload.new as any;
                    setGroupMessages(prev => {
                        if (prev.some(m => m.id === newMsg.id)) return prev;
                        if (newMsg.user_id === user?.id) {
                            const tempIdx = prev.findIndex(m => typeof m.id === 'string' && m.id.startsWith('temp_grp_'));
                            if (tempIdx !== -1) {
                                const updated = [...prev];
                                updated[tempIdx] = { ...newMsg, profiles: prev[tempIdx].profiles };
                                return updated;
                            }
                        }
                        return prev;
                    });

                    if (newMsg.user_id !== user?.id) {
                        const { data: profile } = await supabase
                            .from('profiles').select('full_name, avatar_url')
                            .eq('id', newMsg.user_id).single();
                        setGroupMessages(prev => {
                            if (prev.some(m => m.id === newMsg.id)) return prev;
                            return [...prev, { ...newMsg, profiles: profile || { full_name: 'Utilisateur', avatar_url: null } }];
                        });
                        requestAnimationFrame(() => {
                            if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
                        });
                    }
                })
                .subscribe();

            return () => { subscription.unsubscribe(); };
        }
    }, [viewState, selectedGroup]);

    // Load user groups on mount + Realtime group deletion sync
    useEffect(() => {
        if (user) {
            loadUserGroups();
            loadUserFriends();
            loadPendingJoinRequests();

            const groupDeleteSub = supabase
                .channel('group_deletions_sync')
                .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'prayer_groups' }, (payload) => {
                    const deletedGroupId = payload.old?.id;
                    if (!deletedGroupId) return;
                    setGroups((prev: PrayerGroup[]) => prev.filter(g => g.id !== deletedGroupId));
                    setUserGroups((prev: string[]) => prev.filter(id => id !== deletedGroupId));
                    if (selectedGroup?.id === deletedGroupId) {
                        setViewState('main');
                        toast.info('Ce groupe a été supprimé par un administrateur');
                    }
                })
                .subscribe();

            return () => { groupDeleteSub.unsubscribe(); };
        }
    }, [user, selectedGroup?.id]);

    // Load conversations when accessing messages view
    useEffect(() => {
        if (viewState === 'messages' && user) {
            loadConversations();
            loadUsers();
            loadGroups();
        }
    }, [viewState, user]);

    // Real-time subscription for direct messages
    useEffect(() => {
        if (viewState === 'conversation' && selectedConversation) {
            loadDirectMessages(selectedConversation.id);
            if (selectedConversation.otherUser?.id) {
                checkFriendshipWithPartner(selectedConversation.otherUser.id);
            }

            const channelName = `dm_cv_${selectedConversation.id}_${Date.now()}`;
            const subscription = supabase
                .channel(channelName)
                .on('postgres_changes', {
                    event: 'INSERT', schema: 'public', table: 'direct_messages',
                    filter: `conversation_id=eq.${selectedConversation.id}`
                }, async (payload) => {
                    const newMsg = payload.new as any;
                    setDirectMessages(prev => {
                        if (prev.some(m => m.id === newMsg.id)) return prev;
                        if (newMsg.sender_id === user?.id) {
                            const tempIdx = prev.findIndex(m => typeof m.id === 'string' && m.id.startsWith('temp_') && m.sender_id === user?.id);
                            if (tempIdx !== -1) {
                                const updated = [...prev];
                                updated[tempIdx] = { ...newMsg, sender: prev[tempIdx].sender };
                                return updated;
                            }
                            return [...prev, { ...newMsg, sender: { id: user!.id, full_name: user!.name || 'Moi' } }];
                        }
                        return [...prev, { ...newMsg, sender: { id: newMsg.sender_id, full_name: '...' } }];
                    });

                    if (newMsg.sender_id !== user?.id) {
                        const { data: profile } = await supabase
                            .from('profiles').select('id, full_name, avatar_url')
                            .eq('id', newMsg.sender_id).single();
                        if (profile) {
                            setDirectMessages(prev => prev.map(m => m.id === newMsg.id ? { ...m, sender: profile } : m));
                        }
                        requestAnimationFrame(() => {
                            if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
                        });
                    }
                })
                .subscribe();

            return () => { subscription.unsubscribe(); };
        }
    }, [viewState, selectedConversation?.id]);

    const handlePublish = async () => {
        if ((!newContent.trim() && !prayerSubject.trim()) || !user) return;

        setIsSubmitting(true);
        try {
            if (dialogType === 'prayer') {
                // addPrayerRequest now returns the new prayer ID directly
                const fullContent = prayerSubject
                    ? `**${prayerSubject}**\n\n${newContent}`
                    : newContent;
                const newPrayerId = await addPrayerRequest(fullContent, isAnonymous, newCategory, newPhotos);

                // If createGroupWithPrayer is toggled, also create a group
                if (createGroupWithPrayer && newPrayerId) {
                    try {
                        const groupName = `🙏 Prière: ${newContent.substring(0, 50)}${newContent.length > 50 ? '...' : ''}`;
                        const groupSlug = generateSlug(groupName) + '-' + Date.now().toString(36);
                        const groupAvatar = `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(groupName)}&backgroundColor=6366f1,8b5cf6,a855f7`;
                        const insertData: any = {
                            name: groupName,
                            description: newContent.substring(0, 200),
                            created_by: user.id,
                            is_open: groupPrivacy === 'public',
                            prayer_request_id: newPrayerId,
                            slug: groupSlug,
                            avatar_url: groupAvatar,
                        };
                        const { data: groupData, error: groupError } = await supabase
                            .from('prayer_groups')
                            .insert(insertData)
                            .select()
                            .single();

                        if (groupError) {
                            console.error('Error inserting linked group:', groupError);
                            toast.success('Demande publiée! (groupe non créé: ' + groupError.message + ')');
                        } else if (groupData) {
                            // Add creator as admin
                            await supabase.from('prayer_group_members').insert({
                                group_id: groupData.id,
                                user_id: user.id,
                                role: 'admin'
                            });
                            setUserGroups(prev => [...prev, groupData.id]);
                            loadGroups();
                            toast.success('\u{1F6AA} Demande + chambre haute créées!');
                        }
                    } catch (ge) {
                        console.error('Error creating linked group:', ge);
                        toast.success('Demande publiée! (groupe non créé)');
                    }
                } else if (createGroupWithPrayer && !newPrayerId) {
                    console.error('Could not link group: newPrayerId is null');
                    toast.success('Demande publiée! (groupe non créé - ID manquant)');
                } else {
                    toast.success('Demande de prière publiée!');
                    // Add floating bubble
                    setFloatingBubbles(prev => [...prev, {
                        id: newPrayerId || Date.now().toString(),
                        type: 'prayer',
                        title: newContent.slice(0, 50) + (newContent.length > 50 ? '...' : ''),
                        icon: '🙏',
                    }]);
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
            setPrayerSubject('');
            setNewPhotos([]);
            setNewCategory('other');
            setIsAnonymous(false);
            setCreateGroupWithPrayer(false);
            setGroupPrivacy('public');
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

    // Handle accepting an incoming call -> open WebRTCCall
    const handleAcceptCall = useCallback(() => {
        if (!incomingCall || !user) return;
        const callData = { ...incomingCall };
        acceptCall();
        setActiveGlobalCall({
            type: callData.callType,
            mode: callData.mode,
            isIncoming: true,
            remoteUser: {
                id: callData.callerId,
                name: callData.callerName,
                avatar: callData.callerAvatar,
            },
            conversationId: callData.conversationId,
            groupId: callData.groupId,
            groupName: callData.groupName,
        });
    }, [incomingCall, acceptCall, user]);

    return (
        <div className="relative h-full overflow-hidden bg-linear-to-b from-[#0B0E14] to-[#0F1219] text-white pb-0">
            {/* Active WebRTC Call Overlay */}
            <AnimatePresence>
                {activeGlobalCall && user && (
                    <WebRTCCall
                        user={{ id: user.id, name: user.name || 'Utilisateur', avatar: user.avatar }}
                        callType={activeGlobalCall.type}
                        mode={activeGlobalCall.mode}
                        remoteUser={activeGlobalCall.remoteUser ? {
                            id: activeGlobalCall.remoteUser.id,
                            name: activeGlobalCall.remoteUser.name,
                            avatar: activeGlobalCall.remoteUser.avatar ?? undefined,
                        } : undefined}
                        conversationId={activeGlobalCall.conversationId}
                        groupId={activeGlobalCall.groupId}
                        groupName={activeGlobalCall.groupName}
                        groupMembers={groupMembers}
                        isIncoming={activeGlobalCall.isIncoming}
                        onEnd={() => setActiveGlobalCall(null)}
                    />
                )}
            </AnimatePresence>

            {/* Incoming Call Overlay */}
            <AnimatePresence>
                {incomingCall && !activeGlobalCall && (
                    <IncomingCallOverlay
                        call={incomingCall}
                        onAccept={handleAcceptCall}
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
                        className={`relative z-10 min-h-screen max-w-4xl mx-auto w-full ${isChatFullScreen ? '' : 'pb-24'}`}
                    >
                        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="flex flex-col min-h-screen">
                            {/* Header - Sticky on scroll for PC & mobile — hidden when chat is full-screen */}
                            <header className={`px-4 pt-10 pb-3 sticky top-0 z-30 bg-linear-to-b from-[#0B0E14] via-[#0B0E14] to-[#0B0E14]/95 backdrop-blur-xl ${isChatFullScreen ? 'hidden' : ''}`}>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="shrink-0">
                                        <h1 className="text-2xl font-black tracking-tight bg-linear-to-r from-white via-pink-200 to-purple-200 bg-clip-text text-transparent">
                                            Communauté
                                        </h1>
                                        <p className="text-slate-500 text-xs font-medium mt-0.5">Prions ensemble</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {!user && (
                                            <Button
                                                size="sm"
                                                className="rounded-xl bg-linear-to-r from-indigo-600 to-purple-600 border-0 gap-1.5 px-4 h-9 text-xs font-bold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all"
                                                onClick={() => setGlobalActiveTab('profile')}
                                            >
                                                <LogIn className="h-3.5 w-3.5" />
                                                Se connecter
                                            </Button>
                                        )}
                                        <NotificationBell />
                                    </div>
                                </div>
                                {/* Row 1: Social actions - 2 boutons pour le mobile */}
                                <div className="flex gap-2 pb-1.5 -mx-1 px-1">
                                    <Button
                                        size="sm"
                                        className="flex-1 rounded-xl bg-linear-to-r from-pink-600 to-rose-600 border-0 gap-1.5 px-3 h-9 text-xs font-bold relative"
                                        onClick={() => requireAuth(() => setViewState('friends'))}
                                    >
                                        <UserPlus className="h-3.5 w-3.5" />
                                        Retrouver vos amis
                                        {pendingFriendCount > 0 && (
                                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold min-w-[18px] min-h-[18px] rounded-full flex items-center justify-center shadow-lg animate-pulse">
                                                {pendingFriendCount}
                                            </span>
                                        )}
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="flex-1 rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 border-0 gap-1.5 px-3 h-9 text-xs font-bold relative"
                                        onClick={() => requireAuth(() => { loadGroups(); setViewState('groups'); })}
                                    >
                                        <Users className="h-3.5 w-3.5" />
                                        Rejoindre les groupes
                                        {Object.values(pendingRequestCounts).reduce((a, b) => a + b, 0) > 0 && (
                                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4.5 h-4.5 min-w-[18px] min-h-[18px] rounded-full flex items-center justify-center shadow-lg animate-pulse">
                                                {Object.values(pendingRequestCounts).reduce((a, b) => a + b, 0)}
                                            </span>
                                        )}
                                    </Button>
                                </div>
                                {/* Row 2: Jeux */}
                                <div className="flex gap-2 pb-2 -mx-1 px-1">
                                    <EventCalendarButton />
                                    <Button
                                        size="sm"
                                        className="flex-1 rounded-xl bg-linear-to-r from-amber-500 to-orange-600 border-0 gap-1.5 px-3 h-9 text-xs font-bold relative overflow-hidden animate-pulse shadow-lg shadow-amber-500/30"
                                        onClick={() => setGlobalActiveTab('games' as any)}
                                    >
                                        <Gamepad2 className="h-3.5 w-3.5" />
                                        Jeux Bibliques
                                        <span className="absolute inset-0 bg-white/20 animate-ping rounded-xl" style={{ animationDuration: '2s' }} />
                                    </Button>
                                </div>

                                {/* LIVE BANNER - shown when admin activates live */}
                                {appSettings?.['live_stream_active'] === 'true' && (
                                    <div
                                        className="cursor-pointer mb-2"
                                        onClick={() => {
                                            if (!user) {
                                                setShowAuthPrompt(true);
                                            } else {
                                                setViewState('global-live');
                                            }
                                        }}
                                    >
                                        <div className="relative overflow-hidden rounded-2xl bg-linear-to-r from-red-900/80 to-red-700/80 p-3 border border-red-500/30">
                                            <div className="absolute inset-0 bg-linear-to-r from-red-600/20 to-transparent animate-pulse" />
                                            <div className="relative flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="relative">
                                                        <div className="w-3 h-3 bg-red-500 rounded-full animate-ping absolute" />
                                                        <div className="w-3 h-3 bg-red-500 rounded-full relative" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-white text-sm">🔴 NOUS SOMMES EN DIRECT</p>
                                                        <p className="text-red-200 text-xs">Cliquez pour rejoindre le live</p>
                                                    </div>
                                                </div>
                                                <Radio className="w-5 h-5 text-red-300 animate-pulse" />
                                            </div>
                                        </div>
                                    </div>
                                )}

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
                                                onOpenChat={handleOpenChat}
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
                                <TabsContent value="chat" className={isChatFullScreen ? 'fixed inset-0 z-[100] bg-slate-950 mt-0' : 'mt-0 flex flex-col -mx-4'} style={isChatFullScreen ? undefined : { height: 'calc(100dvh - 140px)' }}>
                                    <div className="flex-1 h-full overflow-hidden">
                                        <WhatsAppChat
                                            user={user ? {
                                                id: user.id,
                                                name: user.name || 'Utilisateur',
                                                avatar: user.avatar
                                            } : null}
                                            onHideNav={(hide) => {
                                                setIsChatFullScreen(hide);
                                                onHideNav?.(hide);
                                            }}
                                            activeGroupId={openChatGroupId}
                                            activeConversationId={openChatConversationId}
                                            onlineUsers={onlineUsers}
                                        />
                                    </div>
                                </TabsContent>
                            </div>
                        </Tabs>

                        {/* Floating Add Button */}
                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            {activeTab === 'chat' ? (
                                /* Chat tab: show dropdown with multiple options */
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            className={`fixed bottom-24 right-6 h-14 w-14 rounded-2xl bg-linear-to-br from-indigo-600 to-purple-600 shadow-lg shadow-indigo-600/30 z-50 ${isChatFullScreen ? 'hidden' : ''}`}
                                            onClick={() => {
                                                if (!user) { setShowAuthPrompt(true); }
                                            }}
                                        >
                                            <Plus className="h-6 w-6" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    {user && (
                                        <DropdownMenuContent align="end" className="bg-[#1a1f2e] border-white/10 text-white rounded-xl w-56 mb-2">
                                            <DropdownMenuItem
                                                onClick={() => {
                                                    setShowCreateGroupDialog(true);
                                                }}
                                                className="gap-2 cursor-pointer hover:bg-white/10 focus:bg-white/10 text-white"
                                            >
                                                <Users className="h-4 w-4 text-emerald-400" />
                                                Créer un Groupe
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => {
                                                    setDialogType('prayer');
                                                    setIsDialogOpen(true);
                                                }}
                                                className="gap-2 cursor-pointer hover:bg-white/10 focus:bg-white/10 text-white"
                                            >
                                                <Heart className="h-4 w-4 text-pink-400" />
                                                Nouvelle demande de prière
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    )}
                                </DropdownMenu>
                            ) : (
                                /* Other tabs: direct dialog trigger */
                                <DialogTrigger asChild>
                                    <Button
                                        className={`fixed bottom-24 right-6 h-14 w-14 rounded-2xl bg-linear-to-br from-indigo-600 to-purple-600 shadow-lg shadow-indigo-600/30 z-50 ${isChatFullScreen ? 'hidden' : ''}`}
                                        onClick={() => {
                                            if (!user) { setShowAuthPrompt(true); return; }
                                            setDialogType(activeTab === 'testimonials' ? 'testimonial' : 'prayer');
                                            setIsDialogOpen(true);
                                        }}
                                    >
                                        <Plus className="h-6 w-6" />
                                    </Button>
                                </DialogTrigger>
                            )}

                            <DialogContent className="bg-[#0F1219] border-white/10 text-white max-w-md rounded-4xl max-h-[85vh] overflow-y-auto">
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

                                    {/* Subject (Prayer only) */}
                                    {dialogType === 'prayer' && (
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                                Objet de la requête
                                            </label>
                                            <Input
                                                placeholder="Ex: Guérison, Emploi, Famille..."
                                                value={prayerSubject}
                                                onChange={(e) => setPrayerSubject(e.target.value)}
                                                className="bg-white/5 border-white/10 rounded-xl font-bold text-white placeholder:text-slate-500"
                                                maxLength={100}
                                            />
                                        </div>
                                    )}

                                    {/* Content */}
                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                            {dialogType === 'prayer' ? 'Détails de votre demande' : 'Votre témoignage'}
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
                                        <>
                                            <div
                                                className={cn(
                                                    "flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border",
                                                    createGroupWithPrayer ? "bg-emerald-600/20 border-emerald-500/30" : "bg-white/5 border-white/10"
                                                )}
                                                onClick={() => setCreateGroupWithPrayer(!createGroupWithPrayer)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-linear-to-br from-emerald-600/30 to-teal-600/30 flex items-center justify-center">
                                                        <Users className="h-5 w-5 text-emerald-400" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-sm">🚪 Créer une chambre haute</p>
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

                                            {/* Public/Private choice when group is being created */}
                                            {createGroupWithPrayer && (
                                                <div className="ml-4 p-3 bg-white/5 rounded-xl border border-white/10 space-y-2">
                                                    <p className="text-xs font-semibold text-slate-400">Type de groupe :</p>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => setGroupPrivacy('public')}
                                                            className={cn(
                                                                "flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all",
                                                                groupPrivacy === 'public'
                                                                    ? "bg-emerald-600/20 border-emerald-500/40 text-emerald-400"
                                                                    : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"
                                                            )}
                                                        >
                                                            <span className="text-lg">🌍</span>
                                                            <div className="text-left">
                                                                <p>Public</p>
                                                                <p className="text-[10px] font-normal opacity-70">Tous peuvent rejoindre</p>
                                                            </div>
                                                        </button>
                                                        <button
                                                            onClick={() => setGroupPrivacy('private')}
                                                            className={cn(
                                                                "flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all",
                                                                groupPrivacy === 'private'
                                                                    ? "bg-amber-600/20 border-amber-500/40 text-amber-400"
                                                                    : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"
                                                            )}
                                                        >
                                                            <span className="text-lg">🔒</span>
                                                            <div className="text-left">
                                                                <p>Privé</p>
                                                                <p className="text-[10px] font-normal opacity-70">Accès par approbation</p>
                                                            </div>
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* Submit Button */}
                                    <Button
                                        className="w-full h-14 rounded-2xl bg-linear-to-r from-indigo-600 to-purple-600 font-bold text-lg"
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
                        className="relative z-10 flex flex-col h-dvh pb-0 max-w-4xl mx-auto w-full overflow-x-hidden"
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
                                    className="rounded-full bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 font-bold px-4 h-9 shadow-lg shadow-emerald-600/30 transition-all border-2 border-emerald-400/30 text-xs sm:text-sm w-full sm:w-auto"
                                    onClick={() => setShowCreateGroupDialog(true)}
                                >
                                    <Plus className="h-4 w-4 mr-1.5" />
                                    Créer un groupe
                                </Button>
                            </div>
                        </header>

                        {/* Group Search */}
                        <div className="px-4 sm:px-6 mb-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                                <input
                                    type="text"
                                    placeholder="Rechercher un groupe..."
                                    value={groupSearchQuery}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
                                    onChange={(e) => setGroupSearchQuery(e.target.value)}
                                />
                                {groupSearchQuery && (
                                    <button onClick={() => setGroupSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <X className="h-4 w-4 text-slate-500 hover:text-white" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <ScrollArea className="flex-1 overflow-x-hidden">
                            <div className="space-y-6 pb-32 px-3 sm:px-6 max-w-full overflow-hidden">
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
                                        Communautés à découvrir ({groups.filter(g => !userGroups.includes(g.id) && (!groupSearchQuery || g.name.toLowerCase().includes(groupSearchQuery.toLowerCase()))).length})
                                    </h3>
                                    {groups.filter(g => !userGroups.includes(g.id) && (!groupSearchQuery || g.name.toLowerCase().includes(groupSearchQuery.toLowerCase()))).length === 0 ? (
                                        <div className="text-center py-8 bg-white/5 rounded-2xl">
                                            <Sparkles className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                                            <p className="text-slate-500 text-sm">Vous avez rejoint tous les groupes !</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {groups.filter(g => !userGroups.includes(g.id) && (!groupSearchQuery || g.name.toLowerCase().includes(groupSearchQuery.toLowerCase()))).map((group) => (
                                                <Card
                                                    key={group.id}
                                                    className="bg-white/5 border-white/5 rounded-2xl overflow-hidden hover:bg-white/10 transition-all"
                                                >
                                                    <CardContent className="p-3 sm:p-4">
                                                        <div
                                                            className="flex items-start gap-3 sm:gap-4 cursor-pointer"
                                                            onClick={() => {
                                                                setSelectedGroup(group);
                                                                loadGroupMessages(group.id);
                                                                setViewState('group-detail');
                                                            }}
                                                        >
                                                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center bg-linear-to-br from-indigo-600/30 to-purple-600/30 shrink-0">
                                                                <Users className="h-5 w-5 sm:h-7 sm:w-7 text-indigo-400" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                                                    <h3 className="font-bold text-white text-sm truncate max-w-[180px] sm:max-w-none">{group.name}</h3>
                                                                    {group.isAnswered && (
                                                                        <Badge className="bg-amber-500/20 text-amber-400 border-none text-[10px]">
                                                                            <Sparkles className="h-3 w-3 mr-1" />
                                                                            Exaucée
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs sm:text-sm text-slate-400 line-clamp-2">{group.description}</p>
                                                                <div className="flex items-center gap-3 mt-2">
                                                                    <span className="text-xs text-slate-500 flex items-center gap-1">
                                                                        <Users className="h-3 w-3" />
                                                                        {group.memberCount || 0} membres
                                                                    </span>
                                                                    {!(group.isOpen ?? group.is_open ?? true) && (
                                                                        <span className="text-xs text-amber-400 flex items-center gap-1">
                                                                            <Lock className="h-3 w-3" />
                                                                            Privé
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {/* Creator name */}
                                                                <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                                                                    <Crown className="h-3 w-3 text-amber-500" />
                                                                    Créé par {(group as any).profiles?.full_name || 'Utilisateur'}
                                                                </p>
                                                            </div>
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
                                                                    "w-full h-9 sm:h-10 rounded-xl font-bold text-sm",
                                                                    group.isOpen
                                                                        ? "bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500"
                                                                        : "bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500"
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
                                        <p className="text-sm text-slate-600 mt-2">🚪 Créez la première chambre haute!</p>
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
                        className="fixed inset-0 z-10 flex flex-col bg-linear-to-b from-[#0a0d14] to-[#0F1219]"
                    >
                        <header className="px-3 sm:px-6 pt-12 pb-4 border-b border-white/5 shrink-0 max-h-[45vh] overflow-y-auto">
                            <div className="flex items-center gap-2 sm:gap-4 mb-4">
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
                                        {!(selectedGroup.isOpen ?? selectedGroup.is_open ?? true) && ' • Groupe privé'}
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
                                            className="rounded-2xl bg-linear-to-r from-green-600 to-emerald-600 shadow-lg shadow-green-600/30 border-0 gap-2 px-4 h-10"
                                            onClick={() => setViewState('group-call')}
                                        >
                                            <Video className="h-4 w-4" />
                                            <span className="text-xs font-bold">Appel</span>
                                        </Button>
                                    </motion.div>
                                    {/* Livestream Button */}
                                    <LiveStreamButton
                                        groupId={selectedGroup.id}
                                        userId={user?.id || ''}
                                        isGroupAdmin={(selectedGroup.created_by === user?.id || selectedGroup.createdBy === user?.id) || false}
                                        onOpenStream={(stream) => {
                                            setActiveLiveStream(stream);
                                            setViewState('livestream');
                                        }}
                                    />
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

                            {/* Group Tools Toggle - only for creator */}
                            {(selectedGroup.created_by === user?.id || selectedGroup.createdBy === user?.id) && (
                                <div className="flex gap-2 mt-2">
                                    <Button
                                        size="sm"
                                        className={cn(
                                            "flex-1 rounded-xl gap-2 h-9 text-xs font-bold transition-all",
                                            showGroupTools
                                                ? "bg-violet-600/20 text-violet-400 border border-violet-500/30"
                                                : "bg-white/5 text-slate-400 hover:bg-white/10"
                                        )}
                                        onClick={() => setShowGroupTools(!showGroupTools)}
                                    >
                                        <Wrench className="h-3.5 w-3.5" />
                                        {showGroupTools ? 'Masquer les outils' : 'Outils du groupe'}
                                    </Button>
                                </div>
                            )}

                            {/* Group Tools Panel - rendered outside header below */}

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

                        {/* Group Tools (outside header to prevent header overflow) */}
                        <AnimatePresence>
                            {showGroupTools && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden border-b border-white/5 max-h-[30vh] overflow-y-auto shrink-0"
                                >
                                    <GroupToolsPanel
                                        groupId={selectedGroup.id}
                                        userId={user?.id || ''}
                                        userName={user?.name || 'Utilisateur'}
                                        isCreator={selectedGroup.created_by === user?.id || selectedGroup.createdBy === user?.id}
                                        isOpen={true}
                                        onClose={() => setShowGroupTools(false)}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Group Messages */}
                        <div
                            ref={chatScrollRef}
                            className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3"
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

                        {/* Message input - always visible for group members */}
                        {(
                            <div className="shrink-0 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] border-t border-white/10 bg-slate-900/95 backdrop-blur-md">
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
                                                onClick={() => stopRecording('group', { userId: user!.id, groupId: selectedGroup!.id, onGroupSent: (gId) => loadGroupMessages(gId) })}
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
                                            onKeyDown={(e) => e.key === 'Enter' && selectedGroup && sendGroupMessage(selectedGroup.id, selectedGroup.name)}
                                            className="flex-1 h-10 rounded-full bg-white/5 border-white/10 px-4"
                                        />
                                    )}

                                    {/* Send or Mic Button */}
                                    {!isRecording && !isUploadingVoice && (
                                        newMessage.trim() ? (
                                            <Button
                                                size="icon"
                                                className="h-10 w-10 rounded-full bg-indigo-600 hover:bg-indigo-500"
                                                onClick={() => selectedGroup && sendGroupMessage(selectedGroup.id, selectedGroup.name)}
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
                                onStartCall={(type) => {
                                    setActiveGlobalCall({
                                        type,
                                        mode: 'group',
                                        isIncoming: false,
                                        groupId: selectedGroup.id,
                                        groupName: selectedGroup.name,
                                    });
                                }}
                            />
                        </div>
                    </motion.div>
                )}

                {/* ========== LIVESTREAM SALON ========== */}
                {viewState === 'livestream' && selectedGroup && activeLiveStream && (
                    <LiveStreamSalon
                        stream={activeLiveStream}
                        groupId={selectedGroup.id}
                        groupName={selectedGroup.name}
                        userId={user?.id || ''}
                        onClose={() => {
                            setActiveLiveStream(null);
                            setViewState('group-detail');
                        }}
                    />
                )}

                {/* ========== GLOBAL LIVE SALON (from admin) ========== */}
                {viewState === 'global-live' && user && (() => {
                    const platform = appSettings?.['live_platform'] || 'youtube';
                    const isPortrait = ['facebook', 'tiktok', 'instagram'].includes(platform);
                    const primaryUrl = appSettings?.['live_stream_url'] || '';
                    const backupUrl = appSettings?.['live_stream_url_backup'] || '';

                    return (
                        <GlobalLiveSalon
                            platform={platform}
                            isPortrait={isPortrait}
                            primaryUrl={primaryUrl}
                            backupUrl={backupUrl}
                            user={user}
                            onClose={() => setViewState('main')}
                        />
                    );
                })()}

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
                    <DialogHeader className="sr-only">
                        <DialogTitle>Connexion requise</DialogTitle>
                        <DialogDescription>Connectez-vous ou créez un compte pour interagir avec la communauté.</DialogDescription>
                    </DialogHeader>
                    <div className="p-8 text-center">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-linear-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
                            <Lock className="w-10 h-10 text-white" />
                        </div>
                        <h3 className="text-xl font-black mb-2" aria-hidden="true">Connexion requise</h3>
                        <p className="text-slate-400 text-sm mb-6">
                            Connectez-vous ou créez un compte pour interagir avec la communauté.
                        </p>
                        <div className="space-y-3">
                            <Button
                                className="w-full h-12 rounded-xl bg-linear-to-r from-indigo-600 to-purple-600 border-0 font-bold text-sm"
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

            {/* ===== Create Group Dialog (global, always rendered) ===== */}
            <Dialog open={showCreateGroupDialog} onOpenChange={setShowCreateGroupDialog}>
                <DialogContent className="bg-[#0F1219] border-white/10 text-white max-w-[92vw] sm:max-w-md rounded-2xl sm:rounded-4xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">🚪 Créer une chambre haute</DialogTitle>
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

                        {/* Public / Private Toggle */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                Visibilité du groupe
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsGroupPublic(true)}
                                    className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${isGroupPublic
                                        ? 'bg-green-500/15 border-green-500/50 ring-2 ring-green-500/30'
                                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                                        }`}
                                >
                                    <Globe className={`h-5 w-5 ${isGroupPublic ? 'text-green-400' : 'text-slate-500'}`} />
                                    <div className="text-left">
                                        <p className={`text-sm font-bold ${isGroupPublic ? 'text-green-400' : 'text-slate-300'}`}>Public</p>
                                        <p className="text-[10px] text-slate-500">Tout le monde peut rejoindre</p>
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsGroupPublic(false)}
                                    className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${!isGroupPublic
                                        ? 'bg-amber-500/15 border-amber-500/50 ring-2 ring-amber-500/30'
                                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                                        }`}
                                >
                                    <Lock className={`h-5 w-5 ${!isGroupPublic ? 'text-amber-400' : 'text-slate-500'}`} />
                                    <div className="text-left">
                                        <p className={`text-sm font-bold ${!isGroupPublic ? 'text-amber-400' : 'text-slate-300'}`}>Privé</p>
                                        <p className="text-[10px] text-slate-500">Approbation requise</p>
                                    </div>
                                </button>
                            </div>
                        </div>

                        <Button
                            className="w-full h-12 rounded-2xl bg-linear-to-r from-indigo-600 to-purple-600 font-bold"
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

            {/* Floating bubbles for published prayers/tools */}
            <FloatingBubbles
                items={floatingBubbles}
                onRemove={(id) => setFloatingBubbles(prev => prev.filter(b => b.id !== id))}
            />
        </div >
    );
}

// PrayerCard, TestimonyCard, ChatMessage components have been extracted to:
// - @/components/community/prayer-card.tsx
// - @/components/community/testimony-card.tsx
// - @/components/community/chat-message.tsx

