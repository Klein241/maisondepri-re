'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Send, ArrowLeft, Users, Search, MoreVertical, Phone, Video,
    Smile, Mic, MicOff, Image, Paperclip, Check, CheckCheck,
    Circle, MessageSquare, Plus, X, Loader2, User, Play, Pause, Trash2,
    Shield, UserPlus, UserMinus, Camera, Settings, Crown, AtSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { EmojiPicker } from '@/components/ui/emoji-picker';
import { notifyDirectMessage } from '@/lib/notifications';
import { useAppStore } from '@/lib/store';

// Types
interface ChatUser {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    is_online?: boolean;
    last_seen?: string;
}

interface Conversation {
    id: string;
    participantId: string;
    participant: ChatUser;
    lastMessage: string;
    lastMessageAt: string;
    unreadCount: number;
}

interface ChatGroup {
    id: string;
    name: string;
    description: string | null;
    is_urgent: boolean;
    member_count: number;
    lastMessage?: string;
    lastMessageAt?: string;
    unreadCount: number;
    is_admin_created: boolean;
    prayer_request_id?: string;
    avatar_url?: string | null;
    created_by?: string;
}

interface GroupMember {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    is_online?: boolean;
    role?: string;
}

interface Message {
    id: string;
    content: string;
    type: 'text' | 'voice' | 'image';
    voice_url?: string;
    voice_duration?: number;
    image_url?: string;
    sender_id: string;
    sender?: ChatUser;
    created_at: string;
    is_read: boolean;
    read_by?: string[];
}

interface TypingUser {
    userId: string;
    userName: string;
}

interface WhatsAppChatProps {
    user: { id: string; name: string; avatar?: string } | null;
    onHideNav?: (hide: boolean) => void;
}

// Voice Message Player Component
function VoiceMessagePlayer({ voiceUrl, duration }: { voiceUrl: string; duration?: number }) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        const audio = new Audio(voiceUrl);
        audioRef.current = audio;

        audio.addEventListener('timeupdate', () => {
            if (audio.duration) {
                setProgress((audio.currentTime / audio.duration) * 100);
                setCurrentTime(audio.currentTime);
            }
        });

        audio.addEventListener('ended', () => {
            setIsPlaying(false);
            setProgress(0);
            setCurrentTime(0);
        });

        return () => {
            audio.pause();
            audio.src = '';
        };
    }, [voiceUrl]);

    const togglePlay = () => {
        if (!audioRef.current) return;

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex items-center gap-3 min-w-[200px]">
            <button
                onClick={togglePlay}
                className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
            >
                {isPlaying ? (
                    <Pause className="h-5 w-5 text-white" />
                ) : (
                    <Play className="h-5 w-5 text-white ml-0.5" />
                )}
            </button>
            <div className="flex-1">
                <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-white/60 transition-all duration-100"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <span className="text-[10px] opacity-70 mt-1 block">
                    {formatTime(currentTime)} / {formatTime(duration || 0)}
                </span>
            </div>
        </div>
    );
}

export function WhatsAppChat({ user, onHideNav }: WhatsAppChatProps) {
    // View State
    const [view, setView] = useState<'list' | 'conversation' | 'group'>('list');

    // Notify parent to hide/show bottom nav based on view
    useEffect(() => {
        onHideNav?.(view !== 'list');
    }, [view, onHideNav]);
    const [activeTab, setActiveTab] = useState<'conversations' | 'groups' | 'admin_groups'>('conversations');

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
                } else if (!currentGroup) {
                    // User is on the list view — reload groups to update last message
                    loadGroups();
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

        return () => {
            dmChannel.unsubscribe();
            groupChannel.unsubscribe();
            typingChannel.unsubscribe();
            groupDeleteChannel.unsubscribe();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]); // Only user.id - refs are used for conversation/group

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Setup presence channel for online status
    const setupPresenceChannel = () => {
        if (!user) return;

        const channel = supabase.channel(`online_users_${Date.now()}`);
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
                }
            });

        return () => {
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

                // Separate admin-created from prayer-request groups
                const userGroups: ChatGroup[] = [];
                const adminGroupsList: ChatGroup[] = [];

                for (const g of (groupData || [])) {
                    // Get member count
                    const { count } = await supabase
                        .from('prayer_group_members')
                        .select('*', { count: 'exact', head: true })
                        .eq('group_id', g.id);

                    const group: ChatGroup = {
                        id: g.id,
                        name: g.name,
                        description: g.description,
                        is_urgent: g.is_urgent || false,
                        member_count: count || 0,
                        unreadCount: 0,
                        is_admin_created: !g.prayer_request_id,
                        prayer_request_id: g.prayer_request_id,
                        avatar_url: g.avatar_url || null,
                        created_by: g.created_by,
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
            const { data, error } = await supabase
                .from('prayer_group_members')
                .select('user_id, role, profiles:user_id(id, full_name, avatar_url, is_online)')
                .eq('group_id', groupId);

            if (error) throw error;

            const members: GroupMember[] = (data || []).map((m: any) => ({
                id: m.profiles?.id || m.user_id,
                full_name: m.profiles?.full_name || 'Utilisateur',
                avatar_url: m.profiles?.avatar_url || null,
                is_online: m.profiles?.is_online || onlineUsers[m.user_id] || false,
                role: m.role || 'member',
            }));
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
        setMessages([]); // Clear previous messages immediately
        try {
            if (type === 'conversation') {
                // id here is the conversation_id (from conversations table)
                const { data, error } = await supabase
                    .from('direct_messages')
                    .select('*')
                    .eq('conversation_id', id)
                    .order('created_at', { ascending: true });

                if (error) throw error;

                // Fetch sender profiles
                const messagesWithSenders = await Promise.all(
                    (data || []).map(async (msg: any) => {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('id, full_name, avatar_url')
                            .eq('id', msg.sender_id)
                            .single();
                        return {
                            ...msg,
                            sender: profile,
                            is_read: msg.is_read || msg.sender_id === user?.id
                        };
                    })
                );
                setMessages(messagesWithSenders);

                // Mark messages from others as read
                await supabase
                    .from('direct_messages')
                    .update({ is_read: true })
                    .eq('conversation_id', id)
                    .neq('sender_id', user?.id)
                    .eq('is_read', false);
            } else {
                const { data, error } = await supabase
                    .from('prayer_group_messages')
                    .select(`
                        *,
                        sender:user_id (id, full_name, avatar_url)
                    `)
                    .eq('group_id', id)
                    .order('created_at', { ascending: true });

                if (error) throw error;
                setMessages((data || []).map((m: any) => ({
                    ...m,
                    sender_id: m.user_id,
                    is_read: true
                })));
            }
        } catch (e) {
            console.error('Error loading messages:', e);
        }
        setIsLoading(false);
    };

    // Send message
    const sendMessage = async () => {
        if (!newMessage.trim() || !user) return;

        const msgContent = newMessage.trim();
        setNewMessage('');
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
            setRecordingTime(0);

            if (recordingIntervalRef.current) {
                clearInterval(recordingIntervalRef.current);
                recordingIntervalRef.current = null;
            }

            toast.info('Enregistrement annulé');
        }
    };

    // Open conversation
    const openConversation = (conv: Conversation) => {
        setSelectedConversation(conv);
        setSelectedGroup(null);
        setView('conversation');
        loadMessages('conversation', conv.id);
    };

    // Open group
    const openGroup = (group: ChatGroup) => {
        setSelectedGroup(group);
        setSelectedConversation(null);
        setView('group');
        setShowGroupTools(false);
        loadMessages('group', group.id);
        loadGroupMembers(group.id);

        // Start polling fallback for group messages (every 5s)
        if (groupPollRef.current) clearInterval(groupPollRef.current);
        groupPollRef.current = setInterval(async () => {
            try {
                const { data, error } = await supabase
                    .from('prayer_group_messages')
                    .select(`*, sender:user_id (id, full_name, avatar_url)`)
                    .eq('group_id', group.id)
                    .order('created_at', { ascending: true });
                if (!error && data) {
                    setMessages(prev => {
                        if (data.length === prev.length) return prev;
                        return data.map((m: any) => ({
                            ...m,
                            sender_id: m.user_id,
                            is_read: true
                        }));
                    });
                }
            } catch { }
        }, 5000);
    };

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

    const getInitials = (name: string | null) => {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const formatTime = (date: string) => {
        const d = new Date(date);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays === 1) {
            return 'Hier';
        } else if (diffDays < 7) {
            return d.toLocaleDateString('fr-FR', { weekday: 'short' });
        } else {
            return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        }
    };

    // URL regex for detecting links in messages
    const urlRegex = /(https?:\/\/[^\s]+)/gi;

    // Render message content with clickable links and @mentions
    const renderMessageContent = (content: string) => {
        // First handle URLs
        const parts = content.split(urlRegex);
        const hasUrl = parts.length > 1;

        // Highlight @mentions
        const renderWithMentions = (text: string) => {
            const mentionParts = text.split(/(@\w[\w\s]*?\s)/g);
            if (mentionParts.length <= 1) return text;
            return mentionParts.map((p, i) =>
                p.startsWith('@') ? <span key={i} className="text-indigo-400 font-semibold">{p}</span> : p
            );
        };

        if (!hasUrl) return <p className="text-sm whitespace-pre-wrap break-words">{renderWithMentions(content)}</p>;

        return (
            <div className="text-sm whitespace-pre-wrap break-words">
                {parts.map((part, i) => {
                    if (urlRegex.test(part)) {
                        urlRegex.lastIndex = 0; // Reset regex
                        // Extract domain for display
                        let domain = '';
                        try { domain = new URL(part).hostname; } catch { domain = part; }
                        return (
                            <span key={i}>
                                <a
                                    href={part}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-300 underline hover:text-blue-200 transition-colors break-all"
                                >
                                    {part}
                                </a>
                                <div className="mt-1 rounded-lg bg-white/5 border border-white/10 p-2 max-w-full overflow-hidden">
                                    <p className="text-[10px] text-slate-400 truncate">🔗 {domain}</p>
                                    <p className="text-xs text-slate-300 truncate">{part.length > 60 ? part.slice(0, 60) + '...' : part}</p>
                                </div>
                            </span>
                        );
                    }
                    urlRegex.lastIndex = 0;
                    return <span key={i}>{part}</span>;
                })}
            </div>
        );
    };

    // Count online members in current group
    const onlineMembersCount = groupMembers.filter(m => m.is_online || onlineUsers[m.id]).length;

    // Check if current user is admin/creator
    const isGroupAdmin = selectedGroup && (
        selectedGroup.created_by === user?.id ||
        groupMembers.find(m => m.id === user?.id)?.role === 'admin'
    );

    // Upload group photo
    const handleGroupPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedGroup || !user) return;
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

    if (!user) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">Connectez-vous pour accéder au chat</p>
            </div>
        );
    }

    // List View (WhatsApp-style)
    if (view === 'list') {
        return (
            <div className="flex flex-col h-full w-full max-w-full overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950">
                {/* Header */}
                <div className="p-4 border-b border-white/10">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-white">Messages</h2>
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
                                                <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white">
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
                        <div className="divide-y divide-white/5">
                            {groups.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                    <p>Aucun groupe de prière</p>
                                    <p className="text-xs mt-1">Rejoignez un groupe depuis une demande de prière</p>
                                </div>
                            ) : (
                                groups.map(group => (
                                    <button
                                        key={group.id}
                                        onClick={() => openGroup(group)}
                                        className="w-full p-3 sm:p-4 flex items-center gap-3 hover:bg-white/5 transition-colors text-left overflow-hidden"
                                    >
                                        <div className={cn(
                                            "w-12 h-12 rounded-full flex items-center justify-center",
                                            group.is_urgent
                                                ? "bg-gradient-to-br from-red-500 to-orange-500"
                                                : "bg-gradient-to-br from-green-500 to-teal-500"
                                        )}>
                                            <Users className="h-6 w-6 text-white" />
                                        </div>
                                        <div className="flex-1 min-w-0 overflow-hidden">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-white truncate text-sm sm:text-base">{group.name}</span>
                                                {group.is_urgent && (
                                                    <Badge className="bg-red-500/20 text-red-400 text-[10px] sm:text-xs shrink-0">URGENT</Badge>
                                                )}
                                            </div>
                                            <p className="text-xs sm:text-sm text-slate-400 truncate">
                                                {group.description || 'Groupe de prière'}
                                            </p>
                                            <p className="text-[10px] text-slate-500 mt-0.5">{group.member_count} membres</p>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {adminGroups.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                    <p>Aucun groupe officiel</p>
                                </div>
                            ) : (
                                adminGroups.map(group => (
                                    <button
                                        key={group.id}
                                        onClick={() => openGroup(group)}
                                        className="w-full p-3 sm:p-4 flex items-center gap-3 hover:bg-white/5 transition-colors text-left overflow-hidden"
                                    >
                                        <div className={cn(
                                            "w-12 h-12 rounded-full flex items-center justify-center",
                                            group.is_urgent
                                                ? "bg-gradient-to-br from-red-500 to-orange-500"
                                                : "bg-gradient-to-br from-purple-500 to-indigo-500"
                                        )}>
                                            <Users className="h-6 w-6 text-white" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-white truncate">{group.name}</span>
                                                {group.is_urgent && (
                                                    <Badge className="bg-red-500/20 text-red-400 text-xs">URGENT</Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-400 truncate">
                                                {group.description || 'Groupe officiel'}
                                            </p>
                                        </div>
                                    </button>
                                ))
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
                                                        <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white text-sm">
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

    // Conversation/Group View
    const currentRecipient = view === 'conversation' ? selectedConversation?.participant : null;
    const currentGroup = view === 'group' ? selectedGroup : null;

    return (
        <div className="flex flex-col h-full w-full max-w-full overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950">
            {/* Chat Header */}
            <div className="p-2 sm:p-3 border-b border-white/10 flex items-center gap-2 sm:gap-3 bg-slate-900/80 backdrop-blur-sm">
                <Button variant="ghost" size="icon" onClick={goBackToList} className="shrink-0 h-8 w-8 sm:h-9 sm:w-9">
                    <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>

                {currentRecipient && (
                    <>
                        <div className="relative">
                            <Avatar className="h-10 w-10">
                                <AvatarImage src={currentRecipient.avatar_url || undefined} />
                                <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white">
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
                                onClick={() => {
                                    const chars = 'abcdefghijklmnopqrstuvwxyz';
                                    const seg = (len: number) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
                                    const link = `https://meet.google.com/${seg(3)}-${seg(4)}-${seg(3)}`;
                                    window.open(link, '_blank');
                                    toast.success('Appel vocal lancé via Google Meet');
                                }}
                                title="Appel vocal"
                            >
                                <Phone className="h-5 w-5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="rounded-full text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"
                                onClick={() => {
                                    const chars = 'abcdefghijklmnopqrstuvwxyz';
                                    const seg = (len: number) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
                                    const link = `https://meet.google.com/${seg(3)}-${seg(4)}-${seg(3)}`;
                                    window.open(link, '_blank');
                                    toast.success('Appel vidéo lancé via Google Meet');
                                }}
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
                                ? "bg-gradient-to-br from-red-500 to-orange-500"
                                : "bg-gradient-to-br from-indigo-500 to-purple-500"
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
                        <div className="flex items-center gap-0 sm:gap-1 shrink-0">
                            {isGroupAdmin && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="rounded-full text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 h-7 w-7 sm:h-9 sm:w-9"
                                    onClick={() => { setShowGroupTools(true); loadAllUsers(); }}
                                    title="Outils de groupe"
                                >
                                    <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="rounded-full text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 h-7 w-7 sm:h-9 sm:w-9"
                                onClick={() => setShowGroupMembers(!showGroupMembers)}
                                title="Voir les membres"
                            >
                                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="rounded-full text-slate-400 hover:text-green-400 hover:bg-green-500/10 h-7 w-7 sm:h-9 sm:w-9"
                                onClick={() => {
                                    const chars = 'abcdefghijklmnopqrstuvwxyz';
                                    const seg = (len: number) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
                                    const link = `https://meet.google.com/${seg(3)}-${seg(4)}-${seg(3)}`;
                                    window.open(link, '_blank');
                                    toast.success(`Appel de groupe lancé pour ${currentGroup.name}`);
                                }}
                                title="Appel vidéo de groupe"
                            >
                                <Video className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </Button>
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

            {/* Messages */}
            <ScrollArea className="flex-1 p-2 sm:p-4">
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
                        {messages.map((msg, idx) => {
                            const isOwn = msg.sender_id === user.id;
                            const showAvatar = !isOwn && (idx === 0 || messages[idx - 1].sender_id !== msg.sender_id);

                            return (
                                <motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={cn("flex", isOwn ? "justify-end" : "justify-start")}
                                >
                                    {!isOwn && showAvatar && view === 'group' && (
                                        <Avatar className="h-8 w-8 mr-2 mt-auto">
                                            <AvatarImage src={msg.sender?.avatar_url || undefined} />
                                            <AvatarFallback className="text-xs bg-slate-600">
                                                {getInitials(msg.sender?.full_name ?? null)}
                                            </AvatarFallback>
                                        </Avatar>
                                    )}
                                    <div
                                        className={cn(
                                            "max-w-[85%] sm:max-w-[75%] rounded-2xl px-3 sm:px-4 py-2",
                                            isOwn
                                                ? "bg-indigo-600 text-white rounded-br-sm"
                                                : "bg-white/10 text-white rounded-bl-sm"
                                        )}
                                    >
                                        {!isOwn && view === 'group' && showAvatar && (
                                            <p className="text-xs text-indigo-400 font-medium mb-1">
                                                {msg.sender?.full_name}
                                            </p>
                                        )}

                                        {/* Voice Message */}
                                        {msg.type === 'voice' && msg.voice_url ? (
                                            <VoiceMessagePlayer
                                                voiceUrl={msg.voice_url}
                                                duration={msg.voice_duration}
                                            />
                                        ) : (
                                            renderMessageContent(msg.content)
                                        )}

                                        <div className="flex items-center justify-end gap-1 mt-1">
                                            <span className="text-[10px] opacity-70">
                                                {formatTime(msg.created_at)}
                                            </span>
                                            {isOwn && (
                                                msg.is_read ? (
                                                    <CheckCheck className="h-3 w-3 text-blue-400" />
                                                ) : (
                                                    <Check className="h-3 w-3 opacity-70" />
                                                )
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
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
            </ScrollArea>

            {/* Input Area */}
            <div className="p-2 sm:p-3 border-t border-white/10 bg-slate-900/80">
                {/* @Mention suggestions */}
                <AnimatePresence>
                    {showMentions && view === 'group' && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="mb-2 bg-slate-800 rounded-lg border border-white/10 max-h-32 overflow-y-auto"
                        >
                            {groupMembers
                                .filter(m => m.id !== user.id && (!mentionFilter || m.full_name?.toLowerCase().includes(mentionFilter)))
                                .slice(0, 5)
                                .map(m => (
                                    <button
                                        key={m.id}
                                        onClick={() => insertMention(m.full_name || 'Utilisateur')}
                                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 text-left"
                                    >
                                        <Avatar className="h-5 w-5">
                                            <AvatarImage src={m.avatar_url || undefined} />
                                            <AvatarFallback className="text-[8px] bg-slate-600">{getInitials(m.full_name)}</AvatarFallback>
                                        </Avatar>
                                        <span className="text-xs text-white">{m.full_name}</span>
                                        {(m.is_online || onlineUsers[m.id]) && <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />}
                                    </button>
                                ))
                            }
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Emoji Picker */}
                <div className="relative">
                    <EmojiPicker
                        isOpen={showEmojiPicker}
                        onClose={() => setShowEmojiPicker(false)}
                        onEmojiSelect={handleEmojiSelect}
                    />
                </div>

                <div className="flex items-center gap-1 sm:gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="text-slate-400 hover:text-white h-8 w-8 shrink-0"
                    >
                        <Smile className="h-4 w-4 sm:h-5 sm:w-5" />
                    </Button>

                    {view === 'group' && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { setShowMentions(!showMentions); setMentionFilter(''); }}
                            className="text-slate-400 hover:text-indigo-400 h-8 w-8 shrink-0"
                            title="Tagger un membre"
                        >
                            <AtSign className="h-4 w-4" />
                        </Button>
                    )}

                    {isRecording ? (
                        <div className="flex-1 flex items-center gap-2 sm:gap-3 bg-red-500/20 rounded-full px-3 sm:px-4 py-2">
                            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                            <span className="text-red-400 font-mono flex-1 text-sm">
                                {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
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
                                onClick={stopRecording}
                                className="text-green-400 hover:text-green-300 h-8 w-8"
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </div>
                    ) : isUploadingVoice ? (
                        <div className="flex-1 flex items-center justify-center gap-2 bg-indigo-500/20 rounded-full px-3 sm:px-4 py-2">
                            <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                            <span className="text-indigo-400 text-xs sm:text-sm">Envoi du message vocal...</span>
                        </div>
                    ) : (
                        <Input
                            ref={inputRef}
                            placeholder={view === 'group' ? "Message... (@ pour tagger)" : "Écrire un message..."}
                            value={newMessage}
                            onChange={handleMessageChange}
                            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                            className="flex-1 bg-white/5 border-white/10 rounded-full text-sm min-w-0"
                        />
                    )}

                    {newMessage.trim() ? (
                        <Button
                            size="icon"
                            onClick={sendMessage}
                            disabled={isSending}
                            className="bg-indigo-600 hover:bg-indigo-500 rounded-full"
                        >
                            {isSending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                        </Button>
                    ) : !isRecording && !isUploadingVoice && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={startRecording}
                            className="text-slate-400 hover:text-white"
                        >
                            <Mic className="h-5 w-5" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Group Tools Dialog */}
            <Dialog open={showGroupTools} onOpenChange={setShowGroupTools}>
                <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto bg-slate-900 border-white/10">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-white">
                            <Settings className="h-5 w-5 text-amber-400" />
                            Outils de groupe
                        </DialogTitle>
                    </DialogHeader>

                    {currentGroup && (
                        <div className="space-y-4">
                            {/* Group Photo */}
                            <div className="flex items-center gap-4">
                                <div
                                    className="relative w-16 h-16 rounded-full overflow-hidden cursor-pointer group bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center"
                                    onClick={() => groupPhotoInputRef.current?.click()}
                                >
                                    {currentGroup.avatar_url ? (
                                        <img src={currentGroup.avatar_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <Users className="h-8 w-8 text-white" />
                                    )}
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        {isUploadingGroupPhoto ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : <Camera className="h-5 w-5 text-white" />}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-white">{currentGroup.name}</p>
                                    <p className="text-xs text-slate-400">Cliquez pour changer la photo</p>
                                </div>
                            </div>
                            <input ref={groupPhotoInputRef} type="file" accept="image/*" className="hidden" onChange={handleGroupPhotoUpload} />

                            {/* Add Member */}
                            <Button
                                variant="outline"
                                className="w-full border-white/10 text-white hover:bg-white/5"
                                onClick={() => { setShowAddMemberDialog(true); setAddMemberSearch(''); }}
                            >
                                <UserPlus className="h-4 w-4 mr-2" />
                                Ajouter des membres
                            </Button>

                            {/* Members List with Admin Controls */}
                            <div className="space-y-1">
                                <p className="text-xs text-slate-400 font-medium px-1">Membres ({groupMembers.length})</p>
                                {groupMembers.map(member => (
                                    <div key={member.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5">
                                        <div className="relative">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={member.avatar_url || undefined} />
                                                <AvatarFallback className="text-xs bg-slate-600">{getInitials(member.full_name)}</AvatarFallback>
                                            </Avatar>
                                            {(member.is_online || onlineUsers[member.id]) && (
                                                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-slate-900" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-white truncate">{member.full_name || 'Utilisateur'}</p>
                                            <p className="text-[10px] text-slate-500">
                                                {member.role === 'admin' ? '👑 Admin' : 'Membre'}
                                                {(member.is_online || onlineUsers[member.id]) && ' • 🟢 En ligne'}
                                            </p>
                                        </div>
                                        {member.id !== user.id && member.role !== 'admin' && (
                                            <div className="flex gap-1 shrink-0">
                                                <Button
                                                    variant="ghost" size="icon"
                                                    className="h-7 w-7 text-amber-400 hover:bg-amber-500/10"
                                                    onClick={() => handlePromoteAdmin(member.id)}
                                                    title="Nommer admin"
                                                >
                                                    <Crown className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    variant="ghost" size="icon"
                                                    className="h-7 w-7 text-red-400 hover:bg-red-500/10"
                                                    onClick={() => handleRemoveMember(member.id)}
                                                    title="Retirer"
                                                >
                                                    <UserMinus className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                ))}
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
        </div>
    );
}
