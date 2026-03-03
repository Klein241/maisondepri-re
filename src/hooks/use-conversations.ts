'use client';

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { notifyDirectMessage } from '@/lib/notifications';
import { toast } from 'sonner';

interface UserInfo {
    id: string;
    name: string;
    avatar?: string | null;
}

/**
 * useConversations — Manage private (DM) conversations.
 *
 * Encapsulates:
 * • Loading conversations list
 * • Loading all users for new conversation
 * • Loading & sending direct messages with optimistic updates
 * • Friend checking & request sending from chat
 */
export function useConversations(user: UserInfo | null) {
    const [conversations, setConversations] = useState<any[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<any | null>(null);
    const [directMessages, setDirectMessages] = useState<any[]>([]);
    const [loadingConversations, setLoadingConversations] = useState(false);
    const [loadingDMs, setLoadingDMs] = useState(false);
    const [allUsers, setAllUsers] = useState<any[]>([]);

    // Friends state
    const [userFriends, setUserFriends] = useState<string[]>([]);
    const [isFriendWithChatPartner, setIsFriendWithChatPartner] = useState(false);

    const loadConversations = useCallback(async () => {
        if (!user) return;
        setLoadingConversations(true);
        try {
            let { data, error } = await supabase
                .from('conversations')
                .select('*')
                .or(`participant1_id.eq.${user.id},participant2_id.eq.${user.id}`)
                .order('last_message_at', { ascending: false });

            if (!error && data) {
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
    }, [user]);

    const loadUsers = useCallback(async () => {
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
    }, [user]);

    const loadUserFriends = useCallback(async () => {
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
    }, [user]);

    const loadDirectMessages = useCallback(async (conversationId: string) => {
        setLoadingDMs(true);
        try {
            const { data, error } = await supabase
                .from('direct_messages')
                .select('*')
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: true })
                .limit(100);

            if (!error && data) {
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
    }, []);

    const sendDirectMessage = useCallback(async (messageContent: string) => {
        if (!messageContent.trim() || !user || !selectedConversation) return;

        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        // Optimistic update
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

            if (data) {
                setDirectMessages(prev =>
                    prev.map(m => m.id === tempId
                        ? { ...data, sender: optimisticMessage.sender }
                        : m
                    )
                );
            }

            await supabase
                .from('conversations')
                .update({ last_message_at: new Date().toISOString(), last_message: messageContent })
                .eq('id', selectedConversation.id);

            if (selectedConversation.otherUser?.id) {
                notifyDirectMessage({
                    recipientId: selectedConversation.otherUser.id,
                    senderId: user.id,
                    senderName: user.name || 'Utilisateur',
                    messagePreview: messageContent,
                    conversationId: selectedConversation.id,
                });
            }

            return true;
        } catch (e) {
            console.error('Error sending DM:', e);
            setDirectMessages(prev => prev.filter(m => m.id !== tempId));
            toast.error("Erreur lors de l'envoi du message");
            return false;
        }
    }, [user, selectedConversation]);

    const checkFriendshipWithPartner = useCallback(async (partnerId: string) => {
        if (!user) return;
        try {
            const { data } = await supabase
                .from('friendships')
                .select('id')
                .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
                .eq('status', 'accepted')
                .maybeSingle();

            setIsFriendWithChatPartner(!!data);
        } catch (e) {
            setIsFriendWithChatPartner(false);
        }
    }, [user]);

    const sendFriendRequestFromChat = useCallback(async (partnerId: string) => {
        if (!user) return;
        try {
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
    }, [user]);

    return {
        // State
        conversations,
        setConversations,
        selectedConversation,
        setSelectedConversation,
        directMessages,
        setDirectMessages,
        loadingConversations,
        loadingDMs,
        allUsers,
        userFriends,
        setUserFriends,
        isFriendWithChatPartner,

        // Actions
        loadConversations,
        loadUsers,
        loadUserFriends,
        loadDirectMessages,
        sendDirectMessage,
        checkFriendshipWithPartner,
        sendFriendRequestFromChat,
    };
}
