'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/lib/store';
import { loadGroupMessages as loadGroupMessagesClient, sendGroupMessage as sendGroupMessageClient } from '@/lib/api-client';
import { notifyGroupNewMessage } from '@/lib/notifications';
import { toast } from 'sonner';

interface UserInfo {
    id: string;
    name: string;
    avatar?: string | null;
}

/**
 * useCommunityChat — Manage the public community chat.
 *
 * Encapsulates:
 * • Loading/sending community messages
 * • Real-time subscription for new messages
 * • Loading/sending group messages with optimistic updates
 * • Prayer request deletion sync
 */
export function useCommunityChat(user: UserInfo | null, activeTab: string) {
    const [chatMessages, setChatMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loadingMessages, setLoadingMessages] = useState(false);

    const [groupMessages, setGroupMessages] = useState<any[]>([]);
    const [loadingGroupMessages, setLoadingGroupMessages] = useState(false);

    const chatScrollRef = useRef<HTMLDivElement>(null);

    // Load community chat messages
    useEffect(() => {
        if (activeTab === 'chat') {
            loadChatMessages();
            const subscription = supabase
                .channel('community_messages_realtime')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_messages' }, async (payload) => {
                    const newMessage = payload.new;
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
    }, [chatMessages, groupMessages]);

    // Real-time subscription for prayer_requests deletions
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

    // Group messages
    const loadGroupMessages = async (groupId: string) => {
        setLoadingGroupMessages(true);
        try {
            const messages = await loadGroupMessagesClient(groupId);
            setGroupMessages(messages);
        } catch (e) {
            console.error('Error loading group messages:', e);
        }
        setLoadingGroupMessages(false);
    };

    const sendGroupMessage = async (groupId: string, groupName: string) => {
        if (!newMessage.trim() || !user) return;
        const content = newMessage.trim();

        // Optimistic update
        const tempId = `temp_grp_${Date.now()}`;
        const optimisticMsg = {
            id: tempId,
            group_id: groupId,
            user_id: user.id,
            content,
            type: 'text',
            created_at: new Date().toISOString(),
            profiles: { full_name: user.name || 'Moi', avatar_url: user.avatar || null }
        };
        setGroupMessages(prev => [...prev, optimisticMsg]);
        setNewMessage('');

        requestAnimationFrame(() => {
            if (chatScrollRef.current) {
                chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
            }
        });

        try {
            const savedMsg = await sendGroupMessageClient({
                groupId,
                userId: user.id,
                content,
                type: 'text',
            });

            if (!savedMsg) throw new Error('Failed to send');

            setGroupMessages(prev =>
                prev.map(m => m.id === tempId
                    ? { ...savedMsg, profiles: optimisticMsg.profiles }
                    : m
                )
            );

            notifyGroupNewMessage({
                groupId,
                groupName,
                senderId: user.id,
                senderName: user.name || 'Utilisateur',
                messagePreview: content,
            }).catch(console.error);
        } catch (e) {
            console.error('Error sending group message:', e);
            setGroupMessages(prev => prev.filter(m => m.id !== tempId));
            setNewMessage(content);
            toast.error("Erreur lors de l'envoi du message");
        }
    };

    return {
        // State
        chatMessages,
        setChatMessages,
        newMessage,
        setNewMessage,
        loadingMessages,
        groupMessages,
        setGroupMessages,
        loadingGroupMessages,
        chatScrollRef,

        // Actions
        loadChatMessages,
        sendChatMessage,
        loadGroupMessages,
        sendGroupMessage,
    };
}
